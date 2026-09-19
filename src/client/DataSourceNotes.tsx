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

/**
 * Render the provenance disclosure.
 * @param props - the report's live counts, the host facts, the calendar window, and the dictionary.
 * @returns the disclosure block.
 */
export function DataSourceNotes({ report, weeks, locale, t }: {
  readonly report: UsageInsightsReport
  /** Week columns the calendar spans, stated so the window is not a guess. */
  readonly weeks: number
  /** Active locale id; the counts below are grouped the reader's way. */
  readonly locale: string
  readonly t: PropsLocale<'usage'>['t']
}): ReactNode {
  const counts = t('dataCounts', {
    count: formatInteger(report.scannedSessions, locale),
    unreadable: report.unreadableSessions === 0
      ? ''
      : t('unreadableNote', { count: formatInteger(report.unreadableSessions, locale) }),
    source: report.cached ? t('dataCountsCached') : t('dataCountsFresh'),
  })
  return (
    <details className={css.disclosure}>
      <summary className={css.disclosureSummary}>{t('dataTitle')}</summary>
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
          <Fact label={t('dataExcludedLabel')}>{t('dataExcludedValue')}</Fact>
          <Fact label={t('dataFlowLabel')}>{t('dataFlow')}</Fact>
        </dl>
        <p className={css.pricingHint}>{counts}</p>
      </div>
    </details>
  )
}
