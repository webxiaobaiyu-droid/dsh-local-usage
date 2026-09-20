/**
 * Locale-aware rendering of the figures on the panel.
 *
 * Copy and figures are two different things, and only one of them is
 * translatable. A dictionary entry can say what a number *means*; it cannot say
 * how that number is written, because symbol placement, grouping, the decimal
 * mark and the compact scale are properties of the reader's language, not of
 * the sentence. So every figure is formatted here against the active locale
 * while every sentence around it comes from the dictionary.
 *
 * No locale means no formatting: these functions take the bare BCP 47-style id
 * the locale service reports and hand it straight to `Intl`, which resolves a
 * region-less tag (`zh`, `en`) on its own and falls back to the default locale
 * for a well-formed tag it does not know. Only a structurally invalid tag or
 * currency code throws, and that is an operator's configuration rather than a
 * defect, so each formatter is built once, cached, and allowed to stay absent —
 * a caller then renders the figure plainly instead of failing the panel.
 *
 * @module dsh-local-usage/client/format
 */

const costFormatters = new Map<string, Intl.NumberFormat | null>()
const tokenFormatters = new Map<string, Intl.NumberFormat | null>()
const integerFormatters = new Map<string, Intl.NumberFormat | null>()
const percentFormatters = new Map<string, Intl.NumberFormat | null>()
const rateFormatters = new Map<string, Intl.NumberFormat | null>()
const dayFormatters = new Map<string, Intl.DateTimeFormat | null>()

/**
 * Build one formatter once, caching a rejected construction as absent.
 *
 * The cache is what keeps a bad configuration from throwing on every render:
 * `Intl` rejects an unknown currency code and a malformed locale tag with a
 * `RangeError`, and both are values an operator supplies.
 * @param cache - the per-kind formatter cache.
 * @param key - cache key; must carry every input the built formatter depends on.
 * @param build - constructs the formatter.
 * @returns the formatter, or `undefined` when it cannot be built.
 */
function resolve<T extends object>(
  cache: Map<string, T | null>,
  key: string,
  build: () => T,
): T | undefined {
  const hit = cache.get(key)
  if (hit !== undefined) return hit ?? undefined
  let built: T | null
  try {
    built = build()
  } catch {
    built = null
  }
  cache.set(key, built)
  return built ?? undefined
}

/**
 * Fraction digits a money figure is worth: enough that a sub-cent day does not
 * read as a flat zero, and no more.
 * @param value - the figure about to be rendered.
 * @returns the fraction width to format it with.
 */
function costDigits(value: number): number {
  const magnitude = Math.abs(value)
  if (magnitude === 0) return 2
  if (magnitude < 0.01) return 4
  if (magnitude < 1) return 3
  return 2
}

/**
 * Render one money figure in the report's own currency.
 * @param value - the figure.
 * @param currency - ISO currency code the report states; never converted.
 * @param locale - active locale id.
 * @returns the formatted figure, or `CODE 0.00` when the currency is unknown.
 */
export function formatCost(value: number, currency: string, locale: string): string {
  const digits = costDigits(value)
  const formatter = resolve(
    costFormatters,
    `${locale}\u0000${currency}\u0000${String(digits)}`,
    () => new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }),
  )
  // A configured currency that is not an ISO code is the operator's choice, not
  // a defect: fall back to a plain suffix rather than failing the panel.
  return formatter === undefined ? `${currency} ${value.toFixed(digits)}` : formatter.format(value)
}

/** Compact fallback for a locale whose formatter could not be built. */
function plainTokens(value: number): string {
  if (value < 1000) return String(Math.round(value))
  if (value < 1_000_000) return `${trim(value / 1000, 1)}K`
  return `${trim(value / 1_000_000, 2)}M`
}

/** Drop trailing zeros from a fixed-point figure. */
function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

/**
 * Render a token count at the compact scale of the reader's language.
 *
 * The scale is not a decoration: English counts in K/M/B while Chinese counts
 * in 万/亿, and a Chinese panel reading `214.87M` is exactly the untranslated
 * figure this module exists to remove. English output is unchanged by the
 * switch, because `Intl` compact notation resolves to the same K/M/B it
 * replaced.
 * @param value - token count.
 * @param locale - active locale id.
 * @returns the compact count.
 */
export function formatTokens(value: number, locale: string): string {
  const formatter = resolve(
    tokenFormatters,
    locale,
    () => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }),
  )
  return formatter === undefined ? plainTokens(value) : formatter.format(value)
}

/**
 * Render a whole figure in full, grouped the way the reader's language groups.
 *
 * This is the drill-down form, for the figures a reader counts rather than
 * compares: the hover card's per-bucket tokens, a day's call count, the number
 * of sessions scanned. A compact count answers "roughly how much" and the
 * hover card exists to answer "exactly how much", which a rounded scale cannot;
 * every such figure is a whole number, so this one formatter serves them all.
 * @param value - the whole figure.
 * @param locale - active locale id.
 * @returns every digit, with locale-appropriate grouping.
 */
export function formatInteger(value: number, locale: string): string {
  const rounded = Math.round(value)
  const formatter = resolve(
    integerFormatters,
    locale,
    () => new Intl.NumberFormat(locale),
  )
  return formatter === undefined ? String(rounded) : formatter.format(rounded)
}

/**
 * Render one ratio as a percentage.
 *
 * Two fraction digits always, never one and never none: a rate is read by
 * comparing windows, and a figure that drops its trailing digits (`99.2%` beside
 * `99.22%`) reads as a change in precision rather than a change in value. The
 * rounding is the language's own, so the symbol and its placement stay correct
 * for the reader.
 * @param value - the ratio, `0..1`.
 * @param locale - active locale id.
 * @returns the formatted percentage.
 */
export function formatPercent(value: number, locale: string): string {
  const formatter = resolve(
    percentFormatters,
    locale,
    () => new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  )
  return formatter === undefined ? `${(value * 100).toFixed(2)}%` : formatter.format(value)
}

/**
 * Render one configured rate for the price table.
 *
 * Four significant digits rather than a fixed fraction width, because rates
 * span from a per-million input price down to a cache-read price four orders
 * below it. A fixed width rounds the cheap end away and `String(value)` renders
 * it in exponential notation — `2e-7` is not a price a reader can check.
 * @param value - currency units per one million tokens.
 * @param locale - active locale id.
 * @returns the rate as written in the active locale.
 */
export function formatRate(value: number, locale: string): string {
  if (value === 0) return '0'
  const formatter = resolve(
    rateFormatters,
    locale,
    () => new Intl.NumberFormat(locale, { maximumSignificantDigits: 4 }),
  )
  return formatter === undefined ? String(value) : formatter.format(value)
}

/** Local midnight of one `YYYY-MM-DD` day key, or `undefined` when malformed. */
function dayTime(day: string): number | undefined {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (matched === null) return undefined
  const time = new Date(
    Number(matched[1]),
    Number(matched[2]) - 1,
    Number(matched[3]),
  ).getTime()
  return Number.isFinite(time) ? time : undefined
}

/**
 * Render one day key as a date the reader's language writes.
 *
 * The wire carries days as `YYYY-MM-DD` because that is a sortable key, not
 * because it is readable; a reader should not have to decode ISO order to find
 * out which day they are hovering.
 * @param day - the report's day key.
 * @param locale - active locale id.
 * @returns the localized date, or the key itself when it cannot be parsed.
 */
export function formatDay(day: string, locale: string): string {
  const time = dayTime(day)
  if (time === undefined) return day
  const formatter = resolve(
    dayFormatters,
    locale,
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
  )
  return formatter === undefined ? day : formatter.format(time)
}
