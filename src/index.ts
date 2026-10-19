/**
 * Usage statistics Host half: the session fold and the HTTP route that serves it.
 *
 * This plugin is self-contained on purpose. A Typert Remote namespace would be
 * tidier, but it only reaches the browser when the product's own Remote
 * assembly mounts it, and that list lives inside the harness repository — which
 * would make this package impossible to install on its own. A registered Fetch
 * route costs a little plumbing and buys a plugin any deployment can load by
 * path.
 *
 * Reading a log is the expensive half and folding it is not, so the cache keeps
 * each session's extracted samples rather than a finished report, and every
 * request re-prices them against the current configuration.
 *
 * @module dsh-local-usage
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: activates the `ctx.sessionQuery` Context declaration, and names the
// engine the batch read is read off.
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
// Type-only: activates the optional `ctx.sessionPersistence` declaration, whose
// per-log revision is what makes a stored fold reusable across a restart.
import type {} from '@deepseek-ai/dsh-session-persistence'
import { foldSessionTitle } from '@deepseek-ai/dsh-session-title'
import { buildReport, reliabilityOf, reliabilityWithin, samplesOf } from './aggregate.ts'
import type { PricingOptions, ReliabilityDay, SessionUsageInput, UsageSample } from './aggregate.ts'
import { createFoldCache, foldCacheFilePath } from './fold-cache.ts'
import type { FoldCache } from './fold-cache.ts'
import { parsePeakWindow } from './pricing.ts'
import type { ModelPrice, PeakWindow, PriceRate } from './pricing.ts'
import { createProgressTracker } from './progress.ts'
import type { ProgressTracker } from './progress.ts'
import { createRateStore, pricingFilePath, readModelEdit, resolveDshHome } from './rates.ts'
import type { RateStore } from './rates.ts'
import type { UsageInsightsReport, UsageModelEdit, UsagePricingUpdate } from './types.ts'

export type * from './types.ts'

/** Exact route the browser half calls; it sits behind the carrier's trust fence. */
export const REPORT_PATH = '/api/dsh-local-usage/report'

/** Exact route the browser half writes the per-route rate table to. */
export const PRICING_PATH = '/api/dsh-local-usage/pricing'

/**
 * Exact route the browser half polls while a report is being assembled.
 *
 * A separate route rather than a streamed report: the report is one JSON
 * document the browser parses whole, and a carrier that buffered a streamed body
 * would lose exactly the progress it was streaming.
 */
export const PROGRESS_PATH = '/api/dsh-local-usage/progress'

/**
 * Session logs folded concurrently by the exact-read path.
 *
 * Only the sessions that cannot take the batch projection come through here, so
 * this bounds an exceptional path rather than the common one. Raising it would
 * not help anyway: decoding and parsing a log are synchronous, and the fold that
 * consumes them is already the smaller half of the cost.
 */
const READ_CONCURRENCY = 4

/** Plugin name the loader row addresses. */
export const name = 'dsh-local-usage'

/** Services this plugin cannot work without: the carrier's route registry and the session reads. */
export const inject = ['connection', 'sessionQuery']

/** One set of prices, in currency units per one million tokens. */
export interface UsageInsightsPriceConfig {
  /** Cache-miss prompt tokens. */
  input: number
  /** Cache-hit prompt tokens. */
  cacheRead: number
  /** Cache-write prompt tokens; providers without a separate write charge repeat `input`. */
  cacheWrite: number
  /** Generated tokens. */
  output: number
}

/**
 * One model's prices, with the prices it charges inside a peak window.
 *
 * The four numbers are the price outside a peak window — and the only price of a
 * model that does not state a `peak` block, which is how a flat-priced model is
 * written. Costing the same all day means leaving `peak` out, not setting a
 * multiplier to one.
 */
export interface UsageInsightsModelConfig extends UsageInsightsPriceConfig {
  /** Case-insensitive substring matched against `provider/model`; the first match wins. */
  match: string
  /** Prices inside a configured peak window; absent means the model is flat-priced. */
  peak?: UsageInsightsPriceConfig
}

