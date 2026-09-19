---
description: "Usage statistics panel for the dsh web client: historical token and money aggregates folded from every durable session log, rendered as a rolling-year spending heatmap with a range selector and a stated pricing and provenance basis."
kind: "package-reference"
---

# dsh-local-usage

English | [中文](README.zh.md)

## Summary

**Usage statistics** answers what this machine has spent and when. The harness records exact provider token accounting per session but exposes no cross-session aggregate and no currency at all, so this package supplies both: its Host half enumerates every logical session, folds each durable log into one sample per billed settlement, attributes each sample to its billed `provider/model` route, and prices it against a configured rate card; its Client half contributes a **global panel** — a sidebar entry opening a full-width page in the main column — whose centrepiece is a calendar of the current year.

It is deliberately not a Settings page: a year of days needs the main column's width to fit without horizontal scrolling, and what a profile has spent is not a preference.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Select **Usage** in the sidebar to open the panel. Mount `dsh-local-usage` in a Web composition that already provides the Session query engine, the session store, the layout shell with its sidebar and main column, and the Client Remote assembly. The panel registers its own sidebar entry and needs no configuration.

The Host half must also be selected by the Client assembly: a new Remote namespace is invisible to the browser until `packages/api/remotes/src/client/index.ts` mounts its generated contribution.

### Reading the page

Select **Usage** in the sidebar to open the panel. It is a global panel, so it belongs to the profile rather than to one Session and stays available while you switch conversations.

The range selector chooses the lens: **Today**, **Last 7 days**, **This month**, **This quarter**, or **This year**. Every range ends with today, so "this month" means the month so far rather than a completed calendar month.

Below it a hero figure states total spend over the selected range, above a row of tiles carrying total tokens, the input, output, and cache buckets, the billed call count, and the number of contributing sessions.

The calendar is the stable frame: it is Sunday-first with a compact `日 1 2 3 4 5 6` gutter, spans a rolling 52 weeks ending with the current one, and does not change when the range does. Cells are fixed squares whose edge is measured from the panel: while a year of columns fits at the minimum edge they grow to fill it, and below that the grid keeps the minimum edge and drops its oldest weeks, so it never scrolls sideways however narrow the panel gets — including with the sidebar expanded. Cells carry no border; intensity is the only mark on them, and hovering one opens a card with that day's cost, total tokens, input, output, and cache-read tokens, and call count.

Shading is a quantile ramp over the window's active days — median, then 75th and 90th percentiles — so the scale adapts to how the profile actually spends rather than assuming a distribution.

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `currency` | `CNY` | Currency every figure is expressed in; the plugin performs no conversion. |
| `models` | DeepSeek V4.1 Flash and V4 Pro cards | Rate cards matched against the routed model, first match wins. |
| `fallback` | the Flash card | Rate applied to a route no card matches. |
| `peakWindows` | `09:00-12:00`, `14:00-18:00` | Peak windows in Beijing time; empty disables peak pricing. |
| `peakWeekdaysOnly` | `true` | Whether weekends are always billed off-peak. |
| `peakMultiplier` | `2` | Multiplier applied to every rate inside a peak window. |

Each rate card states `input`, `cacheRead`, `cacheWrite`, and `output` in currency units per one million tokens, plus the `match` substring that claims a route. The shipped defaults are DeepSeek's published off-peak CNY prices for `deepseek-flash` and `deepseek-v4-pro`; a route served through an aggregator or a reseller must be priced by the operator, and the page names every route that fell back to the default rate instead of implying a figure it cannot support.

### What the money figure is worth

Cost is this plugin's own arithmetic, not a figure read back from a provider: `tokens × configured rate` per bucket, with peak or off-peak decided from each call's own instant. The panel states the formula, the rates actually in effect, and the peak schedule under **計價方式 / How cost is computed**, because the ways an estimate can differ from an invoice are exactly what a reader would otherwise assume were included — prepaid credit, package plans, volume discounts, granted balance, aggregator markups and reseller margins are all invisible here. Treat the provider's invoice as authoritative.

### Where the figures come from

