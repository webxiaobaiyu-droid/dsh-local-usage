/**
 * The cache hit rate: the share of a window's prompt tokens the provider served
 * from its cache.
 *
 * The denominator is *every* prompt token — the uncached input, the cache reads
 * and the cache writes — because that is the population a reader is asking about
 * when they ask how much of the prompt was cached. Dividing by the uncached
 * bucket alone would report a rate above 100% on a cache-heavy profile, and
 * leaving cache writes out would overstate the rate wherever a provider bills
 * them (a written token is a prompt token that was not served from cache).
 * Output tokens are a different question and never enter this figure.
 *
 * A window with no prompt tokens has no rate at all, so this returns `undefined`
 * rather than zero: a caller then renders a missing figure instead of a
 * misleading one.
 *
 * @module dsh-local-usage/client/cache-rate
 */

import type { UsageTokens } from '../types.ts'

/**
 * Share of one window's prompt tokens served from cache.
 * @param tokens - the window's token buckets.
 * @returns the ratio in `0..1`, or `undefined` when the window held no prompt tokens.
 */
export function cacheHitRate(tokens: UsageTokens): number | undefined {
  const prompt = tokens.uncachedInputTokens + tokens.cacheReadTokens + tokens.cacheWriteTokens
  return prompt === 0 ? undefined : tokens.cacheReadTokens / prompt
}
