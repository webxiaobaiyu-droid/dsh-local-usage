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

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  UsageDayRow,
  UsageInsightsProgress,
  UsageInsightsReport,
  UsagePricingResult,
  UsagePricingUpdate,
} from '../types.ts'
import { CalendarHeatmap } from './CalendarHeatmap.tsx'
import { cacheHitRate } from './cache-rate.ts'
import { useEntrance } from './count-up.ts'
import { DayDetail } from './DayDetail.tsx'
import { DataSourceNotes } from './DataSourceNotes.tsx'
import { PanelSkeleton, SummarySkeleton } from './PanelSkeleton.tsx'
import { Popover, RateIcon, SourceIcon } from './Popover.tsx'
import { PricingNotes } from './PricingNotes.tsx'
import {
  summaryFailed,
  summaryIdle,
  summarySettled,
  summarySlow,
  summaryStarted,
} from './summary-state.ts'
import type { SummaryState } from './summary-state.ts'
import { Tile } from './Tile.tsx'
import { StatsTables } from './StatsTables.tsx'
import { WaveChart } from './WaveChart.tsx'
import { dayTime, heatmapWindow, weekdayKey } from './heatmap-grid.ts'
import { tokensOf } from './tokens.ts'
import { figureRoom, formatCost, formatDay, formatInteger, formatPercent, formatTokens } from './format.ts'
import type { UsageInsightsLocaleKey } from './locales.ts'
import { css } from './classes.ts'

const MS_PER_DAY = 86_400_000
/** Weeks the calendar spans: one rolling year of columns ending with this week. */
const WINDOW_WEEKS = 52
/**
 * How long a range fold may run before the strip says it is still going.
 *
 * A re-price folds samples already in hand and normally lands inside a frame or
 * two. Dimming the figures for that long would be a flicker rather than a signal,
 * so the admission waits for a wait worth admitting to.
 */
const STALE_VISIBLE_MS = 180

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
  /** Assemble one report for one window. */
  report: (request: UsagePanelReportRequest) => Promise<UsageInsightsReport>
  /** Persist one write to the per-route rate table and answer with what is in effect. */
  saveRates: (update: UsagePricingUpdate) => Promise<UsagePricingResult>
}

/**
 * One report the panel asks its Host for.
 *
 * An object rather than a positional list because the request keeps gaining
 * optional parts — a refresh, a comparison, a progress sink — and a fourth and
 * fifth positional argument is a call site nobody can read.
 */
