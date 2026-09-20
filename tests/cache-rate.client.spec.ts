/**
 * The cache hit rate tile: the ratio's definition and the way it is written.
 *
 * @module dsh-local-usage/tests/cache-rate
 */

import { describe, expect, it } from 'vitest'
import { cacheHitRate } from '../src/client/cache-rate.ts'
import { formatPercent } from '../src/client/format.ts'

/** One window's token buckets; the cache write defaults to zero as DeepSeek reports it. */
function tokens(uncachedInput: number, cacheRead: number, cacheWrite = 0) {
  return { uncachedInputTokens: uncachedInput, outputTokens: 0, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite }
}

describe('cacheHitRate', () => {
  it('divides cache reads by every prompt token', () => {
    // Nine parts cached to one part not: a rate of exactly 0.9.
    expect(cacheHitRate(tokens(10_000, 90_000))).toBeCloseTo(0.9, 12)
  })

  it('reads as the panel writes it, on a cache-heavy window', () => {
    expect(formatPercent(cacheHitRate(tokens(17_745_600, 2_246_000_000)) ?? 0, 'zh')).toBe('99.22%')
  })

  it('counts cache writes in the denominator, so a written token is not a hit', () => {
    // 90 reads out of 100 prompt tokens, 10 of them written rather than read.
    expect(cacheHitRate(tokens(0, 90, 10))).toBeCloseTo(0.9, 10)
  })

  it('never exceeds one, however cache-heavy the window is', () => {
    expect(cacheHitRate(tokens(1, 999, 0))).toBeLessThanOrEqual(1)
  })

  it('reports no rate for a window with no prompt tokens', () => {
    expect(cacheHitRate(tokens(0, 0))).toBeUndefined()
  })

  it('reports zero rather than absent when prompt tokens were all uncached', () => {
    expect(cacheHitRate(tokens(500, 0))).toBe(0)
  })

  it('leaves output tokens out of the question entirely', () => {
    const withOutput = { ...tokens(500, 500), outputTokens: 10_000 }
    expect(cacheHitRate(withOutput)).toBe(0.5)
  })
})

describe('formatPercent', () => {
  it('always writes two fraction digits', () => {
    expect(formatPercent(0.992159, 'en')).toBe('99.22%')
    expect(formatPercent(0.5, 'en')).toBe('50.00%')
    expect(formatPercent(0, 'en')).toBe('0.00%')
  })

  it('rounds the last digit rather than truncating it', () => {
    expect(formatPercent(0.99996, 'en')).toBe('100.00%')
    expect(formatPercent(0.99994, 'en')).toBe('99.99%')
  })

  it('writes the percentage the reader’s language writes', () => {
    expect(formatPercent(0.992159, 'zh')).toBe('99.22%')
  })

  it('falls back to a plain figure when the locale names no formatter', () => {
    expect(formatPercent(0.992159, 'not a locale')).toBe('99.22%')
  })
})
