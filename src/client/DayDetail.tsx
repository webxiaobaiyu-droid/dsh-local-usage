/**
 * One day's usage, split by the directory it was spent in.
 *
 * The calendar answers "when did this profile spend". A single cell cannot
 * answer the question a reader has next, which is *what* it was spent on, and
 * the only axis in this data that answers that is the working directory a
 * session was created in: a session belongs to exactly one, it is what the
 * harness itself groups session logs by on disk, and it is what a reader means
 * by a project.
 *
 * The split is not pre-computed on the calendar's year report. Narrowing the
 * window to this one day re-folds the samples the Host already cached, so
 * opening a day costs one local round trip and re-reads no log — which is why
 * this view can afford to be a full page rather than a drawn-out fetch.
 *
 * @module dsh-local-usage/client/DayDetail
 */

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { UNKNOWN_PROJECT } from '../types.ts'
import type { UsageInsightsReport, UsageTokens } from '../types.ts'
import { figureRoom } from './format.ts'
import { projectName } from './paths.ts'
import { cacheHitRate } from './cache-rate.ts'
import { WaveChart } from './WaveChart.tsx'
import { HeroSkeleton, ProjectsSkeleton, TilesSkeleton } from './PanelSkeleton.tsx'
import { Tile } from './Tile.tsx'
import { css } from './classes.ts'

/** Everything the view renders and the three controls it offers. */
export interface DayDetailProps {
  /** The day being shown, as the report's `YYYY-MM-DD` key. */
  readonly day: string
  /** That day's report, or `undefined` while the Host is folding it. */
  readonly report: UsageInsightsReport | undefined
  /** Whether the fold failed; the reader recovers through `onRetry`. */
  readonly failed: boolean
  /** Active locale id, which the wave needs to name a month or an hour. */
  readonly locale: string
  /** Panel translate function. */
  readonly t: PropsLocale<'usage'>['t']
  /** Currency formatter owned by the panel. */
  readonly formatCost: (value: number) => string
  /** Compact token formatter owned by the panel, for the tiles. */
  readonly formatTokens: (value: number) => string
  /** Full integer formatter owned by the panel, for the table. */
  readonly formatInteger: (value: number) => string
  /** Percentage formatter owned by the panel, for the cache hit rate. */
  readonly formatPercent: (value: number) => string
  /** Localized date formatter owned by the panel. */
  readonly formatDay: (day: string) => string
  /** Localized weekday name for a day key. */
  readonly weekdayOf: (day: string) => string
  /** Fold the day again after a failure. */
  readonly onRetry: () => void
  /** Leave the drill-down and return to the calendar. */
  readonly onBack: () => void
}

/** Tokens of any token-bearing row. */
function tokensOf(row: UsageTokens): number {
  return row.uncachedInputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens
}

/**
 * Render one day's usage, ranked by the directory that produced it.
 * @param props - the day, its report or its absence, the formatters, and the controls.
 * @returns the day view.
 */
export function DayDetail({
  day, report, failed, locale, t,
  formatCost, formatTokens, formatInteger, formatPercent, formatDay, weekdayOf,
  onRetry, onBack,
}: DayDetailProps): ReactNode {
  const frame = useRef<HTMLElement>(null)

  // The calendar cell that opened this view has unmounted, so focus would fall
  // back to the document body and a keyboard reader would lose their place
  // entirely. Focusing the section — which is named by the date — restarts the
  // reading at the top of the page, and scrolls it into view on the way.
  useEffect(() => { frame.current?.focus() }, [day])

  return (
    <section
      ref={frame}
      className={css.dayDetail}
      tabIndex={-1}
      aria-label={formatDay(day)}
    >
      <header className={css.dayHeader}>
        <div className={css.headerText}>
          <div className={css.dayTitleRow}>
            <Button variant="outline" size="sm" onClick={onBack}>{t('back')}</Button>
            <h2 className={css.dayTitle}>{formatDay(day)}</h2>
            <span className={css.dayWeekday}>{weekdayOf(day)}</span>
          </div>
          <p className={css.subtitle}>{t('daySubtitle')}</p>
        </div>
        {report === undefined
          // A day fold is normally a re-price and lands in a frame or two, but a
          // session that recorded an event since the year was read has to be read
          // again — so the frame is drawn at its real height rather than left to
          // arrive late and push the table down.
          ? (failed ? null : <HeroSkeleton />)
          : (
            <div className={css.hero}>
              <span className={css.heroLabel}>{t('totalCost')}</span>
              <span className={css.heroValue} data-room={figureRoom(formatCost(report.totals.cost))}>
                {formatCost(report.totals.cost)}
              </span>
              {report.prices.some(card => card.peakEnabled) || report.fallbackPrice.peakEnabled
                ? <span className={css.heroDetail}>{t('peakNoteSeparate')}</span>
                : null}
            </div>
          )}
      </header>

      {report === undefined
        ? (failed
          ? (
            <div className={css.failure}>
              <p role="alert">{t('error')}</p>
              <Button variant="outline" size="sm" onClick={onRetry}>{t('retry')}</Button>
            </div>
          )
          : (
            <>
              <TilesSkeleton />
              {/* The day's shape, waiting: the same figure the folded page shows,
                * so the page does not reflow when the fold lands. */}
              <WaveChart
                input={{ days: [], slices: [], range: 'day' }}
                caption={t('waveHourScope')}
                loading
                empty={false}
                locale={locale}
                t={t}
                formatCost={formatCost}
              />
              <ProjectsSkeleton />
            </>
          ))
        : (
          <DayFigures
            report={report}
            locale={locale}
            t={t}
            formatCost={formatCost}
            formatTokens={formatTokens}
            formatInteger={formatInteger}
            formatPercent={formatPercent}
          />
        )}
    </section>
  )
}

