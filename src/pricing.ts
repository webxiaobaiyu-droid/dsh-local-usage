/**
 * Money pricing for provider-reported token usage.
 *
 * The harness records tokens, never currency: `TokenUsage` is provider
 * accounting and no model price table exists in the repository. This module is
 * therefore the plugin's own rate card — prices are stated by configuration,
 * matched against the routed `provider/model`, and multiplied by the exact
 * bucket counts the session log reports.
 *
 * Peak windows follow the provider's published schedule, which is stated in
 * Beijing time (UTC+8, no daylight saving). Public holidays are NOT modelled,
 * so a holiday weekday inside a peak window is billed at the peak rate.
 *
 * @module dsh-local-usage/pricing
 */

import type { UsageTokens } from './types.ts'

/** Minutes to add to UTC to reach Beijing time; China observes no daylight saving. */
export const BEIJING_OFFSET_MINUTES = 480

/** Currency units per one million tokens, split by the bucket the provider bills. */
export interface PriceRate {
  /** Cache-miss prompt tokens. */
  readonly input: number
  /** Cache-hit prompt tokens. */
  readonly cacheRead: number
  /** Cache-write prompt tokens. */
  readonly cacheWrite: number
  /** Generated tokens. */
  readonly output: number
}

/** One configured rate card plus the route substring it claims. */
export interface PriceRule extends PriceRate {
  /**
   * Case-insensitive substring matched against `provider/model`. The first rule
   * in configuration order that matches wins, so specific rules precede
   * general ones.
   */
  readonly match: string
}

/** A half-open minute-of-day window `[start, end)` in Beijing time. */
export interface PeakWindow {
  /** Minutes after Beijing midnight, inclusive. */
  readonly start: number
  /** Minutes after Beijing midnight, exclusive. */
  readonly end: number
}

const MINUTES_PER_DAY = 24 * 60
const WINDOW_PATTERN = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/

/**
 * Parse one `HH:MM-HH:MM` peak window in Beijing time.
 * @param spec - window text as configured.
 * @returns the parsed half-open minute range, or `undefined` when it is malformed or empty.
 */
export function parsePeakWindow(spec: string): PeakWindow | undefined {
  const matched = WINDOW_PATTERN.exec(spec.trim())
  if (matched === null) return undefined
  const start = Number(matched[1]) * 60 + Number(matched[2])
  const end = Number(matched[3]) * 60 + Number(matched[4])
  if (start >= MINUTES_PER_DAY || end > MINUTES_PER_DAY || start >= end) return undefined
  return { start, end }
}

/**
 * Beijing-time weekday and minute-of-day for one instant.
 * @param time - Unix epoch milliseconds.
 * @returns the weekday (`0` = Sunday) and minutes after Beijing midnight.
 */
export function beijingClock(time: number): { weekday: number; minutes: number } {
  const shifted = new Date(time + BEIJING_OFFSET_MINUTES * 60_000)
  return {
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

/**
 * Whether one instant falls in a configured peak window.
 * @param time - Unix epoch milliseconds.
 * @param windows - parsed peak windows in Beijing time.
 * @param weekdaysOnly - when true, Saturday and Sunday are never peak.
 * @returns true when the instant is billed at the peak rate.
 */
export function isPeakTime(
  time: number,
  windows: readonly PeakWindow[],
  weekdaysOnly: boolean,
): boolean {
  if (windows.length === 0) return false
  const { weekday, minutes } = beijingClock(time)
  if (weekdaysOnly && (weekday === 0 || weekday === 6)) return false
  return windows.some(window => minutes >= window.start && minutes < window.end)
}

/**
 * Select the rate card one route is priced with.
 * @param rules - configured rules in match order.
 * @param fallback - rate used when no rule matches.
 * @param route - `provider/model` the usage was attributed to.
 * @param peak - whether the sample is inside a peak window.
 * @param peakMultiplier - factor applied to every rate during peak windows.
 * @returns the effective rate and whether a configured rule matched.
 */
export function selectRate(
  rules: readonly PriceRule[],
  fallback: PriceRate,
  route: string,
  peak: boolean,
  peakMultiplier: number,
): { rate: PriceRate; matched: boolean } {
  const needle = route.toLocaleLowerCase()
  const rule = rules.find(candidate => needle.includes(candidate.match.toLocaleLowerCase()))
  // Projected rather than returned as-is: a rule carries its own `match` key,
  // which is configuration, not a rate.
  const matched: PriceRate = rule === undefined
    ? fallback
    : { input: rule.input, cacheRead: rule.cacheRead, cacheWrite: rule.cacheWrite, output: rule.output }
  if (!peak || peakMultiplier === 1) return { rate: matched, matched: rule !== undefined }
  return {
    rate: {
      input: matched.input * peakMultiplier,
      cacheRead: matched.cacheRead * peakMultiplier,
      cacheWrite: matched.cacheWrite * peakMultiplier,
      output: matched.output * peakMultiplier,
    },
    matched: rule !== undefined,
  }
}

/**
 * Price one bucket set at one rate.
 * @param tokens - bucket counts to price.
 * @param rate - currency units per one million tokens for each bucket.
 * @returns the cost in the configured currency.
 */
export function costOf(tokens: UsageTokens, rate: PriceRate): number {
  return (
    tokens.uncachedInputTokens * rate.input
    + tokens.cacheReadTokens * rate.cacheRead
    + tokens.cacheWriteTokens * rate.cacheWrite
    + tokens.outputTokens * rate.output
  ) / 1_000_000
}
