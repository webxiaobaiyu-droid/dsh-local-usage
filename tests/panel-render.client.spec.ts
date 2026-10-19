/**
 * What the panel's chrome does before its data arrives.
 *
 * The bug these exist for: the two header panels — the rate editor and the
 * provenance notes — were not rendered at all until the year's report landed. On
 * its own that was invisible, because the rest of the page was obviously still
 * loading. Once the loading frame started drawing the real layout it stopped
 * being invisible: a reader looking at a page that appears finished sees two
 * controls that are simply gone, and reports a feature as removed.
 *
 * So the rule pinned here is about *presence*, not about behaviour: every control
 * the header owns is in the header in every state, and a control that has nothing
 * to show says so instead of disappearing.
 *
 * Rendered with `react-dom/server`, which runs no effects — that is exactly the
 * state under test, since the panel's data arrives through one.
 *
 * @module dsh-local-usage/tests/panel-render
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UsagePanel } from '../src/client/UsagePanel.tsx'
import type { UsagePanelProps } from '../src/client/UsagePanel.tsx'
import { DayDetail } from '../src/client/DayDetail.tsx'
import { Popover } from '../src/client/Popover.tsx'
import { RateEditor } from '../src/client/RateEditor.tsx'
import type { UsageModelPrice } from '../src/types.ts'
import type { UsageInsightsReport } from '../src/types.ts'

/** A translate function that names its key, so markup can be searched for one. */
const t = ((key: string, params?: Record<string, string>): string =>
  params === undefined ? key : `${key}(${Object.values(params).join(',')})`) as never

/** The panel's props with everything injected, and no report until one is asked for. */
function panelProps(): UsagePanelProps {
  return {
    panelId: 'usage',
    locale: () => 'en',
    report: () => new Promise(() => {}),
    saveRates: () => Promise.resolve({ overrides: {} }),
    t,
    // The slot hook, called through rather than subscribed to.
    usePanelInfo: (select: (info: { activePanelId: string }) => unknown) =>
      select({ activePanelId: 'usage' }),
  } as unknown as UsagePanelProps
}

describe('the panel before its report arrives', () => {
  const markup = renderToStaticMarkup(createElement(UsagePanel, panelProps()))

  it('keeps the rate panel in the header, inert rather than absent', () => {
    expect(markup).toContain('aria-label="pricingTitle"')
    expect(markup).toContain('data-disabled="true"')
    expect(markup).toContain('aria-expanded="false"')
  })

  it('keeps the provenance panel there beside it', () => {
    expect(markup).toContain('aria-label="dataTitle"')
  })

  it('keeps the recount button, which was already always present', () => {
    expect(markup).toContain('refresh')
  })

  it('draws the loading frame rather than a page that looks finished', () => {
    expect(markup).toContain('dlu-cellGhost')
    expect(markup).toContain('role="progressbar"')
  })
})

describe('a popover with data behind it', () => {
  it('is live and carries its content once it has something to show', () => {
    const markup = renderToStaticMarkup(createElement(Popover, {
      id: 'x',
      label: 'label',
      hint: 'hint',
      icon: null,
      children: createElement('p', null, 'body'),
    }))

    expect(markup).toContain('aria-disabled="false"')
    expect(markup).toContain('data-disabled="false"')
    // Mounted while closed, so a pinned panel keeps half-typed fields.
    expect(markup).toContain('body')
  })
})