/** The card that prices a route no model claims; it may price peak separately too. */
export type UsageInsightsFallbackConfig = UsageInsightsPriceConfig & {
  /** Prices inside a configured peak window; absent means the fallback is flat-priced. */
  readonly peak?: UsageInsightsPriceConfig
}

/** Plugin configuration; every field has a default, so the plugin mounts bare. */
export interface UsageInsightsConfig {
  /** Currency every cost figure is expressed in; the plugin performs no conversion. */
  currency: string
  /** Configured rate cards, matched in order. */
  models: UsageInsightsModelConfig[]
  /** Card used by a route no model matches. */
  fallback: UsageInsightsFallbackConfig
  /** Peak windows as `HH:MM-HH:MM` in Beijing time. */
  peakWindows: string[]
  /** When true, Saturday and Sunday are never peak. */
  peakWeekdaysOnly: boolean
  /**
   * Whether to fold the corpus in the background once the process is up.
   *
   * The first read after an install decodes every session log there is, and the
   * reader pays for it while looking at a loading frame. Doing that read at
   * activation moves the cost to a moment nobody is waiting on, so the first
   * request the panel makes is a re-price over folds already in hand. A
   * deployment with a very large corpus, or one that would rather read nothing
   * until it is asked, can turn it off and pay the read on first open instead.
   */
  warmup: boolean
  /** How long after activation the background fold starts, in milliseconds. */
  warmupDelayMs: number
}

/** The published off-peak DeepSeek-V4.1-Flash card, in CNY per one million tokens. */
const FLASH_RATE: UsageInsightsPriceConfig = { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 }
/** The same model inside its peak windows; stated, not derived from the off-peak card. */
const FLASH_PEAK: UsageInsightsPriceConfig = { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 }

/**
 * Shipped defaults: DeepSeek's published off-peak CNY prices. A route served
 * through an aggregator or a reseller has to be priced by the operator, and the
 * panel names every route that fell back to the default rather than implying a
 * figure it cannot support.
 */
export const DEFAULT_CONFIG: UsageInsightsConfig = {
  currency: 'CNY',
  models: [
    {
      match: 'v4-pro',
      input: 4.5,
      cacheRead: 0.15,
      cacheWrite: 4.5,
      output: 13.5,
      peak: { input: 9, cacheRead: 0.3, cacheWrite: 9, output: 27 },
    },
    { match: 'flash', ...FLASH_RATE, peak: FLASH_PEAK },
  ],
  fallback: { ...FLASH_RATE, peak: FLASH_PEAK },
  peakWindows: ['09:00-12:00', '14:00-18:00'],
  peakWeekdaysOnly: true,
  warmup: true,
  // Long enough that the fold does not compete with the rest of the boot, short
  // enough that it is usually done before the reader opens the panel.
  warmupDelayMs: 4_000,
}

/** One cached session fold: the samples, the reliability counters, and the identity facts. */
interface CachedSession {
  readonly samples: readonly UsageSample[]
  /**
   * Reliability counters by local day, over the same prefix the samples cover.
   *
   * Folded here rather than per request so a window change re-cuts the cache the
   * way it re-cuts samples, and a fork's inherited prefix is excluded exactly as
   * it is for samples: those retries and failed tools were the parent's.
   */
  readonly reliability: readonly ReliabilityDay[]
  readonly title?: string
  readonly cwd?: string
  readonly createdAt: number
}

/** Everything one session's fold reads out of its log. */
interface SessionFoldSource {
  /** The durable log, in seq order, including any fork-inherited prefix. */
  readonly events: readonly SessionEvent[]
  /** Header creation time, repeated onto the report row. */
  readonly createdAt: number
  /** Header working directory, or `undefined` when it carries none. */
  readonly cwd?: string
  /**
   * Count of leading events a fork inherited from its parent.
   *
   * A forked log replays its parent's prefix and those turns were already billed
   * under the parent, so the sample fold starts after them. The title fold does
   * not: a fork that never named itself is still titled by the log it grew out
   * of, which is what the harness's own projection does.
   */
  readonly skipBefore: number
}

