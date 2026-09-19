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
 * @module dsh-local-usage/client/CalendarHeatmap
 */

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageDayRow } from '../types.ts'
import { dayKey, heatmapColumns, midnight, monthMarkers } from './heatmap-grid.ts'
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

/** Sunday-first weekday names, matching the `wd.*` dictionary keys. */
const WEEKDAY_KEYS = ['wd.0', 'wd.1', 'wd.2', 'wd.3', 'wd.4', 'wd.5', 'wd.6'] as const
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
  /** Token formatter owned by the panel. */
  readonly formatTokens: (value: number) => string
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
  from, to, days, totalCost, peak, t, formatCost, formatTokens,
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
              className={css.cells}
              role="grid"
              aria-label={t('calendar')}
              style={{
                // Spans the whole track list: a grid item placed in the single
                // label column would overflow its own track list to the right.
                gridColumn: '2 / -1',
                gridAutoFlow: 'column',
                gridTemplateRows: `repeat(${String(WEEKDAY_ROWS)}, ${String(cellSize)}px)`,
                gridTemplateColumns: `repeat(${String(visibleColumns)}, ${String(cellSize)}px)`,
                gap: CELL_GAP,
              }}
            >
              {visible.map((week, column) => week.map((cell, row) => {
                if (cell === null) return null
                const tokens = cell.row === undefined ? 0 : tokensOf(cell.row)
                const level = tokens <= 0
                  ? 0
                  : tokens <= levels.t1 ? 1 : tokens <= levels.t2 ? 2 : tokens <= levels.t3 ? 3 : 4
                const time = visibleStart + (column * WEEKDAY_ROWS + row) * MS_PER_DAY
                const weekday = new Date(time).getDay()
                const label = t('dayLabel', {
                  day: cell.day,
                  weekday: t(WEEKDAY_KEYS[weekday] ?? 'wd.0'),
                  cost: formatCost(cell.row?.cost ?? 0),
                  tokens: formatTokens(tokens),
                  calls: String(cell.row?.calls ?? 0),
                })
                return (
                  <span
                    key={cell.day}
                    className={css.cell}
                    data-level={level}
                    role="gridcell"
                    aria-label={label}
                    style={{ inlineSize: cellSize, blockSize: cellSize }}
                    onMouseEnter={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect()
                      setHover({
                        key: cell.day,
                        weekday,
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
              }))}
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
            {`${t('peakDay')} ${peak.day} · ${formatCost(peak.cost)}`}
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
            <span className={css.tooltipDate}>{hover.key}</span>
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
                  <dd>{formatTokens(tokensOf(hover.row))}</dd>
                </div>
                <div>
                  <dt>{t('inputTokens')}</dt>
                  <dd>{formatTokens(hover.row.uncachedInputTokens)}</dd>
                </div>
                <div>
                  <dt>{t('outputTokens')}</dt>
                  <dd>{formatTokens(hover.row.outputTokens)}</dd>
                </div>
                <div>
                  <dt>{t('cacheRead')}</dt>
                  <dd>{formatTokens(hover.row.cacheReadTokens)}</dd>
                </div>
                <div>
                  <dt>{t('calls')}</dt>
                  <dd>{String(hover.row.calls)}</dd>
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
