/**
 * The year in usage: one cell per day, shaded by what that day cost.
 *
 * There is no charting library in this product and adding one is out of bounds,
 * so the calendar is a CSS grid of fixed-size cells — never fractional tracks,
 * because a cell whose box depends on its track width has no stable intrinsic
 * size to lay out against. A ResizeObserver measures the panel instead: while a
 * year of weeks fits at the minimum cell edge the cells grow to fill it, and
 * below that the grid keeps the minimum edge and drops its oldest weeks. Either
 * way the grid never scrolls sideways.
 *
 * Shading is a quantile ramp over the window's active days (median, then 75th
 * and 90th percentiles), so the scale adapts to how the profile actually spends
 * instead of assuming a distribution.
 *
 * Every cell is a button that opens that day's own page, so the calendar is a
 * way in rather than only a picture of the year. The grid is one tab stop: the
 * arrow keys walk it, Home and End jump within a week, and focus is tracked by
 * (column, row) rather than by DOM offset because the last column stops at
 * today and a plain index would run off its end.
 *
 * @module dsh-local-usage/client/CalendarHeatmap
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageDayRow } from '../types.ts'
import { WEEKDAY_KEYS, dayKey, heatmapColumns, midnight, monthMarkers } from './heatmap-grid.ts'
import { css } from './classes.ts'

const MS_PER_DAY = 86_400_000
const WEEKDAY_ROWS = 7
/** Narrowest cell edge; below the width that fits a year of them the grid trims weeks. */
const MIN_CELL_SIZE = 15
const CELL_GAP = 4
/** Weekday-label gutter, measured in the same fixed pixels as the cells. */
const LABEL_WIDTH = 20
/** Tooltip clamp so a card on an edge column stays on screen. */
const TOOLTIP_HALF_WIDTH = 150
/** Approximate card height; below this viewport offset the card flips under the cell. */
const TOOLTIP_FLIP_ABOVE = 320

/** Compact row gutter labels, matching the `wdShort.*` dictionary keys. */
const WEEKDAY_SHORT_KEYS = ['wdShort.0', 'wdShort.1', 'wdShort.2', 'wdShort.3', 'wdShort.4', 'wdShort.5', 'wdShort.6'] as const

/** One day of the grid: the report row, or `undefined` for a day with no usage. */
type HeatCell = { readonly day: string; readonly row: UsageDayRow | undefined }

/** The hovered cell and where its card is pinned. */
interface Hover {
  readonly key: string
  readonly weekday: number
  readonly row: UsageDayRow | undefined
  readonly level: number
  readonly x: number
  readonly y: number
  readonly placement: 'above' | 'below'
}

/** Everything the calendar renders, resolved by the panel that owns the data. */
export interface CalendarHeatmapProps {
  /** First day of the window, Unix epoch milliseconds; a Sunday by construction. */
  readonly from: number
  /** Last rendered day inclusive, normally today. */
  readonly to: number
  /** Day rows in the window, ascending; days with no usage are simply absent. */
  readonly days: readonly UsageDayRow[]
  /** Cost over the whole window. */
  readonly totalCost: number
  /** The most expensive day in the window, when it has any usage. */
  readonly peak: UsageDayRow | undefined
  /** Panel translate function. */
  readonly t: PropsLocale<'usage'>['t']
  /** Currency formatter owned by the panel. */
  readonly formatCost: (value: number) => string
  /** Full integer formatter: every figure the calendar shows is a drill-down one. */
  readonly formatInteger: (value: number) => string
  /** Localized date formatter, for a day key rendered to a reader. */
  readonly formatDay: (day: string) => string
  /** Open one day's own page. */
  readonly onSelectDay: (day: string) => void
  /**
   * Day the grid should focus when it mounts.
   *
   * Set only when the reader is coming back from a day page, so the return trip
   * puts them on the cell they left from. Left undefined on first mount, when
   * stealing focus would be an interruption rather than a restoration.
   */
  readonly focusDayOnMount?: string
}

/** Tokens of one day row. */
function tokensOf(row: UsageDayRow): number {
  return row.uncachedInputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens
}

/** Linear-interpolated quantile of an ascending, non-empty sample. */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const left = sorted[base] ?? 0
  const right = sorted[Math.min(sorted.length - 1, base + 1)] ?? left
  return left + (right - left) * (position - base)
}

