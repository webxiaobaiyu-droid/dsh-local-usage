/**
 * The window's spend, listed by the route that billed it and the directory it
 * happened in.
 *
 * The figure above answers what the window's shape was; these answer what it was
 * made of, and they answer it with numbers rather than with curves: a table can
 * be read exactly, compared down a column, and scanned for the one row that is
 * out of proportion, which is what a reader does with a model's or a project's
 * spend. Both of these have been in the report since the fold was written and
 * have had no surface until now.
 *
 * Two tables rather than one with a switch: they answer different questions —
 * *which model* the money went to, and *whose work* it was — and a reader who
 * wants one is not always asking the other. Both are the same table, so both are
 * drawn by the same code.
 *
 * @module dsh-local-usage/client/StatsTables
 */

import type { ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageCosted, UsageInsightsReport } from '../types.ts'
import { projectName } from './paths.ts'
import { tokensOf } from './tokens.ts'
import { UNKNOWN_PROJECT } from '../types.ts'
import { css } from './classes.ts'

/**
 * Rows a table lists before the reader has seen enough.
 *
 * A profile can carry dozens of routes; the ones worth reading are the ones at
 * the top of a list already sorted by cost, and the count beneath says how many
 * were left out so the table never claims to be the whole window.
 */
const ROWS = 8

/** One row of either table, already reduced to what the columns read. */
interface StatsRow {
  /** Stable key: a route, or a directory. */
  readonly key: string
  /** What the first column names. */
  readonly name: string
  /** The full path, when the name is a shortened one. */
  readonly detail?: string
  /** Whether this row was billed at the fallback rate. */
  readonly unpriced?: boolean
  readonly figures: UsageCosted
  /** Share of prompt tokens served from cache, when the row billed any prompt. */
  readonly cacheRate?: number
  /** Cost of one million of the row's tokens, when it billed any. */
  readonly unitCost?: number
  /** Extra count in the last column: calls for a route, sessions for a directory. */
  readonly count: number
}

/** Props for the tables. */
export interface StatsTablesProps {
  /** The report for the range the reader selected. */
  readonly report: UsageInsightsReport
  readonly t: PropsLocale<'usage'>['t']
  readonly formatCost: (value: number) => string
  readonly formatInteger: (value: number) => string
  readonly formatPercent: (value: number) => string
}

/**
 * Render the window's spend by model and by project.
 * @param props - the report and the formatters.
 * @returns the two tables.
 */
export function StatsTables({ report, t, formatCost, formatInteger, formatPercent }: StatsTablesProps): ReactNode {
  // The two derived figures a row can carry: how much of its prompt was served
  // from cache, and what one million of its tokens cost. They are what makes two
  // rows of the same model — one almost entirely cache reads, one almost entirely
  // uncached input — read as different without either being mispriced.
  const derived = (figures: UsageCosted): { cacheRate?: number; unitCost?: number } => {
    const prompt = figures.uncachedInputTokens + figures.cacheReadTokens
    const tokens = tokensOf(figures)
    return {
      ...prompt > 0 ? { cacheRate: figures.cacheReadTokens / prompt } : {},
      ...tokens > 0 ? { unitCost: figures.cost / tokens * 1_000_000 } : {},
    }
  }
  const models: StatsRow[] = report.models.slice(0, ROWS).map(row => ({
    key: row.route,
    name: row.route,
    unpriced: !row.priced,
    figures: row,
    ...derived(row),
    count: row.calls,
  }))
  const projects: StatsRow[] = report.projects.slice(0, ROWS).map(row => {
    // A row is either a directory or the bucket of sessions whose header named
    // none; only the first has a name to shorten.
    const name = projectName(row.path)
    return {
      key: row.path,
      name: name ?? t('projectUnknown'),
      ...name === undefined ? {} : { detail: row.path },
      figures: row,
      ...derived(row),
      count: row.sessions,
    }
  })

  return (
    <div className={css.statsBlock}>
      <StatsTable
        heading={t('statsByModel')}
        nameColumn={t('routeColumn')}
        countColumn={t('calls')}
        rows={models}
        total={report.models.length}
        t={t}
        formatCost={formatCost}
        formatInteger={formatInteger}
        formatPercent={formatPercent}
      />
      <StatsTable
        heading={t('statsByProject')}
        nameColumn={t('projectColumn')}
        countColumn={t('sessions')}
        rows={projects}
        total={report.projects.length}
        t={t}
        formatCost={formatCost}
        formatInteger={formatInteger}
        formatPercent={formatPercent}
      />
    </div>
  )
}

/** One of the two tables: a heading, four columns, and what it left out. */
function StatsTable({ heading, nameColumn, countColumn, rows, total, t, formatCost, formatInteger, formatPercent }: {
  readonly heading: string
  readonly nameColumn: string
  readonly countColumn: string
  readonly rows: readonly StatsRow[]
  /** How many rows the report carried, so a truncated table can say so. */
  readonly total: number
  readonly t: PropsLocale<'usage'>['t']
  readonly formatCost: (value: number) => string
  readonly formatInteger: (value: number) => string
  readonly formatPercent: (value: number) => string
}): ReactNode {
  return (
    <section className={css.tableBlock}>
      <h3 className={css.tableHeading}>{heading}</h3>
      {rows.length === 0
        ? <p className={css.empty}>{t('noUsage')}</p>
        : (
          <table className={`${css.projectTable} ${css.statsTable}`}>
            <colgroup>
              <col className={css.statsColName} />
              <col className={css.statsColTokens} />
              <col className={css.statsColCost} />
              <col className={css.statsColCount} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{nameColumn}</th>
                <th scope="col" className={css.numeric}>{t('totalTokens')}</th>
                <th scope="col" className={css.numeric}>{t('cost')}</th>
                <th scope="col" className={css.numeric}>{countColumn}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <th scope="row" className={css.projectCell}>
                    <span
                      className={css.projectName}
                      title={row.name === UNKNOWN_PROJECT ? undefined : row.name}
                    >
                      {row.name}
                    </span>
                    {row.detail === undefined ? null : <code className={css.projectPath}>{row.detail}</code>}
                    {row.unpriced === true
                      ? <span className={css.unpricedBadge}>{t('pricingFallback')}</span>
                      : null}
                  </th>
                  <td className={css.numeric}>
                    {formatInteger(tokensOf(row.figures))}
                    {row.cacheRate === undefined
                      ? null
                      : <span className={css.statsNote}>{t('statsCacheRate', { percent: formatPercent(row.cacheRate) })}</span>}
                  </td>
                  <td className={css.numeric}>
                    {formatCost(row.figures.cost)}
                    {row.unitCost === undefined
                      ? null
                      : <span className={css.statsNote}>{t('statsUnitCost', { cost: formatCost(row.unitCost) })}</span>}
                  </td>
                  <td className={css.numeric}>{formatInteger(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      {total > rows.length
        ? <p className={css.tableNote}>{t('statsMore', {
          shown: formatInteger(rows.length),
          total: formatInteger(total),
        })}
        </p>
        : null}
    </section>
  )
}
