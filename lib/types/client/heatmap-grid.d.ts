/**
 * Calendar geometry: the rolling window, its column count, and the month
 * markers above it.
 *
 * Pure and date-in only, so the arithmetic that decides where every cell lands
 * is testable without a browser. The window opens on a Sunday and closes on the
 * day the panel treats as today, which keeps every column a whole week and lets
 * a narrow panel drop leading columns without splitting one.
 *
 * @module dsh-local-usage/client/heatmap-grid
 */
/** Local midnight of one instant. */
export declare function midnight(time: number): number;
/** Local `YYYY-MM-DD` key for one instant. */
export declare function dayKey(time: number): string;
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
