/**
 * Usage statistics panel: the year in spend, with a range lens over it.
 *
 * This is a global panel rather than a settings page: the calendar needs the
 * main column's width to show a whole year without scrolling, and what the
 * profile has spent is not a preference. It spans the current year and fills in
 * as the year passes; the range selector narrows the figures and marks the days
 * it covers on the calendar, so the frame stays put while the reading changes.
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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { DayDetail } from './DayDetail.tsx'
import { PanelSkeleton, SummarySkeleton } from './PanelSkeleton.tsx'
import { PanelBoundary } from './PanelBoundary.tsx'
import { RangeControls } from './RangeControls.tsx'
import { SummaryStrip } from './SummaryStrip.tsx'
import { useUsageReports } from './useUsageReports.ts'
import { CallsPage } from './CallsPage.tsx'
import { PricingPage } from './PricingPage.tsx'
import { StatsTables } from './StatsTables.tsx'
import { WaveChart } from './WaveChart.tsx'
import { dayKey, dayTime, heatmapWindow, nextDayStart, weekdayKey } from './heatmap-grid.ts'
import { RANGES, clampDay, rangeBounds, waveRangeOf } from './range.ts'
import type { CustomRange } from './range.ts'
import { formatCost, formatDay, formatInteger, formatPercent, formatTokens } from './format.ts'
import { css } from './classes.ts'

/** Weeks the calendar spans: one rolling year of columns ending with this week. */
const WINDOW_WEEKS = 52
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

/** The panel's one visible page at a time. */
type PanelPage =
  | { readonly kind: 'calendar' }
  | { readonly kind: 'day'; readonly day: string }
  | { readonly kind: 'pricing' }
  | { readonly kind: 'calls'; readonly range?: { readonly from: number; readonly to: number }; readonly returnDay?: string }

