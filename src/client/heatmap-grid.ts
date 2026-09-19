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

const MS_PER_DAY = 86_400_000
const DAYS_PER_WEEK = 7

/** Sunday-first dictionary keys for the long weekday names. */
export const WEEKDAY_KEYS = ['wd.0', 'wd.1', 'wd.2', 'wd.3', 'wd.4', 'wd.5', 'wd.6'] as const

/** One of the seven long weekday dictionary keys. */
export type WeekdayKey = typeof WEEKDAY_KEYS[number]

/** Local midnight of one instant. */
export function midnight(time: number): number {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Local `YYYY-MM-DD` key for one instant. */
export function dayKey(time: number): string {
  const date = new Date(time)
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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
export function dayTime(day: string): number | undefined {
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
 * Long weekday dictionary key for one instant.
 * @param time - Unix epoch milliseconds.
 * @returns the `wd.*` key naming that instant's weekday.
 */
export function weekdayKey(time: number): WeekdayKey {
  return WEEKDAY_KEYS[new Date(time).getDay()] ?? 'wd.0'
}

/**
 * Inclusive bounds of the calendar window: `weeks` whole columns ending with
 * the week that contains `now`, opening on a Sunday.
 * @param now - the instant the panel treats as today.
 * @param weeks - number of week columns to span.
 * @returns `[from, to]` in Unix epoch milliseconds.
 */
export function heatmapWindow(now: number, weeks: number): readonly [number, number] {
  const today = midnight(now)
  const elapsed = new Date(today).getDay()
  const from = today - ((weeks - 1) * DAYS_PER_WEEK + elapsed) * MS_PER_DAY
  return [from, today + MS_PER_DAY - 1]
}

/**
 * Column count spanning an inclusive day range, rounded up to whole weeks.
 * @param from - first day, Unix epoch milliseconds.
 * @param to - last day inclusive, Unix epoch milliseconds.
 * @returns the number of week columns.
 */
export function heatmapColumns(from: number, to: number): number {
  // Inclusive range: one day spans one column, so the span is `diff + 1`.
  const days = (midnight(to) - midnight(from)) / MS_PER_DAY + 1
  return Math.max(1, Math.ceil(days / DAYS_PER_WEEK))
}

/** One month label and the column it starts above. */
export interface MonthMarker {
  /** Stable key for the marker's month. */
  readonly key: string
  /** Month number, `1`-`12`. */
  readonly month: number
  /** Zero-based column index the label sits above. */
  readonly index: number
}

/**
 * Month labels for the last twelve months that fall inside the visible columns.
 * @param windowStart - first rendered day, Unix epoch milliseconds (a Sunday).
 * @param to - last rendered day inclusive, Unix epoch milliseconds.
 * @param columns - visible column count.
 * @returns one marker per month, ascending by column.
 */
export function monthMarkers(windowStart: number, to: number, columns: number): MonthMarker[] {
  const markers: MonthMarker[] = []
  const used = new Set<number>()
  const end = new Date(midnight(to))
  for (let back = 11; back >= 0; back -= 1) {
    const month = new Date(end.getFullYear(), end.getMonth() - back, 1)
    const index = Math.floor((midnight(month.getTime()) - windowStart) / MS_PER_DAY / DAYS_PER_WEEK)
    if (index < 0 || index >= columns || used.has(index)) continue
    used.add(index)
    markers.push({
      key: `${String(month.getFullYear())}-${String(month.getMonth())}`,
      month: month.getMonth() + 1,
      index,
    })
  }
  return markers.sort((left, right) => left.index - right.index)
}
