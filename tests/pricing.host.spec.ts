import { describe, expect, it } from 'vitest'
import {
  beijingClock,
  costOf,
  isPeakTime,
  parsePeakWindow,
  selectRate,
} from '../src/pricing.ts'
import type { PriceRate, PriceRule } from '../src/pricing.ts'

/** 2026-09-21 is a Monday; 02:00 UTC is 10:00 in Beijing, inside the first peak window. */
const MONDAY_PEAK = Date.UTC(2026, 8, 21, 2, 0, 0)
/** Same Monday, 06:00 UTC — 14:00 Beijing, inside the second peak window. */
const MONDAY_PEAK_AFTERNOON = Date.UTC(2026, 8, 21, 6, 0, 0)
/** Same Monday, 05:00 UTC — 13:00 Beijing, between the two peak windows. */
const MONDAY_GAP = Date.UTC(2026, 8, 21, 5, 0, 0)
/** 2026-09-20 is a Sunday; 02:00 UTC is 10:00 Beijing inside a window, but a weekend. */
const SUNDAY_PEAK = Date.UTC(2026, 8, 20, 2, 0, 0)

const WINDOWS = [
  { start: 9 * 60, end: 12 * 60 },
  { start: 14 * 60, end: 18 * 60 },
]

const FALLBACK: PriceRate = { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 }
const RULES: readonly PriceRule[] = [
  { match: 'v4-pro', input: 4.5, cacheRead: 0.15, cacheWrite: 4.5, output: 13.5 },
  { match: 'flash', input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
]

describe('parsePeakWindow', () => {
  it('parses a half-open minute range', () => {
    expect(parsePeakWindow('09:00-12:00')).toEqual({ start: 540, end: 720 })
    expect(parsePeakWindow(' 14:00 - 18:30 ')).toEqual({ start: 840, end: 1110 })
  })

  it('rejects malformed, empty, and inverted windows', () => {
    expect(parsePeakWindow('09:00')).toBeUndefined()
    expect(parsePeakWindow('noon')).toBeUndefined()
    expect(parsePeakWindow('12:00-09:00')).toBeUndefined()
    expect(parsePeakWindow('09:00-09:00')).toBeUndefined()
    expect(parsePeakWindow('25:00-26:00')).toBeUndefined()
  })
})

describe('beijingClock', () => {
  it('shifts UTC into Beijing time without daylight saving', () => {
    expect(beijingClock(MONDAY_PEAK)).toEqual({ weekday: 1, minutes: 600 })
    expect(beijingClock(MONDAY_GAP)).toEqual({ weekday: 1, minutes: 780 })
    expect(beijingClock(SUNDAY_PEAK)).toEqual({ weekday: 0, minutes: 600 })
  })
})

describe('isPeakTime', () => {
  it('matches each configured window', () => {
    expect(isPeakTime(MONDAY_PEAK, WINDOWS, true)).toBe(true)
    expect(isPeakTime(MONDAY_PEAK_AFTERNOON, WINDOWS, true)).toBe(true)
  })

  it('treats the gap between windows as off-peak', () => {
    expect(isPeakTime(MONDAY_GAP, WINDOWS, true)).toBe(false)
  })

  it('excludes weekends only when asked', () => {
    expect(isPeakTime(SUNDAY_PEAK, WINDOWS, true)).toBe(false)
    expect(isPeakTime(SUNDAY_PEAK, WINDOWS, false)).toBe(true)
  })

  it('is never peak without a window, even on a weekday', () => {
    expect(isPeakTime(MONDAY_PEAK, [], true)).toBe(false)
  })

  it('excludes the window end and includes its start', () => {
    expect(isPeakTime(Date.UTC(2026, 8, 21, 1, 0, 0), WINDOWS, true)).toBe(true)
    expect(isPeakTime(Date.UTC(2026, 8, 21, 4, 0, 0), WINDOWS, true)).toBe(false)
  })
})

describe('selectRate', () => {
  it('prefers the first matching rule', () => {
    const selected = selectRate(RULES, FALLBACK, 'commoncode/deepseek-v4-pro', false, 2)
    expect(selected).toEqual({
      rate: { input: 4.5, cacheRead: 0.15, cacheWrite: 4.5, output: 13.5 },
      matched: true,
    })
  })

  it('matches case-insensitively on the route', () => {
    expect(selectRate(RULES, FALLBACK, 'COMMONCODE/DeepSeek-V4.1-FLASH', false, 2).rate.input).toBe(1)
  })

  it('falls back when no rule claims the route', () => {
    expect(selectRate(RULES, FALLBACK, 'other/gpt', false, 2)).toEqual({ rate: FALLBACK, matched: false })
  })

  it('scales every bucket by the peak multiplier', () => {
    expect(selectRate(RULES, FALLBACK, 'x/flash', true, 2).rate)
      .toEqual({ input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 })
  })

  it('leaves the rate alone when peak pricing is disabled', () => {
    expect(selectRate(RULES, FALLBACK, 'x/flash', true, 1).rate.input).toBe(1)
  })
})

describe('costOf', () => {
  it('prices each bucket per million tokens', () => {
    expect(costOf({
      uncachedInputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 2_000_000,
      cacheWriteTokens: 0,
    }, { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 })).toBeCloseTo(1 + 2 + 0.04, 10)
  })

  it('prices an empty bucket set at zero', () => {
    expect(costOf({
      uncachedInputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    }, FALLBACK)).toBe(0)
  })
})
