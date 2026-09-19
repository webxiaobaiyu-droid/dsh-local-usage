/**
 * How the money figure is computed, stated where the figure is read.
 *
 * The harness records tokens and never currency, so every cost on this panel is
 * this plugin's own arithmetic over a configured rate card. That makes it an
 * estimate by construction, and the ways it can differ from an invoice —
 * prepaid credit, packages, volume discounts, aggregator markups — are exactly
 * the things a reader would otherwise assume were included. Stating the formula,
 * the rates actually in effect, and the peak schedule is what lets the number be
 * trusted as far as it goes and no further.
 *
 * @module dsh-local-usage/client/PricingNotes
 */

import type { ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageInsightsReport, UsagePriceRow } from '../types.ts'
import { formatRate } from './format.ts'
import { css } from './classes.ts'

/** One rate card row. */
function PriceRow({ row, label, currency, locale }: {
  readonly row: UsagePriceRow
  readonly label: string
  readonly currency: string
  readonly locale: string
}): ReactNode {
  return (
    <tr>
      <td><code className={css.priceMatch}>{label}</code></td>
      <td className={css.numeric}>{formatRate(row.input, locale)}</td>
      <td className={css.numeric}>{formatRate(row.cacheRead, locale)}</td>
      <td className={css.numeric}>{formatRate(row.cacheWrite, locale)}</td>
      <td className={css.numeric}>{formatRate(row.output, locale)}</td>
      <td className={css.priceCurrency}>{currency}</td>
    </tr>
  )
}

/**
 * Render the pricing disclosure.
 * @param props - the report whose rates are in effect, the dictionary, and the open state.
 * @returns the disclosure block.
 */
export function PricingNotes({ report, locale, t }: {
  readonly report: UsageInsightsReport
  /** Active locale id; rate figures are written in the reader's language. */
  readonly locale: string
  readonly t: PropsLocale<'usage'>['t']
}): ReactNode {
  // Resolved only when it will be rendered: an empty window list drops the
  // sentence outright rather than filling it with a placeholder.
  const schedule = report.peakWindows.length === 0
    ? undefined
    : t('pricingPeakSchedule', {
      windows: report.peakWindows.join(t('listSeparator')),
      weekdayScope: report.peakWeekdaysOnly ? t('pricingWeekdaysOnly') : t('pricingEveryDay'),
      multiplier: String(report.peakMultiplier),
    })
  return (
    <details className={css.disclosure}>
      <summary className={css.disclosureSummary}>{t('pricingTitle')}</summary>
      <div className={css.disclosureBody}>
        <p>{t('pricingFormula')}</p>
        {schedule === undefined ? null : <p>{schedule}</p>}
        <p>{t('pricingSource')}</p>
        <p className={css.pricingCaveat}>{t('pricingNotBill')}</p>
        {report.prices.length === 0 ? null : (
          <>
        <p className={css.pricingRatesLabel}>{t('pricingRates', { currency: report.currency })}</p>
        <table className={css.priceTable}>
          <thead>
            <tr>
              <th scope="col">{t('pricingColumnMatch')}</th>
              <th scope="col" className={css.numeric}>{t('pricingColumnInput')}</th>
              <th scope="col" className={css.numeric}>{t('pricingColumnCacheRead')}</th>
              <th scope="col" className={css.numeric}>{t('pricingColumnCacheWrite')}</th>
              <th scope="col" className={css.numeric}>{t('pricingColumnOutput')}</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {report.prices.map(row => (
              <PriceRow
                key={row.match}
                row={row}
                label={row.match}
                currency={report.currency}
                locale={locale}
              />
            ))}
            <PriceRow
              row={report.fallbackPrice}
              label={t('pricingFallback')}
              currency={report.currency}
              locale={locale}
            />
          </tbody>
        </table>
          </>
        )}
        <p className={css.pricingHint}>{t('pricingUnknownRoute')}</p>
      </div>
    </details>
  )
}