/**
 * Fold one session's raw log into the shape the cache keeps.
 *
 * Deliberately pure and shared by both read paths, so the batch projection and
 * the exact read cannot drift apart in what they count.
 *
 * @param source - the log, its header facts, and the prefix to skip.
 * @returns the samples plus the identity facts the report repeats.
 */
function foldSession(source: SessionFoldSource): CachedSession {
  const own = source.events.filter(event => event.seq >= source.skipBefore)
  const samples = samplesOf(own)
  const reliability = reliabilityOf(own)
  const title = foldSessionTitle(source.events)?.title
  return {
    samples,
    reliability,
    createdAt: source.createdAt,
    ...title === undefined || title.length === 0 ? {} : { title },
    ...source.cwd === undefined ? {} : { cwd: source.cwd },
  }
}

/** The reports row a fold contributes to one request's window. */
function sessionInputOf(
  sessionId: string,
  entry: CachedSession,
  request: { readonly from: number | undefined; readonly to: number | undefined },
): SessionUsageInput {
  return {
    sessionId,
    createdAt: entry.createdAt,
    samples: withinRange(entry.samples, request.from, request.to),
    reliability: reliabilityWithin(entry.reliability, request.from, request.to),
    ...titleFields(entry),
  }
}

/** One session's batch projection outcome, as the engine reports it. */
type BatchOutcome<Value> =
  | { readonly sessionId: SessionId; readonly status: 'fulfilled'; readonly value: Value }
  | { readonly sessionId: SessionId; readonly status: 'rejected'; readonly reason: unknown }

/** The engine's batch projection, named off its own declaration so the two agree. */
type BatchProjection = <Value>(
  sessionIds: readonly SessionId[],
  project: (source: {
    readonly header: { readonly createdAt: number; readonly cwd?: string }
    readonly events: readonly SessionEvent[]
  }) => Value,
  signal?: AbortSignal,
) => Promise<readonly BatchOutcome<Value>[]>

/**
 * Read the engine's batch projection, when the mounted build has one.
 *
 * Read reflectively rather than called straight through: a harness whose engine
 * predates the projection would otherwise throw here and take the whole route
 * with it. Declared structurally, like {@link UsageInsightsConnection}, so this
 * package carries no dependency on the module that provides the service.
 *
 * The win is not concurrency, which the fold does not use: it is that this path
 * hands the fold the log as the reader already holds it, while the exact read
 * deep-clones every event — including the message bodies and tool results the
 * fold never looks at — and replay-validates the log by building a Session from
 * it. On a real corpus that clone is about a third of the whole cold read.
 *
 * @param engine - the mounted session query engine.
 * @returns the bound projection, or `undefined` when this build has none.
 */
function batchProjectionOf(engine: SessionQueryEngine): BatchProjection | undefined {
  const candidate: unknown = Reflect.get(engine, 'projectMany')
  return typeof candidate === 'function'
    ? (candidate as BatchProjection).bind(engine)
    : undefined
}

/** Merge a caller's configuration over the shipped defaults. */
function resolveConfig(config: UsageInsightsConfig): UsageInsightsConfig {
  return {
    currency: config.currency ?? DEFAULT_CONFIG.currency,
    models: config.models ?? DEFAULT_CONFIG.models,
    fallback: config.fallback ?? DEFAULT_CONFIG.fallback,
    peakWindows: config.peakWindows ?? DEFAULT_CONFIG.peakWindows,
    peakWeekdaysOnly: config.peakWeekdaysOnly ?? DEFAULT_CONFIG.peakWeekdaysOnly,
    warmup: config.warmup ?? DEFAULT_CONFIG.warmup,
    warmupDelayMs: config.warmupDelayMs ?? DEFAULT_CONFIG.warmupDelayMs,
  }
}