/** The figures of a day whose report has arrived. */
function DayFigures({ report, locale, t, formatCost, formatTokens, formatInteger, formatPercent }: {
  readonly report: UsageInsightsReport
  readonly locale: string
  readonly t: PropsLocale<'usage'>['t']
  readonly formatCost: (value: number) => string
  readonly formatTokens: (value: number) => string
  readonly formatInteger: (value: number) => string
  readonly formatPercent: (value: number) => string
}): ReactNode {
  const { totals, projects } = report
  const hitRate = cacheHitRate(totals)
  // Which directory is open. One at a time: the question a reader has is about
  // one directory, and a page of every session on the day is the table again.
  const [open, setOpen] = useState<string | undefined>(undefined)

  return (
    <>
      <div className={css.tiles}>
        <Tile value={formatTokens(tokensOf(totals))} label={t('totalTokens')} />
        <Tile value={formatTokens(totals.uncachedInputTokens)} label={t('inputTokens')} />
        <Tile value={formatTokens(totals.outputTokens)} label={t('outputTokens')} />
        <Tile
          value={formatTokens(totals.cacheReadTokens)}
          label={t('cacheRead')}
          detail={`${t('cacheWrite')} ${formatTokens(totals.cacheWriteTokens)}`}
        />
        {/* The same figure as the range strip, so a day whose caching broke is
            visible from the page that exists to explain that day. */}
        <Tile
          value={hitRate === undefined ? '—' : formatPercent(hitRate)}
          label={t('cacheHitRate')}
          detail={t('cacheHitRateBasis')}
        />
        <Tile value={formatInteger(totals.calls)} label={t('calls')} />
        <Tile value={formatInteger(projects.length)} label={t('projects')} />
      </div>

      {/* The same figure the range page draws, on the same component: a day is
        * just the window whose buckets are hours, and the fold that answers it —
        * `hourly` — is already in this report. */}
      <WaveChart
        input={{ days: report.days, slices: report.slices, range: 'day' }}
        caption={t('waveHourScope')}
        loading={false}
        empty={totals.calls === 0}
        locale={locale}
        t={t}
        formatCost={formatCost}
      />

      {totals.calls === 0
        ? <p className={css.empty}>{t('dayEmpty')}</p>
        : (
          <div className={css.projectBlock}>
            <h3 className={css.projectHeading}>{t('dayProjects')}</h3>
            <table className={css.projectTable}>
              <thead>
                <tr>
                  <th scope="col">{t('projectColumn')}</th>
                  <th scope="col" className={css.numeric}>{t('cost')}</th>
                  <th scope="col" className={css.numeric}>{t('totalTokens')}</th>
                  <th scope="col" className={css.numeric}>{t('outputTokens')}</th>
                  <th scope="col" className={css.numeric}>{t('calls')}</th>
                  <th scope="col" className={css.numeric}>{t('sessions')}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(row => {
                  // A row is either a directory or the bucket of sessions whose
                  // header named none; only the first has a name to shorten.
                  const name = projectName(row.path)
                  const expanded = open === row.path
                  // A session belongs to the bucket when its header named no
                  // directory, which is what the bucket row stands for.
                  const mine = report.sessions.filter(session => (
                    row.path === UNKNOWN_PROJECT ? session.cwd === undefined : session.cwd === row.path
                  ))
                  return (
                    <Fragment key={row.path}>
                      <tr>
                        <th scope="row" className={css.projectCell}>
                          <button
                            type="button"
                            className={css.projectToggle}
                            aria-expanded={expanded}
                            onClick={() => { setOpen(expanded ? undefined : row.path) }}
                          >
                            <span className={css.projectName} title={name === undefined ? undefined : row.path}>
                              {name ?? t('projectUnknown')}
                            </span>
                            {name === undefined ? null : <code className={css.projectPath}>{row.path}</code>}
                            <span className={css.projectToggleHint}>
                              {t('daySessionsIn', { count: formatInteger(mine.length) })}
                            </span>
                          </button>
                        </th>
                        <td className={css.numeric}>{formatCost(row.cost)}</td>
                        <td className={css.numeric}>{formatInteger(tokensOf(row))}</td>
                        <td className={css.numeric}>{formatInteger(row.outputTokens)}</td>
                        <td className={css.numeric}>{formatInteger(row.calls)}</td>
                        <td className={css.numeric}>{formatInteger(row.sessions)}</td>
                      </tr>
                      {/* The sessions of that directory, in the table's own
                          columns: a list of its own would be a second layout to
                          keep aligned with the first. */}
                      {expanded ? mine.map(session => (
                        <tr key={session.sessionId} className={css.sessionInTable}>
                          <th scope="row" className={css.projectCell}>
                            <span className={css.sessionName}>{session.title ?? t('sessionUntitled')}</span>
                          </th>
                          <td className={css.numeric}>{formatCost(session.cost)}</td>
                          <td className={css.numeric}>{formatInteger(tokensOf(session))}</td>
                          <td className={css.numeric}>{formatInteger(session.outputTokens)}</td>
                          <td className={css.numeric}>{formatInteger(session.calls)}</td>
                          <td className={css.numeric} />
                        </tr>
                      )) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </>
  )
}
