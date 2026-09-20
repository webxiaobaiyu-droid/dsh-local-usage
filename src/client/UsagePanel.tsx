/**
 * Usage statistics panel: the year in spend, with a range lens over it.
 *
 * This is a global panel rather than a settings page: the calendar needs the
 * main column's width to show a whole year without scrolling, and what the
 * profile has spent is not a preference. It spans the current year and fills in
 * as the year passes; the range selector narrows the figures and rings the days
 * it covers, so the frame stays put while the reading changes.
 *
 * Everything is fetched per session fold the Host already cached, so switching
 * ranges re-prices instead of re-reading logs — and so does opening a day, which
 * is why a calendar cell can lead to a full page rather than a hover card.
 *
 * The panel owns no copy and no formatting of its own: sentences come from the
 * `usage` dictionary and figures from `format.ts`, both resolved against the
 * active locale. A locale switch therefore costs one re-render and re-reads
 * nothing, because the Host's report is language-neutral — it carries counts
 * and a day key, never a rendered string.
 *
 * @module dsh-local-usage/client/UsagePanel
 */

import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { UsageDayRow, UsageInsightsReport } from '../types.ts'
import { CalendarHeatmap } from './CalendarHeatmap.tsx'
import { cacheHitRate } from './cache-rate.ts'
import { DayDetail } from './DayDetail.tsx'
import { Tile } from './Tile.tsx'
import { dayTime, heatmapWindow, weekdayKey } from './heatmap-grid.ts'
import { DataSourceNotes } from './DataSourceNotes.tsx'
import { PricingNotes } from './PricingNotes.tsx'
import { ReliabilityNotes } from './ReliabilityNotes.tsx'
import { formatCost, formatDay, formatInteger, formatPercent, formatTokens } from './format.ts'
import type { UsageInsightsLocaleKey } from './locales.ts'
import { css } from './classes.ts'

const MS_PER_DAY = 86_400_000
/** Weeks the calendar spans: one rolling year of columns ending with this week. */
const WINDOW_WEEKS = 52

/** Ranges offered, in selection order. */
const RANGES: readonly { readonly id: string; readonly key: UsageInsightsLocaleKey }[] = [
  { id: 'day', key: 'rangeDay' },
  { id: 'week', key: 'range7' },
  { id: 'month', key: 'rangeMonth' },
  { id: 'quarter', key: 'rangeQuarter' },
  { id: 'year', key: 'rangeYear' },
]

/** Registration-side face the panel reads its data through. */
export interface UsagePanelInjected {
  /** Key this panel occupies in the main column, matching the sidebar entry. */
  panelId: MainPanelId
  /**
   * Active locale id, read at call time.
   *
   * The dictionary seat covers copy, but not figures: number, currency and date
   * formatting are properties of the reader's language and have no key to hang
   * off. The renderer re-derives the dictionary function from the locale
   * revision, so a locale switch already re-renders this panel — reading the id
   * during render is enough, and needs no subscription of its own.
   */
  locale: () => string
  /** Assemble the report; `refresh` discards the Host's per-session fold cache. */
  report: (refresh: boolean, from: number, to: number) => Promise<UsageInsightsReport>
}

/** Full component props assembled by the main slot renderer. */
export type UsagePanelProps =
  PropsRuntime<'main'>
  & PropsLocale<'usage'>
  & InjectFace<UsagePanelInjected>

type Translate = UsagePanelProps['t']

/**
 * One report fetch's state.
 *
 * The calendar's window and the selected range are two independent reads that
 * happen to share a window, so they keep two of these: a range change then
 * re-prices only the range, while the year already on screen stays where it is.
 */
type ReportState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly report: UsageInsightsReport }

/** The day page's own fold, kept apart from the calendar's so a slow one never blanks the other. */
type DayState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly report: UsageInsightsReport }

