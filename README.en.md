---
description: "Usage statistics panel for the dsh web client: historical token and money aggregates folded from every durable session log, rendered as a rolling-year spending heatmap with a range selector and a stated pricing and provenance basis."
kind: "package-reference"
---

# dsh-local-usage

[中文](README.md) | English

## Summary

**Usage statistics** answers what this machine has spent and when. The harness records exact provider token accounting per session but exposes no cross-session aggregate and no currency at all, so this package supplies both: its Host half enumerates every logical session, folds each durable log into one sample per billed settlement, attributes each sample to its billed `provider/model` route, and prices it against a configured rate card; its Client half contributes a **global panel** — a sidebar entry opening a full-width page in the main column — whose centrepiece is a calendar of the current year.

It is deliberately not a Settings page: a year of days needs the main column's width to fit without horizontal scrolling, and what a profile has spent is not a preference.

![The usage panel: total spend and seven token tiles, a rolling year of spending as a heatmap, tokens ranked by project, and what the window's attempts cost it](https://raw.githubusercontent.com/webxiaobaiyu-droid/dsh-local-usage/main/docs/panel.en.png)

*What opening the panel looks like: the range's figures, a year of 52 weeks as one cell per day, tokens ranked by project, and what the window's attempts cost it. The corpus shown is a demo.*

What the panel gives you, in one place:

- **A rolling-year calendar** of daily spend — 52 weeks ending with the current one, shaded by a quantile ramp over the window's active days, with a hover card per day.
- **A first read that shows its work** — the panel's own frame, drawn empty while the logs are folded, with the count of session logs read so far where the Host can state it, and the figures counting up once when they land.
- **Folds that survive a restart** — what has already been folded is cached on disk against each log's own change token, so relaunching dsh redraws the year from a 2.5 MiB file instead of re-decoding every session log.
- **A page per day** — clicking any cell opens that day on its own page: its totals, and how much of them each working directory produced.
- **Five ranges** — today, last 7 days, this month, this quarter, this year — every one of them ending today.
- **Totals for the range** — cost, total tokens, the uncached-input, output, cache-read and cache-write buckets, the cache hit rate, billed calls, and contributing sessions.
- **A rate card you configure** — per-model input, cache-read, cache-write and output prices, a fallback rate, and a Beijing-time peak schedule with a multiplier.
- **A stated basis** — the formula, the rates actually in effect, and the provenance of every figure, on the page itself rather than in documentation only.
- **The harness's language, not a switch of its own** — every sentence comes from a dictionary and every figure is formatted for the active locale, so the Chinese panel counts in 万/亿 where the English one counts in M/B.
- **No network egress** — the fold runs inside the dsh process over durable session logs, and what it folds stays on this machine under `<DSH_HOME>/local-usage/`; nothing is uploaded and no external request is made.

## Table of Contents

- [Use this package](#use-this-package)
- [Troubleshooting](#troubleshooting)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Development](#development)

-----

<a id="use-this-package"></a>
## Use this package

Select **Usage** in the sidebar to open the panel. Mount `dsh-local-usage` in a Web composition that already provides the Session query engine, the session store, and the layout shell with its sidebar and main column. The panel registers its own sidebar entry and needs no configuration.

Nothing else has to be wired for the two halves to meet: the Host half registers its own Fetch route and the browser half calls it, so this package never appears in the product's Remote assembly.

### Install

```sh
dsh plugin add git@github.com:webxiaobaiyu-droid/dsh-local-usage.git   # from GitHub
dsh plugin add /path/to/dsh-local-usage                               # from a local checkout
```

The plugin manager behind **Plugins → Add plugin** takes the same two forms.

This package ships its built `lib/` and its `cordis.patch.yml` in the repository, and declares no build script, so an install never runs code on your machine and never asks for the build permission a git dependency would otherwise need: what loads is exactly the committed artifact. `dsh plugin add` appends `dsh-local-usage` to the profile's bundle list, and `dsh --profile <name> --dump-config` shows the single `local-usage` row it contributes. One row mounts both halves: it loads the Host half, and because the manifest declares `dsh.client.platform: web`, that same row is what makes the browser load the panel.

A profile's bundle list is composed when its process boots. Installing through **Plugins → Add plugin** applies to the running process; installing from the command line while a dsh process already serves that profile needs that process restarted before the entry appears.

### Reading the page

The panel is global, so it belongs to the profile rather than to one Session, and it stays available while you switch conversations.

The first request of a session is the slow one, because it has to read and fold every durable session log on the host. What you see while it runs is the page itself, empty: the hero and its tiles, a year of cells at the size the real ones will be, the ranking's rows. Month labels, the weekday gutter and the size of every cell are facts about the calendar rather than about the usage, so they are drawn for real; only figures are placeholders. Nothing moves when the numbers land. When the Host can say how many logs it has to fold, that count is stated — *Reading session 12 of 65* — with a bar for the share done; when it cannot, the bar sweeps instead, which is motion standing in for time nobody can measure. The figures then count up from zero once, over half a second, and never again: a range change swaps the numbers rather than replaying them over values you were comparing.

The range selector chooses the lens: **Today**, **Last 7 days**, **This month**, **This quarter**, or **This year**. Every range ends with today, so "this month" means the month so far rather than a completed calendar month. **Today is the default**, because the question the panel is usually opened with is what the current session has cost so far.


Changing the range never moves the page. The figures already on screen stay mounted while the new range is folded and are then replaced in place, so the strip keeps its height and the calendar below it keeps its position; a fold that takes longer than a moment dims those figures rather than emptying them, and the ranking says *Updating…* instead of naming a window the reader has already left. A range fold is a re-price over samples the Host already holds, so the wait this hides is usually a frame or two — and the day page draws its own frame the same way, at the height of the figures about to arrive.

**Neither does a large total, or a large corpus.** The layout is a function of the panel's width and never of the figures in it: the tiles take their column count from the container (seven, four, three, then two), so a wider total in the hero cannot push a tile onto another row and change the strip's height. The headline figure is set a step smaller as it grows — by the length of the text it will render, never by measuring itself — and every step occupies the same 30px block, so changing the range changes the digits and not the page. Every figure is one line: a money amount or a count folded in half is unreadable and changes the height of the box it sits in, so a value that cannot fit is elided instead, with the exact figure a hover or a drill-down away. And each grey line of a loading frame is the height of the line box it replaces, so the figures arrive without the page settling.

Beside the hero figure sits a row of tiles carrying total tokens, the input, output, and cache buckets, the cache hit rate, the billed call count, and the number of contributing sessions. They share one line with the hero rather than taking a block of their own, so the figures read as the page's header instead of as its content. The day page states the same tiles for its one day, so a day whose caching broke is visible from the page that exists to explain it.

The header's right corner carries two icons beside **Recount**: the rate table, and where the figures come from. Both are consulted rather than read through, so they open on hover and pin on click, and neither takes a block out of the column. They are in the header from the first paint and merely inert until the year's report lands, like **Recount** itself — a control that removes itself for the length of a read is a control the reader reports as missing, and the loading frame around it looks enough like the finished page to be believed.

The calendar is the stable frame: it is Sunday-first with a one-glyph weekday gutter — `日 一 二 三 四 五 六` in Chinese, `S M T W T F S` in English, from the dictionary rather than from a hard-coded set — spans a rolling 52 weeks ending with the current one, and does not change when the range does. Cells are fixed squares whose edge is measured from the panel: while a year of columns fits at the minimum edge they grow to fill it, and below that the grid keeps the minimum edge and drops its oldest weeks, so it never scrolls sideways however narrow the panel gets — including with the sidebar expanded. Cells carry no border; intensity is the only mark on them, and hovering one opens a card with that day's cost, total tokens, input, output, and cache-read tokens, and call count. The card's figures are exact — every digit, grouped the reader's way — because a rounded count is the one thing a drill-down cannot answer.

Shading is a quantile ramp over the window's active days — median, then 75th and 90th percentiles — so the scale adapts to how the profile actually spends rather than assuming a distribution.

Under the calendar, **Spend over time**: one blue swell drawing the shape of the selected range. Its buckets follow the window — **Today** is ten-minute slices, its axis labelled as clock times (Beijing time), **Last 7 days** and **This month** are days, **This quarter** is weeks, and **This year** is months — because drawing a year as 365 hairlines, or a day as 24 bars, is the same mistake in opposite directions. While the fold runs it shows a moving tide rather than the previous range's water, so what is on the chart always belongs to the range named above it. The day page draws it from the same component with the same buckets, over a window of one day. A range switch clears before it loads: the figures go to zero, the axis empties and the swell gives way to the product's own whale, holding the centre with a column of water breathing over its head (under reduced motion the column simply stands), and when the clicked range lands its numbers and its curve arrive together (the tide has a minimum dwell so that a fast fold is not a one-frame flash). The clearing is not decoration — continuing to draw the previous range's series under the new range's bucketing produced a chart belonging to neither. The axis under it names several of those points at a fixed stride, every gap the same width, at the cost of the last bucket sometimes going unnamed — each one a dot on the curve with a plumb line down to the waterline and the figure at that point on hover. Under the figure the same window is listed: **by model** (route, tokens, cost, calls) and then **by project** (working directory, tokens, cost, sessions), eight rows each with the rest counted beneath, and the model table marks the routes that fell back to a default rate. A small whale swims in that water, drawn from the logo's own path (`FISH_LOGO_PATH`) because it is already this curve; it swims only in the stretch of the window that actually spent something (and not at all in an empty one), crossing at a steady speed whatever width that stretch has; under reduced motion it holds still in the water rather than leaving.

### The day page

![One day's page: the day's totals and token buckets, then its spend, tokens and calls split by working directory](https://raw.githubusercontent.com/webxiaobaiyu-droid/dsh-local-usage/main/docs/day.en.png)

*Opening any cell: that day's figures by working directory — and opening a directory shows the sessions that ran there that day.*

Every cell is a button, so the calendar is a way in rather than only a picture of the year. Clicking one opens that day on its own page, and the keyboard reaches the same place: the grid is a single tab stop, the arrow keys walk it, `Home` and `End` jump to the ends of a week, `Enter` opens the focused day, and a screen reader gets each cell's date, cost, token count and call count as its name. The day page **replaces** the panel's contents rather than floating over it, so the calendar is never half-covered behind a card; its back control returns to the calendar and hands focus back to the cell you left from, rather than dropping you at the top of a year you would have to find it in again.

The page states the day's own totals and buckets, then splits them by **working directory**. A directory is what a reader means by a project: a session is created in exactly one, it is what the harness itself groups session logs by on disk, and it is the only axis in this data that answers *what* a day's tokens went to rather than *when* they went. Each row gives a directory's cost, total tokens, output tokens, call count and contributing session count, with the full path under its short name. Sessions whose headers recorded no directory are not dropped — their spend is real — and are collected into a labelled row of their own, so the rows still add up to the day's total. A day with no usage says so rather than rendering an empty table.

Opening a day is not a second read of the logs: it is the same fold narrowed to a one-day window over the samples the Host already holds, which is what lets a cell lead to a whole page instead of a drawn-out fetch.

The ramp's empty step is a visible neutral tile rather than the page background, so a quiet month reads as an empty month instead of as nothing at all. It is a low wash of the text colour mixed into the surface, which is what makes it correct in both themes: no surface token is offset from the page in both, and the one that is (`bg-layer-2`) resolves to the page background itself in the light theme. The first active step stays clearly distinct from it by *hue* — it is blue — which reads at a glance where a lightness step this small would not.

### Language

The panel follows the harness's own language setting; it has no switch of its own. Copy and figures are internationalized separately, because they are two different problems:

- **Copy** is a dictionary. Every user-visible string lives in `src/client/locales.ts`, in both shipped locales, under the `usage` namespace — the panel renders no literal of its own. A `satisfies Record<UsageInsightsLocaleKey, string>` on the English dictionary makes a key present in one locale and missing from the other a compile error, and `tests/locales.client.spec.ts` closes the gap the type system cannot see, by requiring both locales to ask for the same `{name}` placeholders: the locale runtime leaves an unmatched placeholder in place, so a mismatch would render the literal text `{date}` to a reader with no error anywhere. A language pack adding a locale registers a third dictionary and needs no component change.
- **Figures** are not copy, and are formatted in `src/client/format.ts` against the active locale: currency placement, grouping, the decimal mark, the compact scale and date order are properties of the reader's language, not of the sentence wrapped around them. The compact token scale is the clearest case — English counts in K/M/B while Chinese counts in 万/亿, so a Chinese panel reading `214.87M` was an untranslated figure rather than a stylistic one. English output is unchanged by that switch, because `Intl` compact notation resolves to the same K/M/B the hard-coded suffixes used.

Because the Host's report is language-neutral — it carries counts, rates and a day key, never a rendered string — switching language costs one re-render and re-reads nothing. A figure that cannot be formatted as configured degrades instead of failing: an unknown ISO currency code renders as `CODE 0.00`, and a well-formed locale tag no `Intl` data exists for falls back to the default locale's figures.

### What the run cost to get there

Under the calendar, and only when the window recorded something, the panel states its reliability: attempts the provider had to be asked for again, tool calls whose result carried an error, and context compactions that ended in an error — each grouped by the code its producer issued, so a rate limit reads differently from a timeout and a stale file read differs from a failed edit. A window that recorded clean work states nothing at all rather than a spotless record nobody asked about.

It reads as an explanation of the figures above rather than a report of its own: a run fighting rate limits and failing to compact its context is the usual reason a window costs more than its token counts suggest, and the compaction line is the one to look at when cache-read tokens climb.

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `currency` | `CNY` | Currency every figure is expressed in; the plugin performs no conversion. |
| `models` | DeepSeek V4.1 Flash and V4 Pro cards | Rate cards matched against the routed model, first match wins. |
| `fallback` | the Flash card | Rate applied to a route no card matches. |
| `peakWindows` | `09:00-12:00`, `14:00-18:00` | Peak windows in Beijing time; empty disables peak pricing. |
| `peakWeekdaysOnly` | `true` | Whether weekends are always billed off-peak. |
| ``peak` 块（每个模型的高峰价）` | `2` | Multiplier applied to every rate inside a peak window. |
| `warmup` | `true` | Fold the whole corpus in the background at activation, so the first open of the panel is a re-price. |
| `warmupDelayMs` | `4000` | How long after activation that background fold starts, in milliseconds. |

Each rate card states `input`, `cacheRead`, `cacheWrite`, and `output` in currency units per one million tokens, plus the `match` substring that claims a route. The shipped defaults are DeepSeek's published off-peak CNY prices for `deepseek-flash` and `deepseek-v4-pro`; a route served through an aggregator or a reseller must be priced by the operator, and the page names every route that fell back to the default rate instead of implying a figure it cannot support.

**Warming up.** The first read after an install decodes every session log, and that wait used to land on the moment a reader opened the panel. `warmup` runs it in the background shortly after the process starts instead, so the panel's first request finds every fold already in hand and is only a re-price. The window is unbounded because the fold cache keeps every sample a session recorded regardless of the window asked for, so one pass covers every range the panel can select; a machine that is already warm pays only the corpus listing. A request that arrives while that fold is running waits for it rather than decoding the same logs a second time. Set `warmup` to false to read nothing until asked, and pay the read on first open again.

**Pricing a route exactly.** A substring rule is convenient and quietly wrong the moment a route it was never written for contains the substring — `ds123/glm-5.3-flash` is claimed by the `flash` card and billed as DeepSeek Flash. The rate panel lists every route the window recorded, with the rate it was actually priced at and a badge naming the source (a rule, the fallback rate, or your own override), and each of the four prices can be typed over. An override outranks the rules for that exact route, is saved on this machine, and is used by the very next report.

![The rate panel: the pricing formula, the peak schedule, the rate card in effect, and a row per route whose four prices can be typed over](https://raw.githubusercontent.com/webxiaobaiyu-droid/dsh-local-usage/main/docs/rates.en.png)

*The first of the header's two icons: the formula and the rates in effect above, the per-route prices you can correct below.*

```sh
$DSH_HOME/local-usage/pricing.json     # what the editor writes; ~/.dsh by default
```

The file is the only state the *reader* writes. A write goes through `POST /api/dsh-local-usage/pricing` on the same route family the panel reads its report and its progress from, is validated before it is stored, and is persisted through a temporary sibling and a rename, so an interrupted write cannot leave a half-written table behind. **Reset** on a row clears its override and returns the route to its rule. The only durable state the plugin writes for itself is the fold cache described under [The Host fold](#host-fold), which holds samples and counters and never a message body.

### What the money figure is worth

Cost is this plugin's own arithmetic, not a figure read back from a provider: `tokens × configured rate` per bucket, with peak or off-peak decided from each call's own instant. The panel states the formula, the rates actually in effect, and the peak schedule in the header's rate panel, because the ways an estimate can differ from an invoice are exactly what a reader would otherwise assume were included — prepaid credit, package plans, volume discounts, granted balance, aggregator markups and reseller margins are all invisible here. Pricing a route by hand removes the estimate's largest source of error for that route; everything else on that list stays invisible either way. Treat the provider's invoice as authoritative.

### Where the figures come from

The panel states its own provenance in the header's provenance panel: the harness keeps no usage database, so the statistics are folded from the durable session event logs themselves — every session on the host, across all working directories, read through the session query service and replay-validated. That block also names the on-disk shape (`<DSH_HOME>/sessions/<cwd>/<session>/session.v3.jsonl.zstd`), what is left out (a fork's inherited prefix, calls still in flight, unreadable logs), the fact that nothing is uploaded and no external request is made, that the samples it folds are cached on this machine at `<DSH_HOME>/local-usage/fold-cache.json` — samples and counters only, never a message body — and the counts for the read that produced the figures on screen.

### What the figures mean

One sample is produced per **billed settlement**, using the same semantics as the harness's own `tokenUsage` projection: a settlement replaces the earlier sample of the same `(turn, step)` slot, `llm/retry-started` closes that slot so a retried attempt is billed separately, an identical repeat changes nothing, and a settlement that committed no surface message still counts through the usage carried in its embedded stream. The extractor therefore reproduces the persisted projection's totals exactly, which is what the package's verification checks against real logs. `uncachedInputTokens` excludes cache traffic; `cacheReadTokens` and `cacheWriteTokens` count as zero when a provider does not report them. Cost is `tokens × rate` per bucket, priced at each sample's own instant, so a peak boundary inside one day prices the samples on both sides correctly instead of averaging them. Every reliability figure is a count of durable events — `llm/retry` for a repeated attempt, a `tool/result` carrying an `error`, `compaction/start` against a `compaction/end` carrying an `error` — folded per local day and cut by the same window as the samples, which is exact for every day-bounded window the panel asks for. The **cache hit rate** is the share of every prompt token the provider served from cache — `cacheReadTokens ÷ (uncachedInputTokens + cacheReadTokens + cacheWriteTokens)` — so a token written into the cache counts as a miss rather than a hit, and a window that held no prompt tokens states no rate at all rather than a zero.

-----

<a id="troubleshooting"></a>
## Troubleshooting

**The panel opens but reports it cannot read usage data.** The browser half is mounted and the Host half is not, so the route it calls does not exist. The boot output names the cause:

```
dsh: warning: 1 entry did not activate
local-usage (dsh-local-usage): Error: cannot get property "connection" without inject
```

That message means the entry reached the Loader without its `inject` list and died on its first service read; the [Dev Note](#development) covers the one module shape that causes it, and `tests/module-shape.host.spec.ts` guards against it. To confirm a healthy install instead, ask the composed configuration for the row: `dsh --profile <name> --dump-config` prints `# == dsh-local-usage` above `- id: local-usage`.

**The plugin is missing from the plugin list, or the install is refused with `declares no dsh.bundle`.** A package is only installable as a plugin layer when its manifest carries `dsh.bundle.patch` and ships the patch file it names; both are committed here, so a refusal means an older copy of this package was installed — install from this repository again.

**The install fails with `ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF`.** That is the profile's own state rather than this package: its `node_modules` was created by a different pnpm version or linker setting than the one now installing. Run `pnpm install` in the profile directory, then add the plugin again.

**The totals look lower than the provider's invoice.** Three things are excluded by design and counted in the panel's provenance block rather than silently dropped: a fork's inherited prefix, which was billed under its parent; a settlement still streaming, whose usage is not final; and any log that could not be read. Routes that matched no rate card are priced at the fallback rate and named in the warning line.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<a id="host-fold"></a>
### The Host fold

The Host half enumerates sessions through `ctx.sessionQuery.listSessions()`, which reads no event logs, then reads the logs it has not folded yet down one of two paths: the engine's batch projection when the mounted build offers one, and the per-session exact read for a log carrying a fork-inherited prefix, whose length only that read reports. Reading is the expensive half and folding is not, so the cache stores each session's extracted samples — not a finished report — and every call re-prices them against the configuration and the reader's overrides in effect at that moment; changing a price therefore takes effect without re-reading a single log. A session's entry is dropped the moment it records another event, and a request may force a full re-read.

That cache outlives the process. A second cache, keyed by session id *and* the stored log's own change token, is written to `<DSH_HOME>/local-usage/fold-cache.json`: the token is the persistence backend's `revision`, built from the artifact's device, inode, size and nanosecond timestamps, so a fold whose revision still matches is a fold of exactly the bytes on disk and the log is never opened. On the developer's own corpus — 65 sessions, 71 MiB compressed, 51 000 zstd frames, 310 MiB decoded — the cold read costs about 2.3 s of decoding and folding; the cache document is 2.5 MiB and reading it back takes about 4 ms. A revision that has moved, or a log the backend no longer lists, is simply a miss and costs only the read it was written to avoid. Entries whose last recorded activity is older than 400 days are dropped on write, so the file stays bounded by what the panel's 52-week window can still reach; a request reaching further back than the horizon is answered from a fresh read rather than from a cache that may have pruned it. The file holds samples and reliability counters — never message bodies, never prompt text. The cache is optional in both directions: a deployment that mounts no persistence backend gets no revisions, so nothing is reused and the panel behaves exactly as it did before the cache existed.

Beyond its rows by day, route, directory and session, the report carries three readings folded from the same samples: what the peak schedule cost and what its multiplier added as a premium; what caching saved, priced as the difference between the input rate and the cache-read rate; and the window's shape by hour of the day in Beijing time. One optional field goes further: `?compare=1` folds the equal-length window immediately before the requested one and returns its totals — the fold does not depend on the window, so that is a re-price rather than a second read.

Three routes reach that fold: `GET /api/dsh-local-usage/report` answers with a report for a window, `GET /api/dsh-local-usage/progress` answers with what a read in flight is doing, and `POST /api/dsh-local-usage/pricing` writes the per-route override table. The write is validated field by field before it is stored, because the file it lands in is what every later report is priced with. Progress is a separate route rather than a streamed report because the report is one JSON document the browser parses whole, and a carrier that buffered a streamed body would lose exactly the progress it was streaming.

A forked session's log begins with its parent's inherited prefix and those turns were already billed under the parent, so only the events at or after the snapshot's `inheritedEventCount` are folded. Session titles are folded from the complete log, inherited prefix included, because a title is a fact about the conversation rather than about its billing.

### The page

The browser half contributes a global panel: one `sidebar.panellist` entry sharing its id with one `main` keyed-slot occupant, so the sidebar owns the button and the frame owns the column. Because a global panel is retained rather than remounted, the panel reads `usePanelInfo` and only reads logs while it is the selected one. It reaches the Host over the one Fetch route the Host half registers, so this half holds no fold logic and no pricing — and the package needs no place in the product's Remote assembly. There is no charting library in this product and adding one is out of bounds, so the calendar is a CSS grid of cells shaded with `color-mix` over a semantic theme token.

The day page is the panel's own second view, not a route: the panel holds the open day and fetches that day's report over the same route with a one-day window, which the Host answers by re-pricing the samples it already cached. The day's report is held in its own state so a slow fold never blanks the calendar behind it, and the per-directory rows the page renders are folded by the same function that folds the year — the only difference between the two is the window.

The locale reaches the panel through the plugin's own injected face rather than a second subscription: the renderer re-derives each entry's dictionary function from the locale revision, so a language switch already re-renders the panel, and the injected `locale()` reading the service during render is therefore always the id the dictionary beside it was resolved from. Formatters are cached per `(locale, currency, digits)` and a rejected construction is cached as absent, which is what keeps a misconfigured currency code from throwing on every render.

-----

<a id="further-exploration"></a>
## Further Exploration

The subsystems below are DeepSeek Harness packages this one reads from, mirrors, or installs through. Each link points into the harness repository, because this package ships standalone and no longer sits inside that tree.

- [Session query](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session-query/session-query/README.md) — the cold-read engine the Host half enumerates and reads through.
- [Token meter](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/token-meter/README.md) — the durable `tokenUsage` projection whose settlement and retry semantics this package's extractor mirrors.
- [Session projection cache](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/session/session-projection-cache/README.md) — the durable per-session projection store, the zero-I/O alternative to reading logs.
- [Package and install a plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md) — the bundle and profile model this package installs through.

<a id="model-experience"></a>
## Model Experience

None, as the package reads durable session logs and renders a browser page; it adds no model-visible content and makes no model call.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define what the page can report; they are current package constraints.

- **Prices are configuration, not billing** — the harness records tokens and never currency, so every money figure is `tokens × configured rate`; a route with no matching card is priced at the fallback rate and named in the page's warning line rather than silently estimated.
- **An override names one route, exactly** — the editor keys on the `provider/model` string the log recorded, so an aggregator that renames a route needs a new entry, and there is no wildcard form. The editor lists the routes *the year the calendar already read* recorded; an override for a route that has stopped being used stays in `pricing.json` and comes back the next time the route appears. A window that recorded no routes at all keeps the section and says so, rather than leaving a reader to wonder whether the feature is still there.
- **The rate editor is not a price list you can plan from** — it edits what this machine bills at, and it is deliberately add-free: there is no way to declare a route that has never been used, and no place to keep a provider's catalogue.
- **Chinese public holidays are not modelled** — peak windows follow the published Beijing-time schedule for Monday through Friday, so a holiday weekday inside a window is billed at the peak rate.
- **Two locales are shipped** — Chinese and English. A third language registered by a language pack resolves key-by-key through English, so it renders an English sentence until that pack also registers a `usage` dictionary. Copy is bilingual; the figures are not, because a locale with no `Intl` data behind it silently renders the default locale's numbers.
- **The language is the harness's, not the panel's** — there is no per-panel language selection. A reader who wants Chinese figures on an English harness has to change the harness's language, which changes every surface rather than this one.
- **A settlement still streaming contributes nothing** — its usage is not final and a later settlement may replace it, so the newest exchange of a running session appears only once it settles.
- **Inherited fork prefixes are excluded by design** — a forked session reports only the spend it caused itself, so per-session figures cannot be summed to reconstruct what a parent conversation cost in total.
- **The calendar shows one rolling window only** — a deployment that needs an arbitrary date range has no control for it yet, because the panel fixes the frame at mount.
- **A project is a working directory, not a repository** — spend is attributed to the directory a session was created in, so two checkouts of one repository are two rows, and a session stays with the directory it started in even if it moved. The day page opens a directory onto the sessions that ran there that day, and goes no deeper: a single request is a resolution the folded samples do not carry.
- **The report carries two rows no surface draws yet** — the weighted route ranking was taken off the page, and the per-route and per-session rows stay in the wire contract. Both are by-products of a fold the Host already runs, so a surface that wants them needs no new pass over the logs.
- **The fold cache trades disk for a cold read, and only that** — it is keyed by the stored log's revision, so a stale figure is not a failure mode it has; a cache that cannot be written, read or understood costs the next start the read it was meant to save and nothing else. What it does not do is bound the *first* read: the first session on a machine that has never folded anything still pays for the whole corpus, and so does **Recount**.
- **Retention drops what the panel can no longer ask for** — entries whose last recorded activity is more than 400 days old are removed on write, because the calendar spans 52 weeks and no range reaches past a year. A session that recorded nothing at all is undatable and is kept, since it is a couple of hundred bytes and it is exactly the entry that saves a read.

<a id="dev-note"></a>
<a id="development"></a>
## Development

### Prerequisites

Node 22 and pnpm, plus a **DeepSeek Harness source checkout**. The `@deepseek-ai/*` packages this plugin compiles and tests against are workspace packages of the harness: the release candidates on npm resolve `@deepseek-ai/dsh-type-meta`, which is not on the registry, so a checkout is the only way to obtain them.

```sh
pnpm install
pnpm run link:host -- --src /path/to/deepseek-harness
# or: DSH_SRC=/path/to/deepseek-harness pnpm run link:host
```

`link:host` points this repo's `node_modules/@deepseek-ai/*` at that checkout — the harness version it linked from is printed — and its list of packages lives in `scripts/link-host-packages.mjs`. Add an entry there when a new host import appears. The links are development-only state: nothing about them is committed, and `lib/` resolves the same packages from the host process at runtime.

### Commands

| Command | What it does |
|---|---|
| `pnpm test` | the vitest suites of both halves |
| `pnpm run typecheck` | typechecks the two halves as two programs |
| `pnpm run build` | bundles `lib/*.js`, then emits `lib/types` |
| `pnpm run watch` | rebuilds the bundles only, for a reload loop |

There is deliberately **no `prepare` script**. `lib/` is committed, and a build script on a git dependency is exactly what forces every installer to grant the package permission to execute code at install time; dropping it is what lets an install use the committed artifact and ask for nothing. Run `pnpm run build` yourself after changing `src/` and commit the result.

### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The Host half and the browser half each merge the Cordis `Context` under the same keys with different services, so **one TypeScript program cannot see both**; the harness splits its own typecheck for the same reason. `tsconfig.host.json` and `tsconfig.client.json` are the two programs used by `typecheck` and by editors, and `tsconfig.host.build.json` / `tsconfig.client.build.json` are their narrow descendants that emit declarations to `lib/types` — the layout `package.json`'s `exports` points at, and the layout the harness uses for its own client packages (`rootDir: src`, `outDir: lib/types`). Each half globs its own files (`src/*.ts` and `tests/*.host.spec.ts` against `src/client/**/*` and `tests/*.client.spec.ts`) rather than listing them: a hand-kept list is how a new module ends up shipping unchecked, which is what the split exists to prevent.

Two consequences follow:

- `tsdown` bundles the JavaScript only, from the shared `tsconfig.json`. Its `dts` is off in both halves: declarations emitted there would wrap the browser bundle's module-loader banner and footer into the declaration file and break parsing, which is why the harness's own client preset disables it too.
- Declarations exist only after `pnpm run build` (or `pnpm run build:types`), and they are committed along with the bundles because the package is distributed from git — a `lib/` built by `tsdown` alone would leave the `types` conditions in `exports` dangling.

`tsc` is invoked through the repo's own script rather than `tsc -b`: this package is out of the harness's project-reference graph, so it compiles against the checkout's built declaration files instead of its project graph.

Both halves export **named members only** — never `export default apply`. A module with a default export is mounted by that default, so the plugin arrives without the module's `name` and `inject`: the fiber activates with an empty inject list, the entry dies on its first service read with `cannot get property "…" without inject`, and the panel then has no route to read from. `tests/module-shape.host.spec.ts` guards both halves against it.

</details>

**Runtime invariant:** The Host half owns three HTTP routes — the folded report, the progress of a read in flight, and the rate-table write — plus two sample caches: one in memory keyed by session id, one on disk keyed by session id and the stored log's revision. The browser half registers one localized sidebar entry and the matching `main` panel, and reaches the Host only over those routes. No companion is published, and neither half emits a Cordis event of its own.
