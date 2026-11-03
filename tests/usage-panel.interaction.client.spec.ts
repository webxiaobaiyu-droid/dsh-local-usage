// @vitest-environment jsdom
/**
 * The panel's recount is one event, not a mode.
 *
 * The effect used to pass `refresh: request > 0`; once a reader pressed recount,
 * every later range change, rate write or reactivation kept forcing a full log
 * reread. This test drives the real controls and watches the request the panel
 * hands its Host.
 *
 * @module dsh-local-usage/tests/usage-panel-interaction
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UsagePanel } from '../src/client/UsagePanel.tsx'
import type { UsagePanelProps } from '../src/client/UsagePanel.tsx'
import type { UsageCallsReport, UsageDayRow, UsageInsightsReport } from '../src/types.ts'
import { NO_RELIABILITY } from '../src/types.ts'
import { dayKey } from '../src/client/heatmap-grid.ts'

const t = ((key: string): string => key) as never

const RATE = { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 }

/** A report with no rows, enough for the panel to settle every view. */
function emptyReport(): UsageInsightsReport {
  return {
    generatedAt: 1,
    currency: 'CNY',
    restoredSessions: 0,
    totals: {
      uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
      cost: 0, calls: 0, sessions: 0,
    },
    days: [], models: [], projects: [], sessions: [],
    scannedSessions: 0, unreadableSessions: 0,
    reliability: NO_RELIABILITY,
    unpricedRoutes: [], unpricedTokens: 0, cached: false,
    prices: [], fallbackPrice: { match: '', peakEnabled: false, peak: RATE, offPeak: RATE },
    routeRates: [], peakWindows: [], peakWeekdaysOnly: true, slices: [],
  }
}

/** jsdom has no layout observer; the calendar treats a zero-width box as empty. */
class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('UsagePanel interaction', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('asks for the newly selected range without recounting the corpus', async () => {
    const requests: { refresh?: boolean; from: number; to: number; compare?: boolean }[] = []
    const report = vi.fn(async (request: { refresh?: boolean; from: number; to: number; compare?: boolean }) => {
      requests.push(request)
      return emptyReport()
    })
    const props = {
      panelId: 'usage',
      locale: () => 'en',
      report,
      saveRates: () => Promise.resolve({ models: {} }),
      t,
      usePanelInfo: (select: (info: { activePanelId: string }) => unknown) => select({ activePanelId: 'usage' }),
    } as unknown as UsagePanelProps

    render(createElement(UsagePanel, props))
    await waitFor(() => { expect(report).toHaveBeenCalled() })
    const before = requests.length
    fireEvent.click(screen.getByText('range7'))

    await waitFor(() => {
      // The range fold is the compare request; it must use the new window and
      // must not be a recount.
      expect(requests.slice(before).some(request => request.compare === true && request.refresh !== true)).toBe(true)
    })
  })

  it('goes from a day to that day\'s call log and back to the day', async () => {
    const today = dayKey(Date.now())
    const dayRow: UsageDayRow = {
      day: today, cost: 1, calls: 1, sessions: 1,
      uncachedInputTokens: 10, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 0,
    }
    const report = vi.fn(async () => ({ ...emptyReport(), days: [dayRow] }))
    const callsPage: UsageCallsReport = {
      generatedAt: 1, currency: 'CNY', rows: [], total: 0, offset: 0, limit: 50,
      totals: { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0, calls: 0 },
      routes: [], sessions: 0, projects: 0, scannedSessions: 0, unreadableSessions: 0, cached: true,
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(callsPage), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const props = {
      panelId: 'usage',
      locale: () => 'en',
      report,
      saveRates: () => Promise.resolve({ models: {} }),
      t,
      usePanelInfo: (select: (info: { activePanelId: string }) => unknown) => select({ activePanelId: 'usage' }),
    } as unknown as UsagePanelProps
    const view = render(createElement(UsagePanel, props))

    await waitFor(() => {
      expect(view.container.querySelector(`[data-day="${today}"]`)).not.toBeNull()
    })
    const cell = view.container.querySelector<HTMLButtonElement>(`[data-day="${today}"]`)
    if (cell === null) throw new Error('calendar cell for today missing')
    fireEvent.click(cell)
    const openCalls = await screen.findByText('callsDayOpen')
    fireEvent.click(openCalls)

    await waitFor(() => {
      const calls = fetchMock.mock.calls as unknown as [URL][]
      expect(calls.some(([url]) => String(url).includes('/api/dsh-local-usage/calls'))).toBe(true)
    })
    fireEvent.click(screen.getByText('backToDay'))
    expect(await screen.findByText('daySubtitle')).toBeTruthy()
  })

  it('refreshes once, and later range changes are ordinary reads', async () => {
    const requests: { refresh?: boolean; from: number; to: number; compare?: boolean }[] = []
    const report = vi.fn(async (request: { refresh?: boolean; from: number; to: number; compare?: boolean }) => {
      requests.push(request)
      return emptyReport()
    })
    let activePanelId = 'usage'
    const props = {
      panelId: 'usage',
      locale: () => 'en',
      report,
      saveRates: () => Promise.resolve({ models: {} }),
      t,
      usePanelInfo: (select: (info: { activePanelId: string }) => unknown) => select({ activePanelId }),
    } as unknown as UsagePanelProps

    const view = render(createElement(UsagePanel, props))
    await waitFor(() => { expect(report).toHaveBeenCalled() })

    fireEvent.click(screen.getByText('refresh'))
    await waitFor(() => { expect(requests.some(request => request.refresh === true)).toBe(true) })

    // Leaving and returning to the panel is the re-activation the bug also
    // affected; it must be an ordinary read, not another recount.
    activePanelId = 'other'
    view.rerender(createElement(UsagePanel, props))
    const beforeReturn = requests.length
    activePanelId = 'usage'
    view.rerender(createElement(UsagePanel, props))
    await waitFor(() => {
      expect(requests.slice(beforeReturn).some(request => request.refresh === false)).toBe(true)
    })
  })
})