/** The cell edge that fills `width`, never below the minimum. */
function cellSizeFor(width: number, columns: number): number {
  const gaps = Math.max(0, columns - 1) * CELL_GAP
  const available = Math.max(0, width - LABEL_WIDTH - gaps)
  return Math.max(1, Math.floor(available / columns) || 1)
}

/** Track the widest cell edge the container can carry, and how many weeks then fit. */
function useResponsiveGrid(totalColumns: number): {
  containerRef: RefObject<HTMLDivElement>
  cellSize: number
  columns: number
} {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({ cellSize: MIN_CELL_SIZE, columns: totalColumns })

  useEffect(() => {
    const element = containerRef.current
    if (element === null || totalColumns <= 0) return
    const update = (): void => {
      const width = element.clientWidth
      const fitted = Math.floor((width - LABEL_WIDTH + CELL_GAP) / (MIN_CELL_SIZE + CELL_GAP))
      const columns = Math.max(1, Math.min(totalColumns, fitted || 1))
      setState(columns >= totalColumns
        ? { cellSize: cellSizeFor(width, totalColumns), columns: totalColumns }
        : { cellSize: MIN_CELL_SIZE, columns })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [totalColumns])

  return { containerRef, ...state }
}

/**
 * Render the calendar grid plus its legend and hover card.
 * @param props - the window, its day rows, the selected range, formatters, and copy.
 * @returns the calendar figure.
 */
export function CalendarHeatmap({
  from, to, days, totalCost, peak, t,
  formatCost, formatInteger, formatDay, onSelectDay, focusDayOnMount,
}: CalendarHeatmapProps): ReactNode {
  const [hover, setHover] = useState<Hover | undefined>(undefined)

  const first = midnight(from)
  const last = midnight(to)
  const totalColumns = heatmapColumns(first, last)

  const byDay = useMemo(() => new Map(days.map(row => [row.day, row])), [days])
  const grid = useMemo(() => {
    const columns: (HeatCell | null)[][] = []
    for (let column = 0; column < totalColumns; column += 1) {
      const week: (HeatCell | null)[] = []
      for (let row = 0; row < WEEKDAY_ROWS; row += 1) {
        const time = first + (column * WEEKDAY_ROWS + row) * MS_PER_DAY
        if (time > last) {
          week.push(null)
          continue
        }
        const day = dayKey(time)
        week.push({ day, row: byDay.get(day) })
      }
      columns.push(week)
    }
    return columns
  }, [byDay, first, last, totalColumns])

  // Quantile thresholds over the window's active days: a scale that adapts to
  // how this profile spends rather than assuming a distribution.
  const levels = useMemo(() => {
    const active = days.map(row => tokensOf(row)).filter(value => value > 0).sort((a, b) => a - b)
    return { t1: quantile(active, 0.5), t2: quantile(active, 0.75), t3: quantile(active, 0.9) }
  }, [days])

  const { containerRef, cellSize, columns: visibleColumns } = useResponsiveGrid(totalColumns)
  const visible = grid.slice(-visibleColumns)
  // `first` is a Sunday, so dropping whole leading weeks keeps every remaining
  // column week-aligned; positions and markers both read from this start.
  const visibleStart = first + (totalColumns - visibleColumns) * WEEKDAY_ROWS * MS_PER_DAY

  // Roving focus: the grid is a single tab stop and the arrow keys move within
  // it, so exactly one cell is tabbable at a time. Navigation is expressed as
  // (column, row) rather than as a DOM offset because the last column stops at
  // today — an offset walk would step off its end into nothing.
  const [focusCell, setFocusCell] = useState<string | undefined>(focusDayOnMount)
  const cellsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusDayOnMount === undefined) return
    cellsRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDayOnMount}"]`)?.focus()
  }, [focusDayOnMount])

  const renderedDays = useMemo(() => {
    const present = new Set<string>()
    for (const week of grid.slice(-visibleColumns)) {
      for (const cell of week) if (cell !== null) present.add(cell.day)
    }
    return present
  }, [grid, visibleColumns])

  // Today ends the grid, so it is always a rendered cell and always a valid
  // fallback for a focus target the grid no longer holds.
  const focusDay = focusCell !== undefined && renderedDays.has(focusCell) ? focusCell : dayKey(last)

  /**
   * The rendered day at one grid position.
   *
   * A short column is short at the *bottom* — the grid fills forward from its
   * opening Sunday and stops at today — so a position past the end resolves to
   * the nearest cell above it. That one rule gives the arrow keys their
   * boundary behaviour on both axes: stepping down out of a short column stays
   * put, and stepping right into one lands on its last day.
   */
  const dayAt = (column: number, row: number): string | undefined => {
    const week = visible[column]
    if (week === undefined) return undefined
    for (let offset = 0; offset < WEEKDAY_ROWS; offset += 1) {
      const probe = week[row - offset]
      if (probe !== undefined && probe !== null) return probe.day
    }
    return undefined
  }

  /** Move the roving focus, and take real focus with it so the two cannot disagree. */
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, column: number, row: number): void => {
    const target = event.key === 'ArrowLeft' ? dayAt(column - 1, row)
      : event.key === 'ArrowRight' ? dayAt(column + 1, row)
      : event.key === 'ArrowUp' ? dayAt(column, row - 1)
      : event.key === 'ArrowDown' ? dayAt(column, row + 1)
      : event.key === 'Home' ? dayAt(column, 0)
      : event.key === 'End' ? dayAt(column, WEEKDAY_ROWS - 1)
      : undefined
    if (target === undefined) return
    event.preventDefault()
    setFocusCell(target)
    // Focused here rather than in an effect: the tabIndex flip alone only takes
    // effect on the next Tab press, which is not where the reader is looking.
    cellsRef.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus()
  }

  const markers = useMemo(
    () => monthMarkers(visibleStart, last, visibleColumns)
      .map(marker => ({ ...marker, label: t('monthLabel', { n: String(marker.month) }) })),
    [last, t, visibleColumns, visibleStart],
  )

  const trackTemplate = `${String(LABEL_WIDTH)}px repeat(${String(visibleColumns)}, ${String(cellSize)}px)`

  return (
    <figure className={css.calendar}>
      <figcaption className={css.calendarCaption}>
        <div className={css.calendarHeading}>
          <span className={css.calendarTitle}>{t('calendar')}</span>
          <span className={css.calendarYear}>{t('calendarWindow')}</span>
        </div>
        <span className={css.calendarTotal}>{formatCost(totalCost)}</span>
      </figcaption>
      <div className={css.calendarScroll} onMouseLeave={() => { setHover(undefined) }}>
        <div ref={containerRef} className={css.calendarMeasure}>
          <div className={css.monthRow} style={{ gridTemplateColumns: trackTemplate, columnGap: CELL_GAP }}>
            <span />
            {markers.map(marker => (
              <span
                key={marker.key}
                className={css.monthLabel}
                aria-hidden="true"
                style={{ gridColumnStart: marker.index + 2 }}
              >
                {marker.label}
              </span>
            ))}
          </div>
          <div className={css.gridRow} style={{ gridTemplateColumns: trackTemplate, columnGap: CELL_GAP }}>
            <div
              className={css.weekdayColumn}
              aria-hidden="true"
              style={{ gridTemplateRows: `repeat(${String(WEEKDAY_ROWS)}, ${String(cellSize)}px)`, rowGap: CELL_GAP }}
            >
              {WEEKDAY_SHORT_KEYS.map(key => <span key={key} className={css.weekday}>{t(key)}</span>)}
            </div>
            <div
              ref={cellsRef}
              className={css.cells}
              role="grid"
              aria-label={t('calendar')}
              style={{
                // Spans the whole track list: a grid item placed in the single
                // label column would overflow its own track list to the right.
                gridColumn: '2 / -1',
                gridTemplateRows: `repeat(${String(WEEKDAY_ROWS)}, ${String(cellSize)}px)`,
                gridTemplateColumns: `repeat(${String(visibleColumns)}, ${String(cellSize)}px)`,
                gap: CELL_GAP,
              }}
            >
              {/* Row-major with every cell placed explicitly. A real grid row per
               * weekday is what gives each cell a `row` owner in the
               * accessibility tree, and positional focus needs a position to
               * move from. The wrapper draws no box of its own. */}
              {Array.from({ length: WEEKDAY_ROWS }, (_, row) => (
                <div key={row} className={css.cellRow} role="row">
                  {visible.map((week, column) => {
                    const cell = week[row]
                    if (cell === undefined || cell === null) return null
                    const tokens = cell.row === undefined ? 0 : tokensOf(cell.row)
                    const level = tokens <= 0
                      ? 0
                      : tokens <= levels.t1 ? 1 : tokens <= levels.t2 ? 2 : tokens <= levels.t3 ? 3 : 4
                    // The grid opens on a Sunday and fills one row per weekday,
                    // so the row index *is* the weekday.
                    const label = t('dayLabel', {
                      day: formatDay(cell.day),
                      weekday: t(WEEKDAY_KEYS[row] ?? 'wd.0'),
                      cost: formatCost(cell.row?.cost ?? 0),
                      tokens: formatInteger(tokens),
                      calls: formatInteger(cell.row?.calls ?? 0),
                    })
                    return (
                      <button
                        key={cell.day}
                        type="button"
                        className={css.cell}
                        data-level={level}
                        data-day={cell.day}
                        role="gridcell"
                        aria-label={label}
                        tabIndex={cell.day === focusDay ? 0 : -1}
                        style={{
                          gridRowStart: row + 1,
                          gridColumnStart: column + 1,
                          inlineSize: cellSize,
                          blockSize: cellSize,
                        }}
                        onFocus={() => { setFocusCell(cell.day) }}
                        onKeyDown={(event) => { moveFocus(event, column, row) }}
                        onClick={() => { onSelectDay(cell.day) }}
                        onMouseEnter={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect()
                          setHover({
                            key: cell.day,
                            weekday: row,
                            row: cell.row,
                            level,
                            x: Math.min(
                              Math.max(rect.left + rect.width / 2, TOOLTIP_HALF_WIDTH),
                              window.innerWidth - TOOLTIP_HALF_WIDTH,
                            ),
                            y: rect.top,
                            placement: rect.top < TOOLTIP_FLIP_ABOVE ? 'below' : 'above',
                          })
                        }}
                        onMouseLeave={() => { setHover(undefined) }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={css.legend}>
        <span className={css.legendHint}>{t('calendarHint')}</span>
        <span className={css.legendScale} aria-label={t('calendar')}>
          <span className={css.legendLabel}>{t('legendLess')}</span>
          {[0, 1, 2, 3, 4].map(level => (
            <span key={level} className={css.legendSwatch} data-level={level} />
          ))}
          <span className={css.legendLabel}>{t('legendMore')}</span>
        </span>
        {peak === undefined ? null : (
          <span className={css.legendPeak}>
            {t('peakDay', { day: formatDay(peak.day), cost: formatCost(peak.cost) })}
          </span>
        )}
      </div>
      {hover === undefined ? null : createPortal(
        // Portalled to the document: any ancestor with a filter or transform
        // would otherwise become the containing block for this fixed card and
        // offset it by that ancestor's origin.
        <div
          className={css.tooltip}
          role="tooltip"
          data-placement={hover.placement}
          style={{ left: hover.x, top: hover.placement === 'above' ? hover.y : hover.y + cellSize + 8 }}
        >
          <div className={css.tooltipHead}>
            <span className={css.tooltipDate}>{formatDay(hover.key)}</span>
            <span className={css.tooltipWeekday}>{t(WEEKDAY_KEYS[hover.weekday] ?? 'wd.0')}</span>
          </div>
          {hover.row === undefined ? (
            <p className={css.tooltipEmpty}>{t('noUsageDay')}</p>
          ) : (
            <>
              <div className={css.tooltipHero}>
                <span className={css.tooltipDot} data-level={hover.level} aria-hidden="true" />
                <span className={css.tooltipHeroLabel}>{t('cost')}</span>
                <span className={css.tooltipHeroValue}>{formatCost(hover.row.cost)}</span>
              </div>
              <dl className={css.tooltipRows}>
                <div>
                  <dt>{t('totalTokens')}</dt>
                  <dd>{formatInteger(tokensOf(hover.row))}</dd>
                </div>
                <div>
                  <dt>{t('inputTokens')}</dt>
                  <dd>{formatInteger(hover.row.uncachedInputTokens)}</dd>
                </div>
                <div>
                  <dt>{t('outputTokens')}</dt>
                  <dd>{formatInteger(hover.row.outputTokens)}</dd>
                </div>
                <div>
                  <dt>{t('cacheRead')}</dt>
                  <dd>{formatInteger(hover.row.cacheReadTokens)}</dd>
                </div>
                <div>
                  <dt>{t('calls')}</dt>
                  <dd>{formatInteger(hover.row.calls)}</dd>
                </div>
              </dl>
            </>
          )}
        </div>,
        document.body,
      )}
    </figure>
  )
}