/** Local midnight of one instant. */
function startOfDay(time: number): number {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** First instant of the month containing `time`. */
function startOfMonth(time: number): number {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

/** First instant of the quarter containing `time`. */
function startOfQuarter(time: number): number {
  const date = new Date(time)
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1).getTime()
}

/** First instant of the year containing `time`. */
function startOfYear(time: number): number {
  return new Date(new Date(time).getFullYear(), 0, 1).getTime()
}

/**
 * Inclusive bounds of one selected range, all ending with today.
 * @param id - range id.
 * @param now - the instant the panel treats as today.
 * @returns the range's `[from, to]` in Unix epoch milliseconds.
 */
function rangeBounds(id: string, now: number): readonly [number, number] {
  const today = startOfDay(now)
  const end = today + MS_PER_DAY - 1
  if (id === 'day') return [today, end]
  if (id === 'week') return [today - 6 * MS_PER_DAY, end]
  if (id === 'month') return [startOfMonth(now), end]
  if (id === 'quarter') return [startOfQuarter(now), end]
  return [startOfYear(now), end]
}

/**
 * Contain a render failure to this panel.
 *
 * The slot renderer already keeps a crashing occupant from unmounting the app,
 * but its crash face is an empty element — indistinguishable from a blank page.
 * This boundary inside the panel turns any failure into the panel's own error
 * message with its own retry, so a bug here costs the reader a sentence.
 */
class PanelBoundary extends Component<
  { readonly fallback: ReactNode; readonly children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: unknown): void {
    console.error('usage panel crashed:', error)
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Tokens of one day row. */
function tokensOf(row: UsageDayRow): number {
  return row.uncachedInputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens
}

/**
 * Render the Usage statistics panel.
 * @param props - panel runtime, dictionary, and the injected report reader.
 * @returns the panel content.
 */
export function UsagePanel({ panelId, locale, report, t, usePanelInfo }: UsagePanelProps): ReactNode {
  const [rangeId, setRangeId] = useState('month')
  const [request, setRequest] = useState(0)
  // Two reads, two states. The calendar's window is the expensive one — the first
  // request after a Host restart is what reads every log — and a range change
  // must not pay for it a second time.
  const [gridState, setGridState] = useState<ReportState>({ status: 'idle' })
  const [summaryState, setSummaryState] = useState<ReportState>({ status: 'idle' })
  // Retrying the range must not read the year again, so it has its own counter.
  const [summaryRequest, setSummaryRequest] = useState(0)
  // The day page: which day is open, that day's own fold, and a retry counter.
  const [selectedDay, setSelectedDay] = useState<string | undefined>(undefined)
  const [dayState, setDayState] = useState<DayState>({ status: 'idle' })
  const [dayRequest, setDayRequest] = useState(0)
  // The cell a return trip should land on. Kept after the day closes so leaving
  // a day page puts the reader back on the day they left, not at the top of a
  // year of cells they would have to find again.
  const [returnDay, setReturnDay] = useState<string | undefined>(undefined)
  // Selector form: the frame subscribes the main column to this key, so the
  // panel reads the same keyed selection rather than a second source of truth.
  const activePanelId = usePanelInfo(info => info.activePanelId)
  const active = activePanelId === panelId

  // The year the panel shows is fixed at mount: a session that spans midnight
  // keeps one frame until the panel is reopened.
  const now = useMemo(() => Date.now(), [])
  // The calendar's window: 52 columns ending with this week. It opens on a
  // Sunday, so dropping columns under pressure never splits a week.
  const [gridFrom, gridTo] = useMemo(() => heatmapWindow(now, WINDOW_WEEKS), [now])
  const [rangeFrom, rangeTo] = useMemo(() => rangeBounds(rangeId, now), [rangeId, now])
  const rangeIsWindow = rangeFrom === gridFrom && rangeTo === gridTo

  // The calendar's window. This is the request that reads the logs, so it is the
  // only one that follows the window and the refresh counter — not the range.
  useEffect(() => {
    // A retained-but-hidden panel must not read logs nobody is looking at.
    if (!active) return
    let current = true
    setGridState({ status: 'loading' })
    void report(request > 0, gridFrom, gridTo).then(
      value => { if (current) setGridState({ status: 'ready', report: value }) },
      () => { if (current) setGridState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [active, report, request, gridFrom, gridTo])

  // The selected range, folded over the same samples. It waits for the window to
  // settle rather than racing it: two requests in flight together would each see
  // an empty Host cache and each read every log, which is the cost this split
  // exists to avoid. Once the window has been read the range is a re-price.
  useEffect(() => {
    if (!active) {
      setSummaryState(previous => (previous.status === 'idle' ? previous : { status: 'idle' }))
      return
    }
    if (gridState.status === 'idle' || gridState.status === 'loading') return
    // A range that is the whole window needs no second read: it is already here.
    if (rangeIsWindow && gridState.status === 'ready') {
      setSummaryState({ status: 'ready', report: gridState.report })
      return
    }
    let current = true
    setSummaryState({ status: 'loading' })
    void report(false, rangeFrom, rangeTo).then(
      value => { if (current) setSummaryState({ status: 'ready', report: value }) },
      () => { if (current) setSummaryState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [active, report, rangeFrom, rangeTo, rangeIsWindow, summaryRequest, gridState])

  // The day page's own fold. Cheap by construction: the samples behind it are
  // already in the Host's memory, so narrowing the window to one day re-prices
  // them instead of walking the logs again.
  useEffect(() => {
    // Closing the page — or sitting on another panel — must not leave a stale
    // fold behind for the next open to render for a moment.
    if (!active || selectedDay === undefined) {
      setDayState(previous => (previous.status === 'idle' ? previous : { status: 'idle' }))
      return
    }
    const start = dayTime(selectedDay)
    // Unreachable through the calendar, whose keys are always well formed; a
    // key with no day behind it is reported rather than guessed at.
    if (start === undefined) {
      setDayState({ status: 'error' })
      return
    }
    let current = true
    setDayState({ status: 'loading' })
    void report(false, start, start + MS_PER_DAY - 1).then(
      value => { if (current) setDayState({ status: 'ready', report: value }) },
      () => { if (current) setDayState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [active, dayRequest, report, selectedDay])

  // Read per render, never memoized: the locale id is an input to every figure
  // below, and the panel re-renders on a locale switch because its dictionary
  // function is re-derived from the locale revision.
  const activeLocale = locale()
  // The day page contributes its own currency: it stays open while the
  // calendar's report is being replaced, and a figure formatted in the wrong
  // currency is worse than one formatted a moment late.
  const currency = dayState.status === 'ready' ? dayState.report.currency
    : gridState.status === 'ready' ? gridState.report.currency
      : summaryState.status === 'ready' ? summaryState.report.currency
        : 'CNY'
  // Every formatter is stable until the currency or the language moves. The
  // calendar memoizes the year of cells it draws, and a formatter rebuilt on each
  // render would hand that subtree new props and defeat the memo entirely.
  const money = useCallback(
    (value: number): string => formatCost(value, currency, activeLocale),
    [currency, activeLocale],
  )
  const tokens = useCallback(
    (value: number): string => formatTokens(value, activeLocale),
    [activeLocale],
  )
  const integer = useCallback(
    (value: number): string => formatInteger(value, activeLocale),
    [activeLocale],
  )
  const percent = useCallback(
    (value: number): string => formatPercent(value, activeLocale),
    [activeLocale],
  )
  const dateText = useCallback(
    (value: string): string => formatDay(value, activeLocale),
    [activeLocale],
  )
  const weekdayOf = useCallback((value: string): string => {
    const time = dayTime(value)
    return time === undefined ? '' : t(weekdayKey(time))
  }, [t])

  const gridDays = gridState.status === 'ready' ? gridState.report.days : []
  const peak = gridDays.reduce<UsageDayRow | undefined>(
    (best, day) => (best === undefined || day.cost > best.cost ? day : best),
    undefined,
  )

  return (
    <section
      className={css.panel}
      aria-busy={gridState.status === 'loading' || dayState.status === 'loading'}
    >
      <PanelBoundary
        fallback={(
          <p className={css.status} role="alert">{t('error')}</p>
        )}
      >
        {selectedDay !== undefined ? (
          <DayDetail
            day={selectedDay}
            report={dayState.status === 'ready' ? dayState.report : undefined}
            failed={dayState.status === 'error'}
            t={t}
            formatCost={money}
            formatTokens={tokens}
            formatInteger={integer}
            formatPercent={percent}
            formatDay={dateText}
            weekdayOf={weekdayOf}
            onRetry={() => { setDayRequest(value => value + 1) }}
            // Leaving remembers the cell, so the calendar can hand focus back to
            // the day the reader opened rather than dropping them at the top.
            onBack={() => {
              setReturnDay(selectedDay)
              setSelectedDay(undefined)
            }}
          />
        ) : (
          <>
            <header className={css.header}>
              <div className={css.headerText}>
                <h2 className={css.heading}>{t('heading')}</h2>
                <p className={css.subtitle}>{t('subtitle')}</p>
              </div>
              <div className={css.controls}>
                <div className={css.ranges} role="group" aria-label={t('rangeLabel')}>
                  {RANGES.map(candidate => (
                    <button
                      key={candidate.id}
                      type="button"
                      className={css.range}
                      aria-pressed={candidate.id === rangeId}
                      onClick={() => { setRangeId(candidate.id) }}
                    >
                      {t(candidate.key)}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={gridState.status === 'loading'}
                  onClick={() => { setRequest(value => value + 1) }}
                >
                  {t('refresh')}
                </Button>
              </div>
            </header>

            {gridState.status === 'loading' || gridState.status === 'idle'
              ? <p className={css.status} role="status">{t('loading')}</p>
              : null}
            {gridState.status === 'error' ? (
              <div className={css.failure}>
                <p role="alert">{t('error')}</p>
                <Button variant="outline" size="sm" onClick={() => { setRequest(value => value + 1) }}>
                  {t('retry')}
                </Button>
              </div>
            ) : null}

            {gridState.status === 'ready' ? (
              <>
                {/* The range has its own failure and its own retry: a range that
                 * cannot be folded must not take the year down with it, and
                 * retrying it must not read the year's logs again. */}
                {summaryState.status === 'ready'
                  ? (
                    <SummaryStrip
                      report={summaryState.report}
                      t={t}
                      money={money}
                      tokens={tokens}
                      integer={integer}
                      percent={percent}
                    />
                  )
                  : summaryState.status === 'error'
                    ? (
                      <div className={css.failure}>
                        <p role="alert">{t('error')}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSummaryRequest(value => value + 1) }}
                        >
                          {t('retry')}
                        </Button>
                      </div>
                    )
                    : <p className={css.status} role="status">{t('loading')}</p>}

                <CalendarHeatmap
                  from={gridFrom}
                  to={gridTo}
                  days={gridDays}
                  totalCost={gridState.report.totals.cost}
                  peak={peak}
                  t={t}
                  formatCost={money}
                  formatInteger={integer}
                  formatDay={dateText}
                  onSelectDay={setSelectedDay}
                  {...returnDay === undefined ? {} : { focusDayOnMount: returnDay }}
                />

                <footer className={css.notes}>
                  <ReliabilityNotes
                    reliability={gridState.report.reliability}
                    t={t}
                    integer={integer}
                    percent={percent}
                  />
                  <PricingNotes report={gridState.report} locale={activeLocale} t={t} />
                  <DataSourceNotes
                    report={gridState.report}
                    weeks={WINDOW_WEEKS}
                    locale={activeLocale}
                    t={t}
                  />
                  {gridState.report.unpricedRoutes.length === 0 ? null : (
                    <p className={css.warning} role="note">
                      {t('unpriced', { list: gridState.report.unpricedRoutes.join(', ') })}
                    </p>
                  )}
                </footer>
              </>
            ) : null}
          </>
        )}
      </PanelBoundary>
    </section>
  )
}

/** The selected range's figures: one hero number, then the supporting tiles. */
function SummaryStrip({ report, t, money, tokens, integer, percent }: {
  readonly report: UsageInsightsReport
  readonly t: Translate
  readonly money: (value: number) => string
  readonly tokens: (value: number) => string
  readonly integer: (value: number) => string
  readonly percent: (value: number) => string
}): ReactNode {
  const { totals } = report
  const rangeTokens = report.days.reduce((sum, day) => sum + tokensOf(day), 0)
  const hitRate = cacheHitRate(totals)
  return (
    <section className={css.summary} aria-label={t('rangeLabel')}>
      <div className={css.hero}>
        <span className={css.heroLabel}>{t('totalCost')}</span>
        <span className={css.heroValue}>{money(totals.cost)}</span>
        {report.peakMultiplier <= 1
          ? null
          : <span className={css.heroDetail}>{t('peakNote', { multiplier: String(report.peakMultiplier) })}</span>}
      </div>
      <div className={css.tiles}>
        <Tile value={tokens(rangeTokens)} label={t('totalTokens')} />
        <Tile value={tokens(totals.uncachedInputTokens)} label={t('inputTokens')} />
        <Tile value={tokens(totals.outputTokens)} label={t('outputTokens')} />
        <Tile
          value={tokens(totals.cacheReadTokens)}
          label={t('cacheRead')}
          detail={`${t('cacheWrite')} ${tokens(totals.cacheWriteTokens)}`}
        />
        {/* A window with no prompt tokens has no rate; the dash says so rather
            than printing a zero the reader would compare against real rates. */}
        <Tile
          value={hitRate === undefined ? '—' : percent(hitRate)}
          label={t('cacheHitRate')}
          detail={t('cacheHitRateBasis')}
        />
        <Tile value={integer(totals.calls)} label={t('calls')} />
        <Tile value={integer(totals.sessions)} label={t('sessions')} />
      </div>
      {totals.calls === 0 ? <p className={css.empty}>{t('noUsage')}</p> : null}
    </section>
  )
}
