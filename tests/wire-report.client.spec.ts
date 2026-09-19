import { describe, expect, it } from 'vitest'
import { normalizeReport } from '../src/client/wire-report.ts'
import type { WireReport } from '../src/client/wire-report.ts'

/** A report as an older Host sends it: only the fields that existed then. */
const LEGACY: WireReport = {
  generatedAt: 1,
  currency: 'CNY',
  totals: {
    uncachedInputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 2,
    cacheWriteTokens: 0,
    cost: 1.5,
    calls: 3,
    sessions: 2,
  },
  days: [{
    day: '2026-09-19',
    uncachedInputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 2,
    cacheWriteTokens: 0,
    cost: 1.5,
    calls: 3,
    sessions: 2,
  }],
}

describe('normalizeReport', () => {
  it('fills every field a newer panel reads but an older Host omits', () => {
    const report = normalizeReport(LEGACY)

    expect(report.prices).toEqual([])
    expect(report.peakWindows).toEqual([])
    expect(report.fallbackPrice).toEqual({ match: '', input: 0, cacheRead: 0, cacheWrite: 0, output: 0 })
    expect(report.peakMultiplier).toBe(1)
    expect(report.peakWeekdaysOnly).toBe(true)
    expect(report.models).toEqual([])
    expect(report.sessions).toEqual([])
    expect(report.unpricedRoutes).toEqual([])
    expect(report.unpricedTokens).toBe(0)
    expect(report.scannedSessions).toBe(0)
    expect(report.unreadableSessions).toBe(0)
    expect(report.cached).toBe(false)
  })

  it('leaves what the Host did send untouched', () => {
    const report = normalizeReport({
      ...LEGACY,
      prices: [{ match: 'flash', input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 }],
      fallbackPrice: { match: '', input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
      peakWindows: ['09:00-12:00'],
      peakWeekdaysOnly: false,
      peakMultiplier: 2,
      cached: true,
    })

    expect(report.days).toHaveLength(1)
    expect(report.totals.cost).toBe(1.5)
    expect(report.prices).toHaveLength(1)
    expect(report.peakWindows).toEqual(['09:00-12:00'])
    expect(report.peakWeekdaysOnly).toBe(false)
    expect(report.peakMultiplier).toBe(2)
    expect(report.cached).toBe(true)
  })
})