The panel states its own provenance under **Where these figures come from / 用量依据**: the harness keeps no usage database, so the statistics are folded from the durable session event logs themselves — every session on the host, across all working directories, read through the session query service and replay-validated. That block also names the on-disk shape (`<DSH_HOME>/sessions/<cwd>/<session>/session.v3.jsonl.zstd`), what is left out (a fork's inherited prefix, calls still in flight, unreadable logs), the fact that nothing is uploaded and no external request is made, and the counts for the read that produced the figures on screen.

### What the figures mean

One sample is produced per **billed settlement**, using the same semantics as the harness's own `tokenUsage` projection: a settlement replaces the earlier sample of the same `(turn, step)` slot, `llm/retry-started` closes that slot so a retried attempt is billed separately, an identical repeat changes nothing, and a settlement that committed no surface message still counts through the usage carried in its embedded stream. The extractor therefore reproduces the persisted projection's totals exactly, which is what the package's verification checks against real logs. `uncachedInputTokens` excludes cache traffic; `cacheReadTokens` and `cacheWriteTokens` count as zero when a provider does not report them. Cost is `tokens × rate` per bucket, priced at each sample's own instant, so a peak boundary inside one day prices the samples on both sides correctly instead of averaging them.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

### The Host fold

`UsageInsightsController` enumerates sessions through `ctx.sessionQuery.listSessions()`, which reads no event logs, then reads each log once through `ctx.sessionQuery.readSession()` under a fixed read concurrency. Reading is the expensive half and folding is not, so the cache stores each session's extracted samples — not a finished report — and every call re-prices them against the current configuration; a configuration change therefore takes effect without re-reading a single log. A session's entry is dropped the moment it records another event, and a request may force a full re-read.

A forked session's log begins with its parent's inherited prefix and those turns were already billed under the parent, so only the events at or after the snapshot's `inheritedEventCount` are folded. Session titles are folded from the complete log, inherited prefix included, because a title is a fact about the conversation rather than about its billing.

### The page

The browser half contributes a global panel: one `sidebar.panellist` entry sharing its id with one `main` keyed-slot occupant, so the sidebar owns the button and the frame owns the column. Because a global panel is retained rather than remounted, the panel reads `usePanelInfo` and only reads logs while it is the selected one. It reaches the Host only through the generated `usageInsights` Remote namespace, so this half holds no fold logic and no pricing. There is no charting library in this product and adding one is out of bounds, so the calendar is a CSS grid of cells shaded with `color-mix` over a semantic theme token.

-----

<a id="further-exploration"></a>
## Further Exploration

- [Session query](../../session-query/session-query/README.md) — the cold-read engine the Host half enumerates and reads through.
- [Token meter](../../llm/token-meter/README.md) — the durable `tokenUsage` projection whose settlement and retry semantics this package's extractor mirrors.
- [Session projection cache](../../session/session-projection-cache/README.md) — the durable per-session projection store, the zero-I/O alternative to reading logs.
- [Adding a Remote API](../../../docs/cookbook/adding-a-remote-api.md) — the five steps this package's Host namespace follows.

<a id="model-experience"></a>
## Model Experience

None, as the package reads durable session logs and renders a browser page; it adds no model-visible content and makes no model call.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define what the page can report; they are current package constraints.

- **Prices are configuration, not billing** — the harness records tokens and never currency, so every money figure is `tokens × configured rate`; a route with no matching card is priced at the fallback rate and named in the page's warning line rather than silently estimated.
- **Chinese public holidays are not modelled** — peak windows follow the published Beijing-time schedule for Monday through Friday, so a holiday weekday inside a window is billed at the peak rate.
- **A settlement still streaming contributes nothing** — its usage is not final and a later settlement may replace it, so the newest exchange of a running session appears only once it settles.
- **Inherited fork prefixes are excluded by design** — a forked session reports only the spend it caused itself, so per-session figures cannot be summed to reconstruct what a parent conversation cost in total.
- **The calendar shows one rolling window only** — a deployment that needs an arbitrary date range has no control for it yet, because the panel fixes the frame at mount.
- **The report still carries per-model and per-session rows that the page no longer renders** — the weighted route and session rankings were removed from the page as a first pass, and their rows stay in the wire contract until a surface wants them again.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The two halves build in different faces. The Host half and its generated Typert artifacts are emitted during the Host pass (`hostPhase: true`), because the Client TypeScript program cannot compile until this package's `./remote` declarations exist; the browser artifact is emitted during the Client pass.

</details>

**Runtime invariant:** The Host half owns one `usageInsights` Remote namespace and one in-memory sample cache keyed by session id; the browser half registers one localized sidebar entry and the matching `main` panel. No companion is published, and neither half emits a Cordis event of its own.
