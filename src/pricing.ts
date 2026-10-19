/**
 * Money pricing for provider-reported token usage.
 *
 * The harness records tokens, never currency: `TokenUsage` is provider
 * accounting and no model price table exists in the repository. This module is
 * therefore the plugin's own rate card — prices are stated by configuration and
 * applied to the exact bucket counts the session log reports.
 *
 * A card belongs to a **model**, not to a route. One model is sold through
 * several vendor routes — `vendor-a:deepseek-v4-flash`,
 * `vendor-b/cn:deepseek-v4-flash` — and they are the same model at the same
 * price, so one card prices all of them. The report still states every route
 * separately: pricing is shared, consumption is not.
 *
 * A card carries two complete sets of prices, one for settlements inside a peak
 * window and one for those outside it, plus a switch saying whether peak pricing
 * applies at all. There is no multiplier: both sets are stated rather than
 * derived, so a model whose peak price is not twice its off-peak price is
 * expressible, and a model with a single price turns the switch off.
 *
 * Peak windows follow the provider's published schedule, which is stated in
 * Beijing time (UTC+8, no daylight saving). Public holidays are NOT modelled,
 * so a holiday weekday inside a peak window is billed at the peak price.
 *
 * @module dsh-local-usage/pricing
 */

import type { UsageRate, UsageTokens } from './types.ts'

/** Minutes to add to UTC to reach Beijing time; China observes no daylight saving. */
export const BEIJING_OFFSET_MINUTES = 480

/** Currency units per one million tokens, split by the bucket the provider bills. */
export type PriceRate = UsageRate

/**
 * One model's prices.
 *
 * `offPeak` is the price outside a peak window, and the only price of a model
 * that does not price peak separately: the switch is what says which reading
 * applies, so a flat model carries one meaningful set rather than two that happen
 * to be equal.
 */
export interface ModelPrice {
  /**
   * Case-insensitive substring matched against the route, in configuration order.
   *
   * The model's own name is the useful value: a route that carries it anywhere is
   * that model, whatever vendor prefix or namespace precedes it. The first card
   * that matches wins, so specific names precede general ones.
   */
  readonly match: string
  /** Whether {@link peak} applies inside the configured windows. */
  readonly peakEnabled: boolean
  /** Prices for a settlement inside a peak window. */
  readonly peak: PriceRate
  /** Prices outside one; the only prices of a flat-priced model. */
  readonly offPeak: PriceRate
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
 * Whether a resolved Beijing clock falls inside a configured peak window.
 *
 * Separate from {@link isPeakTime} so a fold that needs the clock for something
 * else — the slice-of-day profile — resolves it once per sample instead of twice.
 *
 * @param clock - weekday and minutes after Beijing midnight.
 * @param windows - parsed peak windows in Beijing time.
 * @param weekdaysOnly - when true, Saturday and Sunday are never peak.
 * @returns true when the instant falls in a peak window.
 */
export function isPeakClock(
  clock: { readonly weekday: number; readonly minutes: number },
  windows: readonly PeakWindow[],
  weekdaysOnly: boolean,
): boolean {
  if (windows.length === 0) return false
  if (weekdaysOnly && (clock.weekday === 0 || clock.weekday === 6)) return false
  return windows.some(window => clock.minutes >= window.start && clock.minutes < window.end)
}

/**
 * Whether one instant falls in a configured peak window.
 * @param time - Unix epoch milliseconds.
 * @param windows - parsed peak windows in Beijing time.
 * @param weekdaysOnly - when true, Saturday and Sunday are never peak.
 * @returns true when the instant falls in a peak window.
 */
export function isPeakTime(
  time: number,
  windows: readonly PeakWindow[],
  weekdaysOnly: boolean,
): boolean {
  if (windows.length === 0) return false
  return isPeakClock(beijingClock(time), windows, weekdaysOnly)
}

/** Which card claimed a route. */
export interface ModelMatch {
  /** The card that prices the route. */
  readonly card: ModelPrice
  /** Whether a configured model claimed it, or the fallback did. */
  readonly source: 'model' | 'fallback'
}

/**
 * Resolve the card a route is priced with.
 *
 * The match is a substring of the route rather than an equality, because one
 * model is sold under vendor prefixes and namespaces that differ by deployment:
 * `deepseek-v4-flash` has to claim `workbuddy/cn:deepseek-v4-flash` and
 * `vendor-a/deepseek-v4-flash` alike. The first card in configuration order that
 * appears in the route wins, so a specific name can precede a general one.
 *
 * @param models - configured cards in match order.
 * @param fallback - card used when no model claims the route.
 * @param route - `provider/model` the usage was attributed to.
 * @returns the card and whether a configured model claimed the route.
 */
export function matchModel(
  models: readonly ModelPrice[],
  fallback: ModelPrice,
  route: string,
): ModelMatch {
  const needle = route.toLocaleLowerCase()
  const claimed = models.find(candidate => needle.includes(candidate.match.toLocaleLowerCase()))
  return claimed === undefined
    ? { card: fallback, source: 'fallback' }
    : { card: claimed, source: 'model' }
}

/** Which card priced one settlement, and at which of its two sets of prices. */
export interface RateSelection {
  /** Effective prices for this settlement. */
  readonly rate: PriceRate
  /** Whether a configured model — not the fallback — priced it. */
  readonly matched: boolean
  /** Where the price came from. */
  readonly source: 'model' | 'fallback'
  /** The model's `match` string, present only when a configured model claimed it. */
  readonly model?: string
  /** Whether the peak prices were used, which is false for a flat-priced model. */
  readonly peakApplied: boolean
}

/**
 * Select the prices one settlement is billed at.
 *
 * @param models - configured cards in match order.
 * @param fallback - card used when no model claims the route.
 * @param route - `provider/model` the usage was attributed to.
 * @param peak - whether the settlement falls inside a peak window.
 * @returns the effective prices, their source, and whether peak pricing applied.
 */
export function selectRate(
  models: readonly ModelPrice[],
  fallback: ModelPrice,
  route: string,
  peak: boolean,
): RateSelection {
  const { card, source } = matchModel(models, fallback, route)
  // A flat-priced model ignores the window entirely: its switch is off, so no
  // peak price exists to apply and both halves of the day cost the same.
  const peakApplied = peak && card.peakEnabled
  return {
    rate: peakApplied ? card.peak : card.offPeak,
    matched: source === 'model',
    source,
    peakApplied,
    ...source === 'fallback' ? {} : { model: card.match },
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
