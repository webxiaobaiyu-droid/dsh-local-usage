/**
 * Calendar day vocabulary: the rolling window, its column count, the month
 * markers above it, and the day-key arithmetic the drill-down shares with it.
 *
 * Pure and date-in only, so the arithmetic that decides where every cell lands
 * is testable without a browser. The window opens on a Sunday and closes on the
 * day the panel treats as today, which keeps every column a whole week and lets
 * a narrow panel drop leading columns without splitting one.
 *
 * @module dsh-local-usage/client/heatmap-grid
 */
/** Sunday-first dictionary keys for the long weekday names. */
export declare const WEEKDAY_KEYS: readonly ["wd.0", "wd.1", "wd.2", "wd.3", "wd.4", "wd.5", "wd.6"];
/** One of the seven long weekday dictionary keys. */
export type WeekdayKey = typeof WEEKDAY_KEYS[number];
/** Local midnight of one instant. */
export declare function midnight(time: number): number;
/** Local `YYYY-MM-DD` key for one instant. */
export declare function dayKey(time: number): string;
/**
 * Local midnight of a `YYYY-MM-DD` day key — the inverse of {@link dayKey}.
 *
 * Built through the `Date` constructor's local-time overload rather than parsed
 * as a date string, which would read a bare `YYYY-MM-DD` as UTC and shift the
 * whole day for anyone west of Greenwich.
 *
 * @param day - the day key.
 * @returns Unix epoch milliseconds of that local day's midnight, or `undefined`
 * when the key is malformed.
 */
export declare function dayTime(day: string): number | undefined;
/**
 * Long weekday dictionary key for one instant.
 * @param time - Unix epoch milliseconds.
 * @returns the `wd.*` key naming that instant's weekday.
 */
export declare function weekdayKey(time: number): WeekdayKey;
/**
 * Inclusive bounds of the calendar window: `weeks` whole columns ending with
 * the week that contains `now`, opening on a Sunday.
 * @param now - the instant the panel treats as today.
 * @param weeks - number of week columns to span.
 * @returns `[from, to]` in Unix epoch milliseconds.
 */
export declare function heatmapWindow(now: number, weeks: number): readonly [number, number];
/**
 * Column count spanning an inclusive day range, rounded up to whole weeks.
 * @param from - first day, Unix epoch milliseconds.
 * @param to - last day inclusive, Unix epoch milliseconds.
 * @returns the number of week columns.
 */
export declare function heatmapColumns(from: number, to: number): number;
/** One month label and the column it starts above. */
export interface MonthMarker {
    /** Stable key for the marker's month. */
    readonly key: string;
    /** Month number, `1`-`12`. */
    readonly month: number;
    /** Zero-based column index the label sits above. */
    readonly index: number;
}
/**
 * Month labels for the last twelve months that fall inside the visible columns.
 * @param windowStart - first rendered day, Unix epoch milliseconds (a Sunday).
 * @param to - last rendered day inclusive, Unix epoch milliseconds.
 * @param columns - visible column count.
 * @returns one marker per month, ascending by column.
 */
export declare function monthMarkers(windowStart: number, to: number, columns: number): MonthMarker[];