/** Run one async mapper over items with a fixed number of workers. */
async function mapBounded<T, R>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      // oxlint-disable-next-line typescript/no-non-null-assertion -- index is inside the array
      results[index] = await map(items[index]!)
    }
  })
  await Promise.all(workers)
  return results
}

/** Keep only the samples inside the requested window. */
function withinRange(
  samples: readonly UsageSample[],
  from: number | undefined,
  to: number | undefined,
): readonly UsageSample[] {
  if (from === undefined && to === undefined) return samples
  return samples.filter(sample =>
    (from === undefined || sample.time >= from) && (to === undefined || sample.time <= to))
}

/** Optional title/cwd carried onto a report row. */
function titleFields(entry: { title?: string; cwd?: string }): { title?: string; cwd?: string } {
  return {
    ...entry.title === undefined ? {} : { title: entry.title },
    ...entry.cwd === undefined ? {} : { cwd: entry.cwd },
  }
}

/** Parse one optional finite query parameter. */
function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key)
  if (raw === null) return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

/** A session log this read has to fold. */
interface PendingSession {
  readonly id: SessionId
  /** Whether the log carries a fork-inherited prefix, which the batch read cannot skip. */
  readonly seeded: boolean
  /**
   * Revision of the stored log this read folds, when one is known.
   *
   * Present only for a fold the durable cache may keep: a live session is folded
   * from the events in memory, so storing that fold under the revision of a log
   * that may lag behind it would be a claim the next process would believe.
   */
  readonly revision?: string
}

/** A session the in-memory cache cannot answer for. */
interface NeedySession {
  readonly id: SessionId
  readonly seeded: boolean
  /** Whether the events currently live in this process are the truth for this session. */
  readonly live: boolean
}

/** One stored session's change token, as the persistence service reports it. */
interface StoredRevision {
  readonly header: { readonly id: SessionId }
  readonly revision: string
}

/**
 * The one persistence read this plugin makes, declared structurally.
 *
 * The harness's own `SessionPersistence` service declares `ctx.sessionPersistence`
 * with a much wider surface — open, create, resume — and none of it matters here.
 * Naming only the listing keeps this package free of a runtime dependency on the
 * backend that provides it, exactly as the route registrar is.
 */
interface UsageInsightsPersistence {
  list(options?: { readonly signal?: AbortSignal }): Promise<readonly StoredRevision[]>
}

/**
 * The change token of every stored log, or an empty map when none can be had.
 *
 * A backend that is absent, or a listing that fails, costs this plugin the
 * durable cache and nothing else: every session then takes the read path it took
 * before that cache existed, and the report is still complete.
 *
 * @param ctx - host context, read for the optional persistence service.
 * @returns session id to stored-log revision.
 */
async function storedRevisions(ctx: Context): Promise<ReadonlyMap<string, string>> {
  try {
    // `ctx.get` reads a service without declaring a dependency on it, which is
    // what keeps the durable cache optional: a deployment that mounts no
    // persistence backend still mounts this panel.
    const persistence = ctx.get('sessionPersistence') as UsageInsightsPersistence | undefined
    if (persistence === undefined || typeof persistence.list !== 'function') return new Map()
    const snapshots = await persistence.list()
    const revisions = new Map<string, string>()
    for (const snapshot of snapshots) revisions.set(String(snapshot.header.id), snapshot.revision)
    return revisions
  } catch (error: unknown) {
    ctx.logger.warn(`dsh-local-usage: stored-log listing failed: ${describe(error)}`)
    return new Map()
  }
}

