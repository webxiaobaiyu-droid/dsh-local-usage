/**
 * How the money figure is computed, stated where the figure is read.
 *
 * The harness records tokens and never currency, so every cost on this panel is
 * this plugin's own arithmetic over a configured price card. That makes it an
 * estimate by construction, and the ways it can differ from an invoice — prepaid
 * credit, packages, volume discounts, aggregator markups — are exactly the things
 * a reader would otherwise assume were included. Stating the formula, the prices
 * actually in effect, and the peak schedule is what lets the number be trusted as
 * far as it goes and no further.
 *
 * Prices are stated per model and edited there; consumption is stated per route
 * beside them and is not edited at all. The two are deliberately not merged: one
 * card can now cover several routes, and a reader needs to see both which routes
 * it covers and what each of them spent.
 *
 * @module dsh-local-usage/client/PricingNotes
 */

import type { ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsagePricingUpdate, UsageInsightsReport } from '../types.ts'
import { RateEditor } from './RateEditor.tsx'
import { css } from './classes.ts'

/** Props for the pricing popover's body. */
export interface PricingNotesProps {
  readonly report: UsageInsightsReport
  readonly t: PropsLocale<'usage'>['t']
  /** Compact token formatter, used by the route table's volume column. */
  readonly formatTokens: (value: number) => string
  /** Persist one change to the model prices. */
  readonly onSaveRates: (update: UsagePricingUpdate) => Promise<void>
}

/**
 * Render the pricing body.
 * @param props - the report whose prices are in effect, the dictionary, and the write action.
 * @returns the pricing block.
 */
export function PricingNotes({ report, t, formatTokens, onSaveRates }: PricingNotesProps): ReactNode {
  // Resolved only when it will be rendered: an empty window list drops the
  // sentence outright rather than filling it with a placeholder.
  const schedule = report.peakWindows.length === 0
    ? undefined
    : t('pricingPeakSchedule', {
      windows: report.peakWindows.join(t('listSeparator')),
      weekdayScope: report.peakWeekdaysOnly ? t('pricingWeekdaysOnly') : t('pricingEveryDay'),
    })
  return (
    <div className={css.disclosureBody}>
      <p>{t('pricingFormula')}</p>
      {schedule === undefined ? null : <p>{schedule}</p>}
      <p>{t('pricingSource')}</p>
      <p className={css.pricingCaveat}>{t('pricingNotBill')}</p>

      <RateEditor
        models={[...report.prices, report.fallbackPrice]}
        currency={report.currency}
        t={t}
        onSave={onSaveRates}
      />

      {/* What each route spent, beside the cards above that now price it. The
        * route is the unit consumption is reported in whatever the price is; the
        * model column is what says which card claimed it. */}
      <section className={css.editor}>
        <h4 className={css.editorTitle}>{t('pricingRoutesTitle')}</h4>
        {report.routeRates.length === 0
          ? <p className={css.editorHint}>{t('pricingEditorEmpty')}</p>
          : (
            <table className={css.editorTable}>
              <thead>
                <tr>
                  <th scope="col">{t('pricingRouteColumn')}</th>
                  <th scope="col">{t('pricingColumnModel')}</th>
                  <th scope="col" className={css.numeric}>{t('totalTokens')}</th>
                </tr>
              </thead>
              <tbody>
                {report.routeRates.map(entry => (
                  <tr key={entry.route}>
                    <th scope="row">
                      <code className={css.priceMatch} title={entry.route}>{entry.route}</code>
                    </th>
                    <td>
                      <span className={css.editorSource} data-source={entry.source}>
                        {entry.source === 'fallback'
                          ? t('pricingSourceFallback')
                          : entry.model ?? ''}
                      </span>
                    </td>
                    <td className={css.numeric}>{formatTokens(entry.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        <p className={css.pricingHint}>{t('pricingUnknownRoute')}</p>
        {report.unpricedRoutes.length === 0 ? null : (
          <p className={css.warning} role="note">
            {t('unpriced', { list: report.unpricedRoutes.join(', ') })}
          </p>
        )}
      </section>
    </div>
  )
}
