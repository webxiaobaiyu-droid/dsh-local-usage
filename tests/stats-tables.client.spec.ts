/**
 * The window listed under the figure.
 *
 * What is pinned here is what a table promises: the columns a reader compares
 * down are the figures the report carried, the rows it does not show are said
 * rather than implied, and a window with nothing in it says so instead of drawing
 * an empty frame.
 */

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatsTables } from '../src/client/StatsTables.tsx'
import type { StatsTablesProps } from '../src/client/StatsTables.tsx'
import { zh } from '../src/client/locales.ts'
import type { UsageInsightsReport } from '../src/types.ts'

/** Dictionary lookup with the runtime's own substitution. */
function t(key: string, params?: Record<string, string>): string {
  const template = (zh as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match)
}

/** A report carrying one route and one directory. */
function reportOf(models: number, projects: number): UsageInsightsReport {
  return {
    currency: 'CNY',
    models: Array.from({ length: models }, (_, index) => ({
      route: `demo/route-${String(index)}`,
      priced: index !== 0,
      cost: 10 - index,
      calls: 3,
      uncachedInputTokens: 1_000,
      outputTokens: 100,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })),
    projects: Array.from({ length: projects }, (_, index) => ({
      path: `/Users/demo/work/project-${String(index)}`,
      sessions: 2,
      cost: 8 - index,
      calls: 2,
      uncachedInputTokens: 500,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })),
  } as unknown as UsageInsightsReport
}

const base = {
  // The component takes the slot runtime's own translate signature; this is the
  // dictionary's, and the cast is the seam between the two.
  t: t as unknown as StatsTablesProps['t'],
  formatCost: (value: number) => `CNY ${value.toFixed(2)}`,
  formatInteger: String,
  formatPercent: (value: number) => `${(value * 100).toFixed(1)}%`,
}

describe('StatsTables', () => {
  it('lists the routes and the directories the report carried', () => {
    const markup = renderToStaticMarkup(createElement(StatsTables, {
      ...base,
      report: reportOf(2, 1),
    }))

    expect(markup).toContain(t('statsByModel'))
    expect(markup).toContain(t('statsByProject'))
    expect(markup).toContain('demo/route-0')
    expect(markup).toContain('project-0')
    // The shortened name is the cell; the full path is beside it.
    expect(markup).toContain('/Users/demo/work/project-0')
    expect(markup).toContain('CNY 10.00')
  })

  it('marks the route that fell back to a default rate', () => {
    const markup = renderToStaticMarkup(createElement(StatsTables, { ...base, report: reportOf(1, 0) }))

    expect(markup).toContain(t('pricingFallback'))
  })

  it('says how many rows it left out rather than stopping quietly', () => {
    const markup = renderToStaticMarkup(createElement(StatsTables, { ...base, report: reportOf(11, 0) }))

    // Eight rows shown of eleven, and the count stated beneath.
    expect(markup).toContain(t('statsMore', { shown: '8', total: '11' }))
    expect(markup).toContain('demo/route-7')
    expect(markup).not.toContain('demo/route-8')
  })

  it('states an empty window instead of drawing a table with no rows', () => {
    const markup = renderToStaticMarkup(createElement(StatsTables, { ...base, report: reportOf(0, 0) }))

    expect(markup).toContain(t('noUsage'))
    expect(markup).not.toContain('<table')
  })
})