/**
 * Build the priced report over every readable session log.
 *
 * Two read paths, one fold. Sessions whose log carries no inherited prefix go
 * through the engine's batch projection, which hands the fold the events as the
 * reader already holds them. Everything else — a seeded log, whose prefix length
 * only the exact read reports, and every session when the mounted engine has no
 * batch projection at all — takes the per-session read.
 *
 * A session neither path has to touch is the point of the durable cache: when the
 * stored log still carries the revision a previous process folded, that fold is
 * reused and the log is never opened.
 *
 * @param ctx - host context carrying the session query engine.
 * @param cache - the in-memory fold cache, keyed by session id.
 * @param folds - the durable fold cache, keyed by session id and log revision.
 * @param progress - publishes how far this read has got.
 * @param config - resolved plugin configuration.
 * @param rates - the reader's price edits.
 * @param request - the window to fold and whether to discard the caches first.
 * @returns the complete priced report.
 */
async function assembleReport(
  ctx: Context,
  cache: Map<string, CachedSession>,
  folds: FoldCache,
  progress: ProgressTracker,
  config: UsageInsightsConfig,
  rates: RateStore,
  request: { refresh: boolean; from: number | undefined; to: number | undefined },
): Promise<UsageInsightsReport> {
  progress.begin()
  try {
    // A refresh means what it says: every log is read again, so the durable
    // entries are bypassed rather than merely overwritten.
    if (request.refresh) cache.clear()

    const records = await ctx.sessionQuery.listSessions()
    // Every session that contributed, with the fold it contributed from. Kept as
    // pairs rather than as finished inputs because a window is a filter over
    // these folds: deriving a second one — the window before this — costs a
    // re-price, not a second read.
    const contributors: Contributor[] = []
    const needy: NeedySession[] = []
    for (const record of records) {
      const id = String(record.header.id)
      const hit = cache.get(id)
      if (hit !== undefined) {
        contributors.push({ id, fold: hit })
        continue
      }
      needy.push({ id: id as SessionId, seeded: record.header.isSeeded, live: record.live })
    }

    // Revisions turn the durable cache into a lookup: the same token means the
    // bytes on disk are the ones that entry was folded from. They are read even
    // for a refresh, which bypasses the lookup but still has to replace the entry
    // it is re-reading past.
    const asking = needy.some(entry => !entry.live)
    const revisions = asking ? await storedRevisions(ctx) : new Map<string, string>()
    const pending: PendingSession[] = []
    for (const entry of needy) {
      const revision = entry.live ? undefined : revisions.get(entry.id)
      if (revision === undefined) {
        pending.push({ id: entry.id, seeded: entry.seeded })
        continue
      }
      const stored = request.refresh ? undefined : folds.read(entry.id, revision, request.from)
      if (stored === undefined) {
        pending.push({ id: entry.id, seeded: entry.seeded, revision })
        continue
      }
      cache.set(entry.id, stored)
      contributors.push({ id: entry.id, fold: stored })
    }

    // Every log that still has to be read is one step of this read's progress,
    // so the count the panel shows is the work it is actually waiting on.
    progress.plan(pending.length)

    const cached = pending.length === 0
    const batch = batchProjectionOf(ctx.sessionQuery)
    const batchable = batch === undefined ? [] : pending.filter(entry => !entry.seeded)
    const exact = batch === undefined ? pending : pending.filter(entry => entry.seeded)

    let unreadable = 0

    if (batch !== undefined && batchable.length > 0) {
      // The projection is synchronous and must own everything it keeps. The fold
      // satisfies that by reading primitives off the events and building fresh
      // sample objects, so nothing here aliases the borrowed log.
      const results = await batch(batchable.map(entry => entry.id), source => {
        const fold = foldSession({
          events: source.events,
          createdAt: source.header.createdAt,
          ...source.header.cwd === undefined ? {} : { cwd: source.header.cwd },
          // Reached only for a log with no inherited prefix, by construction above.
          skipBefore: 0,
        })
        // Counted inside the projector because that is where a session's fold
        // actually completes; the projection reports back only when all of them have.
        progress.advance()
        return fold
      })
      const byId = new Map<string, BatchOutcome<CachedSession>>()
      for (const outcome of results) byId.set(String(outcome.sessionId), outcome)
      for (const entry of batchable) {
        const outcome = byId.get(entry.id)
        if (outcome === undefined || outcome.status === 'rejected') {
          unreadable += 1
          continue
        }
        cache.set(entry.id, outcome.value)
        if (entry.revision !== undefined) folds.write(entry.id, entry.revision, outcome.value)
        contributors.push({ id: entry.id, fold: outcome.value })
      }
    }

    if (exact.length > 0) {
      const folded = await mapBounded(exact, READ_CONCURRENCY, async (entry) => {
        try {
          const snapshot = await ctx.sessionQuery.readSession(entry.id)
          return foldSession({
            events: snapshot.events,
            createdAt: snapshot.session.createdAt,
            ...snapshot.session.cwd === undefined ? {} : { cwd: snapshot.session.cwd },
            // A forked session's log begins with the parent's inherited prefix, and
            // those turns were already billed under the parent. Only the events this
            // session owns are its own spend.
            skipBefore: snapshot.inheritedEventCount,
          })
        } catch {
          return undefined
        } finally {
          progress.advance()
        }
      })
      for (let index = 0; index < folded.length; index += 1) {
        const value = folded[index]
        const entry = exact[index]
        if (value === undefined || entry === undefined) {
          unreadable += 1
          continue
        }
        cache.set(entry.id, value)
        if (entry.revision !== undefined) folds.write(entry.id, entry.revision, value)
        contributors.push({ id: entry.id, fold: value })
      }
    }

    progress.pricing()
    // Every contributor in the requested window: the one place a window becomes
    // the inputs a fold prices.
    const inputs = contributors.map(({ id, fold }) => sessionInputOf(id, fold, request))
    const report = buildReport(inputs, pricingOptions(config, rates), {
      generatedAt: Date.now(),
      unreadableSessions: unreadable,
      cached,
    })
    // Awaited, so the read this report just paid for survives a process that
    // dies before the next one starts. It is one write of a file the size of the
    // samples, only ever on a read that touched a log, and the panel is already
    // waiting on that read; a disk that refuses it costs the next cold start and
    // never this report.
    try {
      await folds.flush()
    } catch (error: unknown) {
      ctx.logger.warn(`dsh-local-usage: fold cache write failed: ${describe(error)}`)
    }
    return report
  } finally {
    progress.finish()
  }
}

