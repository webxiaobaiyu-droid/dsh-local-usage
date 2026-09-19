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
 * ranges re-prices instead of re-reading logs.
 *
 * @module dsh-local-usage/client/UsagePanel
 */

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { UsageDayRow, UsageInsightsReport } from '../types.ts'
import { CalendarHeatmap } from './CalendarHeatmap.tsx'
import { heatmapWindow } from './heatmap-grid.ts'
import { DataSourceNotes } from './DataSourceNotes.tsx'
import { PricingNotes } from './PricingNotes.tsx'
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
  /** Assemble the report; `refresh` discards the Host's per-session fold cache. */
  report: (refresh: boolean, from: number, to: number) => Promise<UsageInsightsReport>
}

/** Full component props assembled by the main slot renderer. */
export type UsagePanelProps =
  PropsRuntime<'main'>
  & PropsLocale<'usage'>
  & InjectFace<UsagePanelInjected>

type Translate = UsagePanelProps['t']

type ViewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
    readonly status: 'ready'
    /** The calendar's window: its day rows and totals. */
    readonly grid: UsageInsightsReport
    /** The selected range: the summary figures. */
    readonly summary: UsageInsightsReport
  }

const costFormatters = new Map<string, Intl.NumberFormat>()

/** Currency formatter for one currency and fraction width, or `undefined` for a non-ISO currency. */
function costFormatter(currency: string, digits: number): Intl.NumberFormat | undefined {
  const cacheKey = `${currency}\0${String(digits)}`
  const cached = costFormatters.get(cacheKey)
  if (cached !== undefined) return cached
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    costFormatters.set(cacheKey, formatter)
    return formatter
  } catch {
    // A configured currency that is not an ISO code is the operator's choice,
    // not a defect: fall back to a plain suffix rather than failing the panel.
    return undefined
  }
}

/** Format one money figure, widening precision so sub-cent days do not read as zero. */
function formatCost(value: number, currency: string): string {
  const magnitude = Math.abs(value)
  const digits = magnitude === 0 ? 2 : magnitude < 0.01 ? 4 : magnitude < 1 ? 3 : 2
  const formatter = costFormatter(currency, digits)
  return formatter === undefined ? `${currency} ${value.toFixed(digits)}` : formatter.format(value)
}

/** Drop trailing zeros from a fixed-point figure. */
function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

/** Compact token count; the exact number lives in the calendar's hover card. */
function formatTokens(value: number): string {
  if (value < 1000) return String(Math.round(value))
  if (value < 1_000_000) return `${trim(value / 1000, 1)}K`
  return `${trim(value / 1_000_000, 2)}M`
}

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

/** One labelled figure in the summary strip. */
function Tile({ value, label, detail }: {
  readonly value: string
  readonly label: string
  readonly detail?: string
}): ReactNode {
  return (
    <div className={css.tile}>
      <span className={css.tileValue}>{value}</span>
      <span className={css.tileLabel}>{label}</span>
      {detail === undefined ? null : <span className={css.tileDetail}>{detail}</span>}
    </div>
  )
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
export function UsagePanel({ panelId, report, t, usePanelInfo }: UsagePanelProps): ReactNode {
  const [rangeId, setRangeId] = useState('month')
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ViewState>({ status: 'idle' })
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

  useEffect(() => {
    // A retained-but-hidden panel must not read logs nobody is looking at.
    if (!active) return
    let current = true
    setState({ status: 'loading' })
    void (async () => {
      // Sequential, not parallel: the first call is the one that reads every
      // log, and the second then re-prices the samples it cached.
      const gridReport = await report(request > 0, gridFrom, gridTo)
      const summary = rangeIsWindow ? gridReport : await report(false, rangeFrom, rangeTo)
      return { gridReport, summary }
    })().then(
      ({ gridReport, summary }) => {
        if (current) setState({ status: 'ready', grid: gridReport, summary })
      },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [active, report, request, gridFrom, gridTo, rangeFrom, rangeTo, rangeIsWindow])

  const currency = state.status === 'ready' ? state.grid.currency : 'CNY'
  const money = (value: number): string => formatCost(value, currency)

  const gridDays = state.status === 'ready' ? state.grid.days : []
  const peak = gridDays.reduce<UsageDayRow | undefined>(
    (best, day) => (best === undefined || day.cost > best.cost ? day : best),
    undefined,
  )

  return (
    <section className={css.panel} aria-busy={state.status === 'loading'}>
      <PanelBoundary
        fallback={(
          <p className={css.status} role="alert">{t('error')}</p>
        )}
      >
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
              disabled={state.status === 'loading'}
              onClick={() => { setRequest(value => value + 1) }}
            >
              {t('refresh')}
            </Button>
          </div>
        </header>

        {state.status === 'loading' || state.status === 'idle'
          ? <p className={css.status} role="status">{t('loading')}</p>
          : null}
        {state.status === 'error' ? (
          <div className={css.failure}>
            <p role="alert">{t('error')}</p>
            <Button variant="outline" size="sm" onClick={() => { setRequest(value => value + 1) }}>
              {t('retry')}
            </Button>
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <SummaryStrip report={state.summary} t={t} money={money} />

            <CalendarHeatmap
              from={gridFrom}
              to={gridTo}
              days={gridDays}
              totalCost={state.grid.totals.cost}
              peak={peak}
              t={t}
              formatCost={money}
              formatTokens={formatTokens}
            />

            <footer className={css.notes}>
              <PricingNotes report={state.grid} t={t} />
              <DataSourceNotes report={state.grid} weeks={WINDOW_WEEKS} t={t} />
              {state.grid.unpricedRoutes.length === 0 ? null : (
                <p className={css.warning} role="note">
                  {t('unpriced', { list: state.grid.unpricedRoutes.join(', ') })}
                </p>
              )}
            </footer>
          </>
        ) : null}
      </PanelBoundary>
    </section>
  )
}

/** The selected range's figures: one hero number, then the supporting tiles. */
function SummaryStrip({ report, t, money }: {
  readonly report: UsageInsightsReport
  readonly t: Translate
  readonly money: (value: number) => string
}): ReactNode {
  const { totals } = report
  const rangeTokens = report.days.reduce((sum, day) => sum + tokensOf(day), 0)
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
        <Tile value={formatTokens(rangeTokens)} label={t('totalTokens')} />
        <Tile value={formatTokens(totals.uncachedInputTokens)} label={t('inputTokens')} />
        <Tile value={formatTokens(totals.outputTokens)} label={t('outputTokens')} />
        <Tile
          value={formatTokens(totals.cacheReadTokens)}
          label={t('cacheRead')}
          detail={`${t('cacheWrite')} ${formatTokens(totals.cacheWriteTokens)}`}
        />
        <Tile value={String(totals.calls)} label={t('calls')} />
        <Tile value={String(totals.sessions)} label={t('sessions')} />
      </div>
      {totals.calls === 0 ? <p className={css.empty}>{t('noUsage')}</p> : null}
    </section>
  )
}