describe('a day whose total is large', () => {
  /** The day page renders its hero from a report, so it can be asked for any figure. */
  const dayBase = {
    day: '2026-09-28',
    t,
    formatTokens: String,
    formatInteger: String,
    formatPercent: String,
    formatDay: String,
    weekdayOf: String,
    onRetry: () => {},
    onBack: () => {},
  }

  /** A day report carrying one total. */
  function dayReport(cost: number): UsageInsightsReport {
    return {
      totals: { cost, uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 1 },
      projects: [],
      // The day page draws the day's own hour profile, so a fixture standing in
      // for a report has to carry the fold a report carries.
      days: [],
      slices: [],
      prices: [],
      fallbackPrice: {
        match: '',
        peakEnabled: false,
        peak: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
        offPeak: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
      },
    } as unknown as UsageInsightsReport
  }

  it('sets an everyday total at the headline size', () => {
    const markup = renderToStaticMarkup(createElement(DayDetail, {
      locale: 'en',
      ...dayBase,
      formatCost: (value: number) => `¥${value.toFixed(2)}`,
      report: dayReport(12.5),
      failed: false,
    }))

    expect(markup).toContain('data-room="normal"')
  })

  it('steps a large total down rather than letting it widen the strip', () => {
    const markup = renderToStaticMarkup(createElement(DayDetail, {
      locale: 'en',
      ...dayBase,
      // The formatter is the panel's; this supplies the shape a total takes in a
      // currency with no symbol configured, which is the longest one reachable.
      formatCost: (value: number) => `CNY ${value.toLocaleString('en')}`,
      report: dayReport(1_234_567.89),
      failed: false,
    }))

    expect(markup).toContain('data-room="overflowing"')
  })
})

describe('the stylesheet keeps the layout a function of the panel, not of the data', () => {
  const css = readFileSync('src/client/styles.ts', 'utf8')

  it('measures the panel so its contents can be laid out by its width', () => {
    expect(css).toContain('container-type: inline-size')
  })

  it('gives the tiles a column count of their own, never one the figures decide', () => {
    // The bug this guards: with an auto-fitting grid, a wider total in the hero
    // left the tiles less room and pushed one onto another row, which changed
    // the strip's height and moved the calendar below it.
    expect(css).not.toContain('repeat(auto-fit, minmax(96px, 1fr))')
    expect(css).toContain('repeat(7, minmax(0, 1fr))')
  })
})

describe('the rate editor', () => {
  const base = {
    currency: 'CNY',
    t,
    formatTokens: String,
    onSave: () => Promise.resolve(),
  }

  it('states an empty window instead of vanishing from the panel', () => {
    const markup = renderToStaticMarkup(createElement(RateEditor, { ...base, models: [] }))

    expect(markup).toContain('pricingModelsTitle')
    expect(markup).toContain('pricingEditorEmpty')
  })

  it('offers a card per model, with both of its price sets', () => {
    const card = (match: string): UsageModelPrice => ({
      match,
      peakEnabled: true,
      offPeak: { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
      peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
    })
    const markup = renderToStaticMarkup(createElement(RateEditor, {
      ...base,
      models: [card('p/m'), card('q/m')],
    }))

    expect(markup).toContain('pricingModelsHint')
    expect(markup).not.toContain('pricingEditorEmpty')
    expect(markup).toContain('p/m')
    expect(markup).toContain('q/m')
    // The peak set is stated for a model that prices it.
    expect(markup).toContain('pricingPeakPrices')
  })
})

describe('the rate editor', () => {
  const base = {
    currency: 'CNY',
    t,
    formatTokens: String,
    onSave: () => Promise.resolve(),
  }

  it('states an empty window instead of vanishing from the panel', () => {
    const markup = renderToStaticMarkup(createElement(RateEditor, { ...base, models: [] }))

    expect(markup).toContain('pricingModelsTitle')
    expect(markup).toContain('pricingEditorEmpty')
  })

  it('offers a card per model, with both of its price sets', () => {
    const card = (match: string): UsageModelPrice => ({
      match,
      peakEnabled: true,
      offPeak: { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
      peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
    })
    const markup = renderToStaticMarkup(createElement(RateEditor, {
      ...base,
      models: [card('p/m'), card('q/m')],
    }))

    expect(markup).toContain('pricingModelsHint')
    expect(markup).not.toContain('pricingEditorEmpty')
    expect(markup).toContain('p/m')
    expect(markup).toContain('q/m')
    // The peak set is stated for a model that prices it.
    expect(markup).toContain('pricingPeakPrices')
  })
})
