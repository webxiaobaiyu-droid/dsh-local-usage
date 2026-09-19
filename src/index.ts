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
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: activates the `ctx.sessionQuery` Context declaration.
import type {} from '@deepseek-ai/dsh-session-query'
import { foldSessionTitle } from '@deepseek-ai/dsh-session-title'
import { buildReport, samplesOf } from './aggregate.ts'
import type { PricingOptions, SessionUsageInput, UsageSample } from './aggregate.ts'
import { parsePeakWindow } from './pricing.ts'
import type { PeakWindow, PriceRate, PriceRule } from './pricing.ts'
import type { UsageInsightsReport } from './types.ts'

export type * from './types.ts'

/** Exact route the browser half calls; it sits behind the carrier's trust fence. */
export const REPORT_PATH = '/api/dsh-local-usage/report'

/** Session logs folded concurrently; each read parses and replay-validates a whole log. */
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

/** Build the priced report over every readable session log. */
async function assembleReport(
  ctx: Context,
  cache: Map<string, CachedSession>,
  config: UsageInsightsConfig,
  request: { refresh: boolean; from: number | undefined; to: number | undefined },
): Promise<UsageInsightsReport> {
  if (request.refresh) cache.clear()

  const records = await ctx.sessionQuery.listSessions()
  const pending: string[] = []
  const inputs: SessionUsageInput[] = []
  for (const record of records) {
    const id = String(record.header.id)
    const hit = cache.get(id)
    if (hit !== undefined) {
      inputs.push({
        sessionId: id,
        createdAt: hit.createdAt,
        samples: withinRange(hit.samples, request.from, request.to),
        ...titleFields(hit),
      })
      continue
    }
    pending.push(id)
  }

  const cached = pending.length === 0
  const folded = await mapBounded(pending, READ_CONCURRENCY, async (id) => {
    try {
      const snapshot = await ctx.sessionQuery.readSession(id as SessionId)
      // A forked session's log begins with the parent's inherited prefix, and
      // those turns were already billed under the parent. Only the events this
      // session owns are its own spend.
      const samples = samplesOf(
        snapshot.events.filter(event => event.seq >= snapshot.inheritedEventCount),
      )
      const title = foldSessionTitle(snapshot.events)?.title
      const entry: CachedSession = {
        samples,
        createdAt: snapshot.session.createdAt,
        ...title === undefined || title.length === 0 ? {} : { title },
        ...snapshot.session.cwd === undefined ? {} : { cwd: snapshot.session.cwd },
      }
      cache.set(id, entry)
      return {
        sessionId: id,
        createdAt: entry.createdAt,
        samples: withinRange(samples, request.from, request.to),
        ...titleFields(entry),
      }
    } catch {
      return undefined
    }
  })

  let unreadable = 0
  for (const input of folded) {
    if (input === undefined) unreadable += 1
    else inputs.push(input)
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

export default apply
