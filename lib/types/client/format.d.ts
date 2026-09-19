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
/**
 * Render one money figure in the report's own currency.
 * @param value - the figure.
 * @param currency - ISO currency code the report states; never converted.
 * @param locale - active locale id.
 * @returns the formatted figure, or `CODE 0.00` when the currency is unknown.
 */
export declare function formatCost(value: number, currency: string, locale: string): string;
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
export declare function formatTokens(value: number, locale: string): string;
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
export declare function formatInteger(value: number, locale: string): string;
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
export declare function formatRate(value: number, locale: string): string;
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
export declare function formatDay(day: string, locale: string): string;
