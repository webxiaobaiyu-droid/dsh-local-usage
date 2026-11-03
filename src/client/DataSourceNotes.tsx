/**
 * Where the numbers come from, stated next to the numbers.
 *
 * A usage figure is only as trustworthy as its provenance, and this one has an
 * unusual shape worth saying out loud: the harness keeps no usage database, so
 * the panel reads the durable session logs themselves — every session on the
 * host, not just the current workspace — and folds them in memory. The facts a
 * reader would otherwise have to guess at (what is read, from where, what is
 * left out, whether anything leaves the machine) are listed here rather than
 * left to the README.
 *
 * @module dsh-local-usage/client/DataSourceNotes
 */

import type { ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageInsightsReport } from '../types.ts'
import { formatInteger } from './format.ts'
import { css } from './classes.ts'

/** One labelled fact inside the disclosure. */
function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }): ReactNode {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Props for the provenance popover's body. */
export interface DataSourceNotesProps {
  readonly report: UsageInsightsReport
  /** Week columns the calendar spans, stated so the window is not a guess. */
  readonly weeks: number
  /** Active locale id; the counts below are grouped the reader's way. */
  readonly locale: string
  readonly t: PropsLocale<'usage'>['t']
}

/**
 * Render the provenance body.
 * @param props - the report's live counts, the host facts, the calendar window, and the dictionary.
 * @returns the facts list.
 */
export function DataSourceNotes({ report, weeks, locale, t }: DataSourceNotesProps): ReactNode {
  const counts = t('dataCounts', {
    count: formatInteger(report.scannedSessions, locale),
    unreadable: report.unreadableSessions === 0
      ? ''
      : t('unreadableNote', { count: formatInteger(report.unreadableSessions, locale) }),
    source: report.cached ? t('dataCountsCached') : t('dataCountsFresh'),
  })
  return (
    <div className={css.disclosureBody}>
      <p>{t('dataIntro')}</p>
      <dl className={css.facts}>
        <Fact label={t('dataWhereLabel')}>
          <code>{t('dataWherePath')}</code>
          <span>{t('dataWhereValue')}</span>
        </Fact>
        <Fact label={t('dataHowLabel')}>{t('dataHowValue')}</Fact>
        <Fact label={t('dataScopeLabel')}>{t('dataScopeValue')}</Fact>
        <Fact label={t('dataWindowLabel')}>
          {t('dataWindowValue', { weeks: String(weeks), days: String(weeks * 7) })}
        </Fact>
        {report.restoredSessions > 0
          ? (
            <Fact label={t('dataRestoredLabel')}>
              {t('dataRestoredValue', { count: formatInteger(report.restoredSessions, locale) })}
            </Fact>
          )
          : null}
        <Fact label={t('dataExcludedLabel')}>{t('dataExcludedValue')}</Fact>
        <Fact label={t('dataFlowLabel')}>{t('dataFlow')}</Fact>
      </dl>
      <p className={css.pricingHint}>{counts}</p>
      {/* Which figures are estimates rather than arithmetic. It lives here, with
        * the rest of the provenance, because it is a statement about the numbers
        * rather than a number: a route no card matched is billed at the fallback
        * rate, and a reader who cannot see that would read the total as an
        * invoice. */}
      {report.unpricedRoutes.length === 0 ? null : (
        <p className={css.warning} role="note">
          {t('unpriced', { list: report.unpricedRoutes.join(', ') })}
        </p>
      )}
    </div>
  )
}