/** One session that contributed to a window, with the fold it contributed from. */
interface Contributor {
  readonly id: string
  readonly fold: CachedSession
}



/** One line describing an error, for a log line. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}


/** One configured card as the pricing engine reads it. */
function cardOf(
  config: UsageInsightsPriceConfig & { readonly peak?: UsageInsightsPriceConfig },
  match: string,
): ModelPrice {
  const offPeak: PriceRate = {
    input: config.input,
    cacheRead: config.cacheRead,
    cacheWrite: config.cacheWrite,
    output: config.output,
  }
  return config.peak === undefined
    ? { match, peakEnabled: false, peak: { ...offPeak }, offPeak }
    : { match, peakEnabled: true, peak: { ...config.peak }, offPeak }
}

/**
 * Resolve the model cards, the reader's edits, and the peak schedule.
 *
 * The reader's stored edits are applied over the configured cards by model name:
 * an edit is a change to the card, not a second card, so a model that arrives
 * from configuration and one the reader has corrected are the same card in the
 * report and in the editor.
 *
 * @param config - the merged plugin configuration.
 * @param rates - the store of the reader's edits.
 * @returns the options one fold prices with.
 */
function pricingOptions(config: UsageInsightsConfig, rates: RateStore): PricingOptions {
  const windows: PeakWindow[] = []
  for (const spec of config.peakWindows) {
    const window = parsePeakWindow(spec)
    if (window !== undefined) windows.push(window)
  }
  const edits = rates.read()
  const models: ModelPrice[] = config.models.map(model => {
    const card = cardOf(model, model.match)
    const edit = edits.get(card.match)
    return edit === undefined ? card : { match: card.match, ...edit }
  })
  // An edit for a model the configuration does not name is still an edit, and it
  // claims its own routes: this is what makes a migrated per-route price take
  // effect, and what lets a reader price a model that ships without a card.
  const named = new Set(models.map(card => card.match))
  for (const [match, edit] of edits) {
    if (match.length > 0 && !named.has(match)) models.push({ match, ...edit })
  }
  const configured = cardOf(config.fallback, '')
  const fallbackEdit = edits.get('')
  const fallback: ModelPrice = fallbackEdit === undefined
    ? configured
    : { match: '', ...fallbackEdit }
  return {
    currency: config.currency,
    models,
    fallback,
    peakWindows: windows,
    peakWeekdaysOnly: config.peakWeekdaysOnly,
  }
}