export interface UsagePanelReportRequest {
  /** Inclusive lower bound of the window, in Unix epoch milliseconds. */
  readonly from: number
  /** Inclusive upper bound of the window, in Unix epoch milliseconds. */
  readonly to: number
  /** Discard the Host's folds and read every log again. */
  readonly refresh?: boolean
  /**
   * Price the window before this one as well, for the detail view's comparison.
   *
   * Optional and only worth asking for where something reads it: it is another
   * fold of every sample, and the front page shows no comparison at all.
   */
  readonly compare?: boolean
  /**
   * Called with each progress state while the read runs.
   *
   * Only worth passing for a read that may have to open session logs: the panel
   * hands it to the read that draws the year and leaves it off the re-prices,
   * which are answered from folds already in hand and would otherwise flicker
   * through phases they never really had.
   */
  readonly onProgress?: (progress: UsageInsightsProgress) => void
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

/**
 * One report with every figure at zero.
 *
 * The range a reader just clicked has not been folded yet, so the panel has no
 * figures for it — and the figures it does have belong to another range, which is
 * a worse thing to show than nothing. Zeroing them keeps the strip's layout
 * exactly as it was, which is why its figures are not unmounted in the first
 * place, while stating plainly that this range's numbers are not in yet.
 *
 * @param report - the report of the range that was selected before this one.
 * @returns the same report with its figures cleared.
 */
function zeroedOf(report: UsageInsightsReport): UsageInsightsReport {
  return {
    ...report,
    totals: {
      ...report.totals,
      cost: 0,
      calls: 0,
      sessions: 0,
      uncachedInputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
    days: [],
    models: [],
    projects: [],
    sessions: [],
    unpricedRoutes: [],
    unpricedTokens: 0,
  }
}

/**
 * Hold a loading state for at least `ms`, then let it go.
 *
 * A fold over cached samples lands in a few milliseconds, and a loading state
 * that lives for a single frame is not a loading state: it is a flash, and a
 * flash over a figure reads as a glitch. Showing it at once and releasing it no
 * sooner than this is what makes a switch look like a switch.
 *
 * @param active - whether the underlying state is loading.
 * @param ms - how long it must stay on screen once it has begun.
 * @returns whether to draw the loading state.
 */
function useMinimumDwell(active: boolean, ms: number): boolean {
  const [shown, setShown] = useState(active)
  const startedAt = useRef(0)
  useEffect(() => {
    if (active) {
      startedAt.current = Date.now()
      setShown(true)
      return
    }
    const remaining = ms - (Date.now() - startedAt.current)
    if (remaining <= 0) {
      setShown(false)
      return
    }
    const timer = setTimeout(() => { setShown(false) }, remaining)
    return () => { clearTimeout(timer) }
  }, [active, ms])
  return shown
}

/**
 * Render the Usage statistics panel.
 * @param props - panel runtime, dictionary, and the injected report reader.
 * @returns the panel content.
 */
export function UsagePanel({ panelId, locale, report, saveRates, t, usePanelInfo }: UsagePanelProps): ReactNode {
  // Today by default: the question this panel is opened with is almost always
  // "what has this session cost me", and the range selector is one click away
  // from every wider window.
  const [rangeId, setRangeId] = useState('day')
  const [request, setRequest] = useState(0)
  // Two reads, two states. The calendar's window is the expensive one — the first
  // request after a Host restart is what reads every log — and a range change
  // must not pay for it a second time.
  const [gridState, setGridState] = useState<ReportState>({ status: 'idle' })
  // The range's figures, which outlive the fold that replaces them: see
  // `summary-state.ts` for why the strip is never unmounted to show a wait.
  const [summaryState, setSummaryState] = useState<SummaryState>({ status: 'idle' })
  // What the figure may draw. Only a report folded for the range on the selector:
  // during a switch the previous range's series was being re-bucketed under the
  // new range's rule — a single day's rows read as a year of months, one bucket
  // labelled `10月` — which is a chart belonging to neither range, and the thing
  // that made a switch look like it loaded something else first.
  const waveSettled = summaryState.status === 'ready' && summaryState.rangeId === rangeId
  // Held long enough to be a state rather than a flash.
  const waveLoading = useMinimumDwell(!waveSettled, 460)
  // Retrying the range must not read the year again, so it has its own counter.
  const [summaryRequest, setSummaryRequest] = useState(0)
  // The day page: which day is open, that day's own fold, and a retry counter.
  const [selectedDay, setSelectedDay] = useState<string | undefined>(undefined)
  const [dayState, setDayState] = useState<DayState>({ status: 'idle' })
  const [dayRequest, setDayRequest] = useState(0)
  // Bumped after a rate write, so every view re-prices against the new table
  // without discarding the Host's fold cache: the samples did not change.
  const [pricingRevision, setPricingRevision] = useState(0)
  // What the Host says the read is doing, while it is doing it. Only the year's
  // own read reports: a re-price is over before a poll could describe it.
  const [progress, setProgress] = useState<UsageInsightsProgress | undefined>(undefined)
  // Whether the summary strip still owes the reader its entrance. Cleared when
  // the figures land, so a range change afterwards swaps them without replaying
  // the count-up over numbers the reader is already comparing.
  const [entrance, setEntrance] = useState(true)
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
    // The window read is the one that may have to open every log, so it is the
    // one that reports what it is doing.
    void report({
      refresh: request > 0,
      from: gridFrom,
      to: gridTo,
      onProgress: (value) => { if (current) setProgress(value) },
    }).then(
      value => { if (current) setGridState({ status: 'ready', report: value }) },
      () => { if (current) setGridState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [active, report, request, pricingRevision, gridFrom, gridTo])

  // The selected range, folded over the same samples. It waits for the window to
  // settle rather than racing it: two requests in flight together would each see
  // an empty Host cache and each read every log, which is the cost this split
  // exists to avoid. Once the window has been read the range is a re-price.
  useEffect(() => {
    if (!active) {
      setSummaryState(previous => (previous.status === 'idle' ? previous : summaryIdle()))
      return
    }
    if (gridState.status === 'idle' || gridState.status === 'loading') return
    // A range that is the whole window needs no second read: it is already here.
    if (rangeIsWindow && gridState.status === 'ready') {
      setSummaryState(summarySettled(gridState.report, rangeId))
      return
    }
    let current = true
    // The figures already on screen stay through the fold. They keep naming the
    // range they were folded for, which is what makes them safe to leave up.
    setSummaryState(summaryStarted)
    const slow = setTimeout(() => { if (current) setSummaryState(summarySlow) }, STALE_VISIBLE_MS)
    // Compared, because the detail view reads the window before this one; the
    // front page ignores it, and the fold it costs is a re-price of samples
    // already in hand.
    void report({ from: rangeFrom, to: rangeTo, compare: true }).then(
      value => { if (current) setSummaryState(summarySettled(value, rangeId)) },
      () => { if (current) setSummaryState(summaryFailed()) },
    )
    return () => { current = false; clearTimeout(slow) }
  }, [active, report, rangeFrom, rangeTo, rangeIsWindow, summaryRequest, pricingRevision, gridState, rangeId])

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
    void report({ from: start, to: start + MS_PER_DAY - 1 }).then(
      value => { if (current) setDayState({ status: 'ready', report: value }) },
      () => { if (current) setDayState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [active, dayRequest, report, pricingRevision, selectedDay])

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

  // A rate write is followed by a re-read with the cache intact: the *samples*
  // did not change, only the prices applied to them.
  const saveRateTable = useCallback(async (update: UsagePricingUpdate): Promise<void> => {
    await saveRates(update)
    setPricingRevision(value => value + 1)
  }, [saveRates])

  const gridDays = gridState.status === 'ready' ? gridState.report.days : []
  // The year's report, which the two header panels are read from; absent until
  // the read lands, and the only thing that gates their controls.
  const yearReport = gridState.status === 'ready' ? gridState.report : undefined
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
            locale={activeLocale}
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
                <div className={css.tools}>
                  {/* Both of these are consulted rather than read through, so
                      they live beside the figures as hover panels instead of at
                      the bottom of a column the reader has to scroll. They read
                      the year's report, so they wait for it — in place, inert,
                      like the recount button beside them. A control that removes
                      itself for the length of a read is a control the reader
                      reports as missing, and the loading frame around it looks
                      enough like the finished page to be believed. */}
                  <Popover
                    id="dlu-rates"
                    label={t('pricingTitle')}
                    hint={t('pricingTooltip')}
                    icon={<RateIcon />}
                    width={700}
                    disabled={yearReport === undefined}
                  >
                    {yearReport === undefined ? null : (
                      <PricingNotes
                        report={yearReport}
                        t={t}
                        formatTokens={tokens}
                        onSaveRates={saveRateTable}
                      />
                    )}
                  </Popover>
                  <Popover
                    id="dlu-source"
                    label={t('dataTitle')}
                    hint={t('dataTooltip')}
                    icon={<SourceIcon />}
                    width={560}
                    disabled={yearReport === undefined}
                  >
                    {yearReport === undefined ? null : (
                      <DataSourceNotes
                        report={yearReport}
                        weeks={WINDOW_WEEKS}
                        locale={activeLocale}
                        t={t}
                      />
                    )}
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={gridState.status === 'loading'}
                    onClick={() => { setRequest(value => value + 1) }}
                  >
                    {t('refresh')}
                  </Button>
                </div>
              </div>
            </header>

            {gridState.status === 'error' ? (
              <div className={css.failure}>
                <p role="alert">{t('error')}</p>
                <Button variant="outline" size="sm" onClick={() => { setRequest(value => value + 1) }}>
                  {t('retry')}
                </Button>
              </div>
            ) : null}

            {gridState.status === 'loading' || gridState.status === 'idle'
              ? (
                <PanelSkeleton progress={progress} weeks={WINDOW_WEEKS} t={t}>
                  {/* The figure's own loading state, in the figure's own place: the
                    * tide this panel draws for exactly this moment used to live
                    * only inside the ready branch, so a first load showed ghost
                    * lines where the chart goes and then a finished chart appeared
                    * out of nothing. */}
                  <WaveChart
                    input={{ days: [], slices: [], range: rangeId }}
                    caption={t(RANGES.find(candidate => candidate.id === rangeId)?.key ?? 'rangeMonth')}
                    loading
                    empty={false}
                    locale={activeLocale}
                    t={t}
                    formatCost={money}
                  />
                </PanelSkeleton>
              )
              : null}

            {gridState.status === 'ready' ? (
              <>
                {/* The range has its own failure and its own retry: a range that
                 * cannot be folded must not take the year down with it, and
                 * retrying it must not read the year's logs again. */}
                {summaryState.status === 'ready'
                  ? (
                    <SummaryStrip
                      report={waveSettled ? summaryState.report : zeroedOf(summaryState.report)}
                      animate={entrance}
                      stale={summaryState.slow}
                      onEntranceEnd={() => { setEntrance(false) }}
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
                    // The strip's own frame, not a line of text: the first fold of
                    // a range arrives under a calendar that is already drawn, and
                    // a placeholder of another height would settle twice.
                    : <SummarySkeleton />}

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

                {/* The range's own shape, under the calendar. It reads the summary
                 * rather than the window, so it follows the range selector; while
                 * that fold runs it shows the tide rather than the previous
                 * range's water under this range's name. */}
                <WaveChart
                  input={{
                    days: waveSettled ? summaryState.report.days : [],
                    slices: waveSettled ? summaryState.report.slices : [],
                    range: rangeId,
                  }}
                  caption={t(RANGES.find(candidate => candidate.id === rangeId)?.key ?? 'rangeMonth')}
                  loading={waveLoading}
                  empty={waveSettled && summaryState.report.totals.calls === 0}
                  locale={activeLocale}
                  t={t}
                  formatCost={money}
                />

                {/* The window listed, under the figure that drew it. Gated on the
                  * same flag the figure is: rows belong to a range, and the rows of
                  * the range before this one are not this range's rows. */}
                {waveSettled ? (
                  <StatsTables
                    report={summaryState.report}
                    t={t}
                    formatCost={money}
                    formatInteger={integer}
                  />
                ) : null}


              </>
            ) : null}
          </>
        )}
      </PanelBoundary>
    </section>
  )
}

/**
 * The selected range's figures: one hero number, then the supporting tiles.
 *
 * Every figure here is scaled by one entrance share, so the strip fills in as a
 * single thing. `animate` is false for every render after the first read, which
 * is what makes a range switch swap the numbers rather than replay them.
 *
 * `stale` marks figures the reader is still looking at after the selection moved
 * on. They stay mounted and keep their own range's meaning — the strip is only
 * dimmed, never emptied, so a switch that takes a moment does not move the page.
 */
function SummaryStrip({ report, animate, stale, onEntranceEnd, t, money, tokens, integer, percent }: {
  readonly report: UsageInsightsReport
  /** Whether these figures owe the reader their count-up entrance. */
  readonly animate: boolean
  /** Whether a fold for another range is under way behind these figures. */
  readonly stale: boolean
  /** Called once the entrance has landed, or immediately when it is refused. */
  readonly onEntranceEnd: () => void
  readonly t: Translate
  readonly money: (value: number) => string
  readonly tokens: (value: number) => string
  readonly integer: (value: number) => string
  readonly percent: (value: number) => string
}): ReactNode {
  const { totals } = report
  const rangeTokens = report.days.reduce((sum, day) => sum + tokensOf(day), 0)
  const hitRate = cacheHitRate(totals)
  // One share for the whole strip rather than one clock per figure: eight
  // independent count-ups would read as eight things arriving, not one.
  const share = useEntrance(animate, onEntranceEnd)
  // Bucketed from the figure the entrance lands on, never from the value part-way
  // through it: a type size that changed as the digits grew would be a wobble of
  // its own, in the one place this panel is trying not to have one.
  const cost = money(totals.cost)
  return (
    <section
      className={css.summary}
      aria-label={t('rangeLabel')}
      aria-busy={stale}
      data-stale={stale}
    >
      <div className={css.hero}>
        <span className={css.heroLabel}>{t('totalCost')}</span>
        <span className={css.heroValue} data-room={figureRoom(cost)}>
          {money(totals.cost * share)}
        </span>
        {report.prices.some(card => card.peakEnabled) || report.fallbackPrice.peakEnabled
          ? <span className={css.heroDetail}>{t('peakNoteSeparate')}</span>
          : null}
      </div>
      <div className={css.tiles}>
        <Tile value={tokens(rangeTokens * share)} label={t('totalTokens')} />
        <Tile value={tokens(totals.uncachedInputTokens * share)} label={t('inputTokens')} />
        <Tile value={tokens(totals.outputTokens * share)} label={t('outputTokens')} />
        <Tile
          value={tokens(totals.cacheReadTokens * share)}
          label={t('cacheRead')}
          detail={`${t('cacheWrite')} ${tokens(totals.cacheWriteTokens * share)}`}
        />
        {/* A window with no prompt tokens has no rate; the dash says so rather
            than printing a zero the reader would compare against real rates. */}
        <Tile
          value={hitRate === undefined ? '—' : percent(hitRate * share)}
          label={t('cacheHitRate')}
          detail={t('cacheHitRateBasis')}
        />
        <Tile value={integer(totals.calls * share)} label={t('calls')} />
        <Tile value={integer(totals.sessions * share)} label={t('sessions')} />
      </div>
      {totals.calls === 0 ? <p className={css.empty}>{t('noUsage')}</p> : null}
    </section>
  )
}
