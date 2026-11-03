/**
 * Usage statistics Host half: activation, the shared caches, and the read queue.
 *
 * The entry is deliberately the only place that wires the plugin together:
 * configuration arrives here, the corpus caches live here, session invalidation
 * is subscribed here, and every HTTP route is registered here. The work behind
 * those routes lives in `host/`: folds, the corpus reader, the usage service and
 * the HTTP surface.
 *
 * Reading a log is the expensive half and folding it is not, so the cache keeps
 * each session's extracted samples rather than a finished report, and every
 * request re-prices them against the current configuration.
 *
 * @module dsh-local-usage
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: activates the optional `ctx.sessionPersistence` declaration, whose
// per-log revision is what makes a stored fold reusable across a restart.
import type {} from '@deepseek-ai/dsh-session-persistence'
import { createFoldCache, foldCacheFilePath } from './fold-cache.ts'
import { DEFAULT_CONFIG, resolveConfig } from './host/config.ts'
import { assembleReport } from './host/usage-service.ts'
import { registerRoutes } from './host/http-routes.ts'
import type { SerializedRead } from './host/http-routes.ts'
import type { CachedSession } from './host/session-fold.ts'
import type { UsageInsightsConfig } from './host/config.ts'
import { createProgressTracker } from './progress.ts'
import { createRateStore, pricingFilePath, resolveDshHome } from './rates.ts'

export type * from './types.ts'
export { CALLS_PATH, PRICING_PATH, PROGRESS_PATH, REPORT_PATH } from './host/routes.ts'
export { DEFAULT_CONFIG } from './host/config.ts'
export type {
  UsageInsightsConfig,
  UsageInsightsFallbackConfig,
  UsageInsightsModelConfig,
  UsageInsightsPriceConfig,
} from './host/config.ts'

/** Plugin name the loader row addresses. */
export const name = 'dsh-local-usage'

/** Services this plugin cannot work without: the carrier's route registry and the session reads. */
export const inject = ['connection', 'sessionQuery']

/** One line describing an error, for a log line. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Register this plugin's Fetch routes and the background fold.
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
  // Each session's invalidation generation. A read captures it with the id and
  // checks it again before writing a fold back: an event that landed mid-read
  // must not let the read resurrect the fold that event retired.
  const generations = new Map<string, number>()
  // The reader's own rate corrections, hydrated once here and mirrored to disk
  // on every write.
  const rates = createRateStore(pricingFilePath(resolveDshHome()))
  // Folds keyed by the stored log's own change token, hydrated once here so a
  // restarted process draws the year without re-reading a log it already folded.
  const folds = createFoldCache(
    foldCacheFilePath(resolveDshHome()),
    message => { ctx.logger.warn(message) },
  )
  // One read's state, published to the panel through its own route. Reads are
  // serialized below, so one object is the whole truth about what is running.
  const progress = createProgressTracker()
  // The one corpus read in flight, shared by the background fold and whatever
  // request arrives while it runs. See `warm` below and `handleReport`.
  let warming: Promise<void> | undefined
  // Reads are queued rather than run together: two in flight would each see an
  // empty cache, each walk every log, and each advance the one progress object
  // the panel reads — which is how a reader saw 138 of 92. A queued read starts
  // from the folds the one before it just filled, so it is also cheaper.
  let reads: Promise<unknown> = Promise.resolve()
  const serialize: SerializedRead = (task) => {
    const run = reads.then(task, task)
    reads = run.then(() => undefined, () => undefined)
    return run
  }
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
    warming = serialize(() => assembleReport(ctx, cache, folds, progress, resolved, rates, {
      refresh: false,
      from: undefined,
      to: undefined,
    }, generations)).then(
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
    generations.set(session.id, (generations.get(session.id) ?? 0) + 1)
    cache.delete(session.id)
  })
  if (resolved.warmup) {
    ctx.effect(() => {
      const timer = setTimeout(warm, resolved.warmupDelayMs)
      return () => { clearTimeout(timer) }
    }, 'dsh-local-usage: background fold')
  }
  registerRoutes({
    ctx,
    cache,
    folds,
    progress,
    config: resolved,
    rates,
    serialize,
    generations,
    background: () => warming,
  })
}
