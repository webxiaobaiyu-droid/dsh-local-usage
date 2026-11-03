/**
 * The usage service: the report and the call log read the same corpus, price the
 * same samples, and differ only in the question they answer.
 *
 * Both entry points take the reader and the progress tracker from the caller:
 * the entry owns activation and serializes reads, while this module owns what a
 * window means to each surface. Keeping the build of a report here — rather than
 * in the HTTP handler — makes the service testable without a Request.
 *
 * @module dsh-local-usage/host/usage-service
 */

import type { Context } from '@deepseek-ai/cordis'
import { buildReport } from '../aggregate.ts'
import { queryCalls } from '../calls.ts'
import type { FoldCache } from '../fold-cache.ts'
import type { ProgressTracker } from '../progress.ts'
import type { RateStore } from '../rates.ts'
import type {
  UsageCallsQuery,
  UsageCallsReport,
  UsageInsightsReport,
} from '../types.ts'
import { pricingOptions } from './config.ts'
import type { UsageInsightsConfig } from './config.ts'
import { readCorpus } from './corpus-reader.ts'
import { sessionInputOf } from './session-fold.ts'
import type { CachedSession } from './session-fold.ts'

/**
 * Build the priced report over every readable session log.
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
export async function assembleReport(
  ctx: Context,
  cache: Map<string, CachedSession>,
  folds: FoldCache,
  progress: ProgressTracker,
  config: UsageInsightsConfig,
  rates: RateStore,
  request: { refresh: boolean; from: number | undefined; to: number | undefined },
  generations: ReadonlyMap<string, number>,
): Promise<UsageInsightsReport> {
  progress.begin()
  try {
    const corpus = await readCorpus(ctx, cache, folds, progress, request, generations)
    progress.pricing()
    // Every contributor in the requested window: the one place a window becomes
    // the inputs a fold prices.
    const inputs = corpus.contributors.map(({ id, fold }) => sessionInputOf(id, fold, request))
    // Only the restored sessions with a sample in this window: a deleted session
    // from last year is in the fold but not in a report about today, and counting
    // it here would claim a contribution the figures do not show.
    const restored = new Set(corpus.restoredIds)
    const restoredSessions = inputs.filter(input => restored.has(input.sessionId) && input.samples.length > 0).length
    return buildReport(inputs, pricingOptions(config, rates), {
      generatedAt: Date.now(),
      unreadableSessions: corpus.unreadable,
      restoredSessions,
      cached: corpus.cached,
    })
  } finally {
    progress.finish()
  }
}


/**
 * Read one call-log page out of the same folds the report uses.
 *
 * The window is applied by the reader; the model, route, session, text, order
 * and page are applied by the query. Totals and route facets cover the whole
 * match, not the page the caller is about to draw.
 * @param ctx - host context carrying the session query engine.
 * @param cache - the in-memory fold cache.
 * @param folds - the durable fold cache.
 * @param progress - the read's progress.
 * @param config - resolved plugin configuration.
 * @param rates - the reader's price edits.
 * @param query - the call-log query.
 * @param generations - session invalidation generations captured by this read.
 * @returns one page and the totals of every match.
 */
export async function queryCallPage(
  ctx: Context,
  cache: Map<string, CachedSession>,
  folds: FoldCache,
  progress: ProgressTracker,
  config: UsageInsightsConfig,
  rates: RateStore,
  query: UsageCallsQuery,
  generations: ReadonlyMap<string, number>,
  refresh = false,
): Promise<UsageCallsReport> {
  progress.begin()
  try {
    const corpus = await readCorpus(ctx, cache, folds, progress, {
      refresh,
      from: query.from,
      to: query.to,
    }, generations)
    progress.pricing()
    const inputs = corpus.contributors.map(({ id, fold }) => sessionInputOf(id, fold, {
      from: query.from,
      to: query.to,
    }))
    return queryCalls(inputs, pricingOptions(config, rates), query, {
      generatedAt: Date.now(),
      scannedSessions: inputs.length,
      unreadableSessions: corpus.unreadable,
      cached: corpus.cached,
    })
  } finally {
    progress.finish()
  }
}