/** Answer one report request with JSON, or a described failure. */
async function handleReport(
  ctx: Context,
  cache: Map<string, CachedSession>,
  folds: FoldCache,
  progress: ProgressTracker,
  config: UsageInsightsConfig,
  rates: RateStore,
  request: Request,
  background: () => Promise<void> | undefined,
): Promise<Response> {
  const url = new URL(request.url)
  try {
    // A background fold already reading this corpus is the same work this
    // request needs, so the request waits for it rather than decoding every log
    // a second time: two reads in flight together would each see an empty cache
    // and each walk the whole corpus.
    const pending = background()
    if (pending !== undefined) await pending
    const report = await assembleReport(ctx, cache, folds, progress, config, rates, {
      refresh: url.searchParams.get('refresh') === '1',
      from: numberParam(url.searchParams, 'from'),
      to: numberParam(url.searchParams, 'to'),
    })
    return Response.json(report, { headers: { 'cache-control': 'no-store' } })
  } catch (error: unknown) {
    const message = describe(error)
    ctx.logger.warn(`dsh-local-usage: report failed: ${message}`)
    return Response.json({ error: message }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}

/**
 * Read one pricing write off an untrusted body.
 *
 * Every rate is validated before it reaches the store, so a malformed request
 * costs a 400 rather than a poisoned table: this file is what every later report
 * is priced with.
 *
 * @param value - the parsed request body.
 * @returns the update to apply, or `undefined` when the body is not one.
 */
function parsePricingUpdate(value: unknown): UsagePricingUpdate | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const models = (value as { models?: unknown }).models
  if (typeof models !== 'object' || models === null) return undefined
  const parsed: Record<string, UsageModelEdit | null> = {}
  for (const [match, candidate] of Object.entries(models as Record<string, unknown>)) {
    if (candidate === null) {
      parsed[match] = null
      continue
    }
    const edit = readModelEdit(candidate)
    if (edit === undefined) return undefined
    parsed[match] = edit
  }
  return { models: parsed }
}

/** Answer one rate-table write with the table now in effect. */
async function handlePricing(
  ctx: Context,
  rates: RateStore,
  request: Request,
): Promise<Response> {
  const headers = { 'cache-control': 'no-store' }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'expected a JSON body' }, { status: 400, headers })
  }
  const update = parsePricingUpdate(body)
  if (update === undefined) {
    return Response.json(
      { error: 'expected { set: { "<route>": {input, cacheRead, cacheWrite, output} | null } }' },
      { status: 400, headers },
    )
  }
  try {
    const models = await rates.write(update)
    return Response.json({ models }, { headers })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.logger.warn(`dsh-local-usage: pricing write failed: ${message}`)
    return Response.json({ error: message }, { status: 500, headers })
  }
}

/**
 * The one route-registration face of `ctx.connection`.
 *
 * This plugin reaches the Fetch carrier through a local structural type rather
 * than the Context augmentation: the host's Context declares no `connection`
 * member, so the harness's own route registrars read it with a cast (see
 * `session-log-export`). Keeping the shape here also means the plugin carries no
 * dependency on the package that provides the service.
 */
