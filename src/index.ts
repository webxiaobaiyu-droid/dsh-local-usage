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
import { foldSessionTitle } from '@deepseek-ai/dsh-session-title'
import { buildReport, samplesOf } from './aggregate.ts'
import type { PricingOptions, SessionUsageInput, UsageSample } from './aggregate.ts'
import { parsePeakWindow } from './pricing.ts'
import type { PeakWindow, PriceRate, PriceRule } from './pricing.ts'
import type { UsageInsightsReport } from './types.ts'

export type * from './types.ts'

/** Exact route the browser half calls; it sits behind the carrier's trust fence. */
export const REPORT_PATH = '/api/dsh-local-usage/report'

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

/** Rate card for one route family, in currency units per one million tokens. */
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

/** One configured rate card and the route substring it claims. */
export interface UsageInsightsModelConfig extends UsageInsightsPriceConfig {
  /** Case-insensitive substring matched against `provider/model`; the first match wins. */
  match: string
}

/** Plugin configuration; every field has a default, so the plugin mounts bare. */
export interface UsageInsightsConfig {
  /** Currency every cost figure is expressed in; the plugin performs no conversion. */
  currency: string
  /** Configured rate cards, matched in order. */
  models: UsageInsightsModelConfig[]
  /** Rate used by a route no card matches. */
  fallback: UsageInsightsPriceConfig
  /** Peak windows as `HH:MM-HH:MM` in Beijing time. */
  peakWindows: string[]
  /** When true, Saturday and Sunday are never peak. */
  peakWeekdaysOnly: boolean
  /** Factor applied to every rate inside a peak window. */
  peakMultiplier: number
}

/** The published off-peak DeepSeek-V4.1-Flash card, in CNY per one million tokens. */
const FLASH_RATE: UsageInsightsPriceConfig = { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 }

/**
 * Shipped defaults: DeepSeek's published off-peak CNY prices. A route served
 * through an aggregator or a reseller has to be priced by the operator, and the
 * panel names every route that fell back to the default rather than implying a
 * figure it cannot support.
 */
export const DEFAULT_CONFIG: UsageInsightsConfig = {
  currency: 'CNY',
  models: [
    { match: 'v4-pro', input: 4.5, cacheRead: 0.15, cacheWrite: 4.5, output: 13.5 },
    { match: 'flash', ...FLASH_RATE },
  ],
  fallback: FLASH_RATE,
  peakWindows: ['09:00-12:00', '14:00-18:00'],
  peakWeekdaysOnly: true,
  peakMultiplier: 2,
}

/** One cached session fold: the samples plus the identity facts the report repeats. */
interface CachedSession {
  readonly samples: readonly UsageSample[]
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
  const samples = samplesOf(source.events.filter(event => event.seq >= source.skipBefore))
  const title = foldSessionTitle(source.events)?.title
  return {
    samples,
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
    peakMultiplier: config.peakMultiplier ?? DEFAULT_CONFIG.peakMultiplier,
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

/** A cached session fold that is still owed a read. */
interface MissingSession {
  readonly id: SessionId
  /** Whether the log carries a fork-inherited prefix, which the batch read cannot skip. */
  readonly seeded: boolean
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
 * @param ctx - host context carrying the session query engine.
 * @param cache - the fold cache, keyed by session id.
 * @param config - resolved plugin configuration.
 * @param request - the window to fold and whether to discard the cache first.
 * @returns the complete priced report.
 */
async function assembleReport(
  ctx: Context,
  cache: Map<string, CachedSession>,
  config: UsageInsightsConfig,
  request: { refresh: boolean; from: number | undefined; to: number | undefined },
): Promise<UsageInsightsReport> {
  if (request.refresh) cache.clear()

  const records = await ctx.sessionQuery.listSessions()
  const missing: MissingSession[] = []
  const inputs: SessionUsageInput[] = []
  for (const record of records) {
    const id = String(record.header.id)
    const hit = cache.get(id)
    if (hit !== undefined) {
      inputs.push(sessionInputOf(id, hit, request))
      continue
    }
    missing.push({ id: id as SessionId, seeded: record.header.isSeeded })
  }

  const cached = missing.length === 0
  const batch = batchProjectionOf(ctx.sessionQuery)
  const batchable = batch === undefined ? [] : missing.filter(entry => !entry.seeded)
  const exact = batch === undefined ? missing : missing.filter(entry => entry.seeded)

  let unreadable = 0

  if (batch !== undefined && batchable.length > 0) {
    // The projection is synchronous and must own everything it keeps. The fold
    // satisfies that by reading primitives off the events and building fresh
    // sample objects, so nothing here aliases the borrowed log.
    const results = await batch(batchable.map(entry => entry.id), source => foldSession({
      events: source.events,
      createdAt: source.header.createdAt,
      ...source.header.cwd === undefined ? {} : { cwd: source.header.cwd },
      // Reached only for a log with no inherited prefix, by construction above.
      skipBefore: 0,
    }))
    const byId = new Map<string, BatchOutcome<CachedSession>>()
    for (const outcome of results) byId.set(String(outcome.sessionId), outcome)
    for (const entry of batchable) {
      const outcome = byId.get(entry.id)
      if (outcome === undefined || outcome.status === 'rejected') {
        unreadable += 1
        continue
      }
      cache.set(entry.id, outcome.value)
      inputs.push(sessionInputOf(entry.id, outcome.value, request))
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
      inputs.push(sessionInputOf(entry.id, value, request))
    }
  }

  return buildReport(inputs, pricingOptions(config), {
    generatedAt: Date.now(),
    unreadableSessions: unreadable,
    cached,
  })
}

/** Resolve the configured rate card and peak schedule into fold options. */
function pricingOptions(config: UsageInsightsConfig): PricingOptions {
  const windows: PeakWindow[] = []
  for (const spec of config.peakWindows) {
    const window = parsePeakWindow(spec)
    if (window !== undefined) windows.push(window)
  }
  const rules: PriceRule[] = config.models.map(model => ({ ...model }))
  const fallback: PriceRate = { ...config.fallback }
  return {
    currency: config.currency,
    rules,
    fallback,
    peakWindows: windows,
    peakWeekdaysOnly: config.peakWeekdaysOnly,
    peakMultiplier: config.peakMultiplier,
  }
}

/** Answer one report request with JSON, or a described failure. */
async function handleReport(
  ctx: Context,
  cache: Map<string, CachedSession>,
  config: UsageInsightsConfig,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url)
  try {
    const report = await assembleReport(ctx, cache, config, {
      refresh: url.searchParams.get('refresh') === '1',
      from: numberParam(url.searchParams, 'from'),
      to: numberParam(url.searchParams, 'to'),
    })
    return Response.json(report, { headers: { 'cache-control': 'no-store' } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.logger.warn(`dsh-local-usage: report failed: ${message}`)
    return Response.json({ error: message }, { status: 500, headers: { 'cache-control': 'no-store' } })
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
      readonly methods: readonly ('GET' | 'HEAD')[]
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
  // A session's samples stop being valid the moment it records another event.
  ctx.on('session/event', (session) => {
    cache.delete(session.id)
  })
  ctx.effect(
    () => connectionOf(ctx).fetch.register({
      path: REPORT_PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: request => handleReport(ctx, cache, resolved, request),
    }),
    'dsh-local-usage: report route',
  )
}