/** Full component props assembled by the main slot renderer. */
export type UsagePanelProps =
  PropsRuntime<'main'>
  & PropsLocale<'usage'>
  & InjectFace<UsagePanelInjected>

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
  // The hand-picked range: kept while another range is selected, so the custom
  // chip comes back to the dates the reader last set rather than to nothing.
  const [customRange, setCustomRange] = useState<CustomRange | undefined>(undefined)
  // The day page, the prices page and the call log are the panel's other pages.
  const [page, setPage] = useState<PanelPage>({ kind: 'calendar' })
  const selectedDay = page.kind === 'day' ? page.day : undefined
  const showPricing = page.kind === 'pricing'
  const showCalls = page.kind === 'calls'
  const callsRange = page.kind === 'calls' ? page.range : undefined
  // Bumped after a rate write: every view re-prices without discarding folds.
  const [pricingRevision, setPricingRevision] = useState(0)
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
  const [rangeFrom, rangeTo] = useMemo(
    () => rangeBounds(rangeId, now, customRange),
    [rangeId, now, customRange],
  )
  const rangeIsWindow = rangeFrom === gridFrom && rangeTo === gridTo
  // The range's identity for everything that outlives a fold: two hand-picked
  // ranges share the id `custom`, and a strip that kept the previous dates' figures
  // under the new dates' label would be naming the wrong window.
  const rangeKey = `${rangeId}:${String(rangeFrom)}:${String(rangeTo)}`
  const waveRange = waveRangeOf(rangeId, rangeFrom, rangeTo)
  const rangeCaption = rangeId === 'custom'
    ? t('rangeCustom')
    : t(RANGES.find(candidate => candidate.id === rangeId)?.key ?? 'rangeMonth')
  const windowFromDay = dayKey(gridFrom)
  const windowToDay = dayKey(gridTo)

  const reports = useUsageReports({
    active,
    report,
    gridFrom,
    gridTo,
    rangeFrom,
    rangeTo,
    rangeIsWindow,
    rangeKey,
    selectedDay,
    pricingRevision,
  })
  const { gridState, summaryState, dayState, progress } = reports

  // What the figure may draw. Only a report folded for the range on the selector:
  // during a switch the previous range's series was being re-bucketed under the
  // new range's rule — a single day's rows read as a year of months, one bucket
  // labelled `10月` — which is a chart belonging to neither range, and the thing
  // that made a switch look like it loaded something else first.
  const waveSettled = summaryState.status === 'ready' && summaryState.rangeId === rangeKey
  // Held long enough to be a state rather than a flash.
  const waveLoading = useMinimumDwell(!waveSettled, 460)

  /** Move the date fields of the custom range, clamped to the calendar's window. */
  function setCustomDay(which: 'from' | 'to', value: string): void {
    // A cleared date field emits an empty string; keep the date it had rather
    // than fall to a range with no start.
    if (value === '') return
    const day = clampDay(value, windowFromDay, windowToDay)
    setCustomRange(current => {
      if (current === undefined) return { from: day, to: day }
      return which === 'from'
        ? { from: day, to: day > current.to ? day : current.to }
        : { from: day < current.from ? day : current.from, to: day }
    })
  }

  /** Select one range, seeding a hand-picked range from the one in effect. */
  function selectRange(id: string): void {
    if (id === 'custom' && customRange === undefined) {
      setCustomRange({ from: dayKey(rangeFrom), to: dayKey(rangeTo) })
    }
    setRangeId(id)
  }

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
        {showCalls && yearReport !== undefined ? (
          <CallsPage
            locale={activeLocale}
            t={t}
            formatCost={money}
            formatTokens={tokens}
            formatInteger={integer}
            formatPercent={percent}
            {...callsRange === undefined ? {} : { initialFrom: callsRange.from, initialTo: callsRange.to }}
            {...callsRange === undefined ? {} : { backLabel: t('backToDay') }}
            onBack={() => {
              setPage(page.kind === 'calls' && page.returnDay !== undefined
                ? { kind: 'day', day: page.returnDay }
                : { kind: 'calendar' })
            }}
          />
        ) : selectedDay !== undefined ? (
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
            onRetry={reports.retryDay}
            // Leaving remembers the cell, so the calendar can hand focus back to
            // the day the reader opened rather than dropping them at the top.
            onBack={() => {
              setReturnDay(selectedDay)
              setPage({ kind: 'calendar' })
            }}
            // The day's own calls, on the page that exists to explain a window:
            // the query opens on this day rather than on the page's default week.
            onOpenCalls={(day) => {
              const start = dayTime(day)
              if (start === undefined) return
              setPage({
                kind: 'calls',
                range: { from: start, to: nextDayStart(start) - 1 },
                returnDay: day,
              })
            }}
          />
        ) : showPricing && yearReport !== undefined ? (
          <PricingPage
            report={yearReport}
            weeks={WINDOW_WEEKS}
            locale={activeLocale}
            t={t}
            formatCost={money}
            onSaveRates={saveRateTable}
            onBack={() => { setPage({ kind: 'calendar' }) }}
          />
        ) : (
          <>
            <header className={css.header}>
              <div className={css.headerText}>
                <h2 className={css.heading}>{t('heading')}</h2>
                <p className={css.subtitle}>{t('subtitle')}</p>
              </div>
              <div className={css.controls}>
                <RangeControls
                  rangeId={rangeId}
                  customRange={customRange}
                  windowFromDay={windowFromDay}
                  windowToDay={windowToDay}
                  t={t}
                  onSelect={selectRange}
                  onCustomDay={setCustomDay}
                />
                <div className={css.tools}>
                  {/* The call log is a page, not a table under the calendar: it
                      can page a year of calls, and the front page already carries
                      a calendar, a wave and two rankings. It waits for the year's
                      report in place, like the prices beside it. */}
                  <button
                    type="button"
                    className={css.breakout}
                    disabled={yearReport === undefined}
                    onClick={() => {
                      setPage({ kind: 'calls' })
                    }}
                  >
                    {t('callsTitle')}
                  </button>
                  {/* Prices are a page, not a hover panel: eight fields per model
                      do not fit a tooltip, and a panel that closes on pointer-leave
                      cannot be typed into. The button waits for the year's report
                      in place, inert, like the recount beside it. */}
                  <button
                    type="button"
                    className={css.breakout}
                    disabled={yearReport === undefined}
                    onClick={() => { setPage({ kind: 'pricing' }) }}
                  >
                    {t('pricingTitle')}
                  </button>
                  {/* Recount: discard the Host's folds and read every log again. */}
                  <Button variant="outline" size="sm" onClick={reports.recount}>
                    {t('refresh')}
                  </Button>
                </div>
              </div>
            </header>

            {gridState.status === 'error' ? (
              <div className={css.failure}>
                <p role="alert">{t('error')}</p>
                <Button variant="outline" size="sm" onClick={reports.retryGrid}>
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
                    input={{ days: [], slices: [], range: waveRange }}
                    caption={rangeCaption}
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
                          onClick={reports.retrySummary}
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
                  rangeFrom={rangeFrom}
                  rangeTo={rangeTo}
                  days={gridDays}
                  totalCost={gridState.report.totals.cost}
                  peak={peak}
                  t={t}
                  formatCost={money}
                  formatInteger={integer}
                  formatDay={dateText}
                  onSelectDay={(day) => { setPage({ kind: 'day', day }) }}
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
                    range: waveRange,
                    from: dayKey(rangeFrom),
                    to: dayKey(rangeTo),
                  }}
                  caption={rangeCaption}
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
                    formatPercent={percent}
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