interface UsageInsightsConnection {
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
      readonly requestBody: 'buffered'
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
  }
}

/** Read the Fetch carrier off the Host context. */
function connectionOf(ctx: Context): UsageInsightsConnection {
  return Reflect.get(ctx, 'connection') as UsageInsightsConnection
}

/**
 * Register the report route.
 *
 * Deliberately a named export with no default: the Loader takes a module's
 * default export when it has one, and a default that is the bare `apply`
 * function is a plugin *without* this module's `name` and `inject` — the fiber
 * then activates with an empty inject list and the first service read throws
 * "cannot get property … without inject".
 *
 * @param ctx - Host context carrying the carrier and the session query engine.
 * @param config - plugin configuration; omitted fields keep their defaults.
 */
export function apply(ctx: Context, config: UsageInsightsConfig = DEFAULT_CONFIG): void {
  const resolved = resolveConfig(config)
  const cache = new Map<string, CachedSession>()
  // The reader's own rate corrections, hydrated once here and mirrored to disk
  // on every write.
  const rates = createRateStore(pricingFilePath(resolveDshHome()))
  // Folds keyed by the stored log's own change token, hydrated once here so a
  // restarted process draws the year without re-reading a log it already folded.
  const folds = createFoldCache(foldCacheFilePath(resolveDshHome()))
  // One read's state, published to the panel through its own route. The panel
  // serializes its reads, so one object is the whole truth about what is running.
  const progress = createProgressTracker()
  // The one corpus read in flight, shared by the background fold and whatever
  // request arrives while it runs. See `warm` below and `handleReport`.
  let warming: Promise<void> | undefined
  /**
   * Fold the whole corpus now, in the background, so the first request the panel
   * makes is a re-price instead of a cold read.
   *
   * The window is unbounded on purpose: the fold cache keeps every sample a
   * session ever recorded regardless of the window asked for, so priming it once
   * that way answers every window the panel can select. A deployment that is
   * warm already pays only the corpus listing.
   */
  const warm = (): void => {
    if (warming !== undefined) return
    warming = assembleReport(ctx, cache, folds, progress, resolved, rates, {
      refresh: false,
      from: undefined,
      to: undefined,
    }).then(
      () => undefined,
      (error: unknown) => {
        // A background fold that fails costs the reader the wait it was meant to
        // save and nothing else: the request that follows reads the logs itself.
        ctx.logger.warn(`dsh-local-usage: background fold failed: ${describe(error)}`)
      },
    ).finally(() => { warming = undefined })
  }
  // A session's samples stop being valid the moment it records another event.
  // The durable entry is left alone: it is keyed by the log's revision, so the
  // append that invalidates the memory copy also invalidates that entry.
  ctx.on('session/event', (session) => {
    cache.delete(session.id)
  })
  if (resolved.warmup) {
    ctx.effect(() => {
      const timer = setTimeout(warm, resolved.warmupDelayMs)
      return () => { clearTimeout(timer) }
    }, 'dsh-local-usage: background fold')
  }
  ctx.effect(
    () => connectionOf(ctx).fetch.register({
      path: REPORT_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: request => handleReport(ctx, cache, folds, progress, resolved, rates, request, () => warming),
    }),
    'dsh-local-usage: report route',
  )
  // Optional, so a deployment with no persistence backend still mounts: without
  // one there are no revisions, so nothing is ever reused from disk and every
  // session takes the read path this plugin had before the cache existed.
  ctx.effect(
    () => connectionOf(ctx).fetch.register({
      path: PROGRESS_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: () => Promise.resolve(Response.json(progress.read(), {
        headers: { 'cache-control': 'no-store' },
      })),
    }),
    'dsh-local-usage: progress route',
  )
  ctx.effect(
    () => connectionOf(ctx).fetch.register({
      path: PRICING_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: request => handlePricing(ctx, rates, request),
    }),
    'dsh-local-usage: pricing route',
  )
}
