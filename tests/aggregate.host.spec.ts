import { describe, expect, it } from 'vitest'
import { buildReport, localDayKey } from '../src/aggregate.ts'
import type { PricingOptions, ReportMeta, SessionUsageInput } from '../src/aggregate.ts'
import type { UsageTokens } from '../src/types.ts'

/** Monday 2026-09-21, 05:00 UTC — 13:00 Beijing, between the peak windows. */
const OFF_PEAK = Date.UTC(2026, 8, 21, 5, 0, 0)
/** Same Monday, 02:00 UTC — 10:00 Beijing, inside a peak window. */
const PEAK = Date.UTC(2026, 8, 21, 2, 0, 0)
const NEXT_DAY = OFF_PEAK + 86_400_000

const OPTIONS: PricingOptions = {
  currency: 'CNY',
  rules: [{ match: 'flash', input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 }],
  fallback: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
  peakWindows: [{ start: 9 * 60, end: 12 * 60 }],
  peakWeekdaysOnly: true,
  peakMultiplier: 2,
}

const META: ReportMeta = {
  generatedAt: 1_700_000_000_000,
  unreadableSessions: 0,
  cached: false,
}

/** One token bucket set with every field stated. */
function tokens(uncachedInputTokens: number, outputTokens = 0): UsageTokens {
  return { uncachedInputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

/** One session input built from `[time, route, tokens]` triples. */
function session(sessionId: string, samples: readonly [number, string, UsageTokens][], createdAt = 0): SessionUsageInput {
  return {
    sessionId,
    createdAt,
    samples: samples.map(([time, route, bucket]) => ({ time, route, tokens: bucket })),
  }
}

describe('localDayKey', () => {
  it('renders a zero-padded local day', () => {
    expect(localDayKey(new Date(2026, 0, 5).getTime())).toBe('2026-01-05')
  })

  it('separates two instants that fall on different local days', () => {
    expect(localDayKey(OFF_PEAK)).not.toBe(localDayKey(NEXT_DAY))
  })
})

describe('buildReport', () => {
  it('sums buckets, calls, and cost across sessions', () => {
    const report = buildReport([
      session('a', [[OFF_PEAK, 'x/flash', tokens(1_000_000)]]),
      session('b', [[OFF_PEAK, 'x/flash', tokens(2_000_000)]]),
    ], OPTIONS, META)

    expect(report.totals.uncachedInputTokens).toBe(3_000_000)
    expect(report.totals.calls).toBe(2)
    expect(report.totals.sessions).toBe(2)
    expect(report.totals.cost).toBeCloseTo(3, 10)
    expect(report.currency).toBe('CNY')
    expect(report.peakMultiplier).toBe(2)
  })

  it('prices a peak sample at the configured multiple', () => {
    const report = buildReport([
      session('a', [[PEAK, 'x/flash', tokens(1_000_000)]]),
    ], OPTIONS, META)

    expect(report.totals.cost).toBeCloseTo(2, 10)
  })

  it('orders day rows ascending and counts the sessions per day', () => {
    const report = buildReport([
      session('a', [[OFF_PEAK, 'x/flash', tokens(1_000_000)]]),
      session('b', [[OFF_PEAK, 'x/flash', tokens(1_000_000)], [NEXT_DAY, 'x/flash', tokens(1_000_000)]]),
    ], OPTIONS, META)

    expect(report.days.map(row => row.day)).toEqual([localDayKey(OFF_PEAK), localDayKey(NEXT_DAY)])
    expect(report.days[0]?.sessions).toBe(2)
    expect(report.days[1]?.sessions).toBe(1)
    expect(report.days[0]?.calls).toBe(2)
  })

  it('ranks routes and sessions by descending cost', () => {
    const report = buildReport([
      session('cheap', [[OFF_PEAK, 'x/flash', tokens(1_000_000)]]),
      session('dear', [[OFF_PEAK, 'x/flash', tokens(5_000_000)]]),
    ], OPTIONS, META)

    expect(report.sessions.map(row => row.sessionId)).toEqual(['dear', 'cheap'])
    expect(report.models.map(row => row.route)).toEqual(['x/flash'])
    expect(report.models[0]?.priced).toBe(true)
  })

  it('flags a route no rule claims and prices it at the fallback rate', () => {
    const report = buildReport([
      session('a', [[OFF_PEAK, 'unknown', tokens(1_000_000)]]),
    ], OPTIONS, META)

    expect(report.models[0]?.priced).toBe(false)
    expect(report.models[0]?.route).toBe('unknown')
    expect(report.unpricedRoutes).toEqual(['unknown'])
    expect(report.unpricedTokens).toBe(1_000_000)
    expect(report.totals.cost).toBeCloseTo(2, 10)
  })

  it('prices an unknown route at the peak rate when the sample is peak', () => {
    const report = buildReport([
      session('a', [[PEAK, 'unknown', tokens(1_000_000)]]),
    ], OPTIONS, META)

    expect(report.totals.cost).toBeCloseTo(4, 10)
  })

  it('omits sessions and days that recorded no usage', () => {
    const report = buildReport([
      session('empty', []),
      session('used', [[OFF_PEAK, 'x/flash', tokens(1_000_000)]], 1234),
    ], OPTIONS, META)

    expect(report.sessions.map(row => row.sessionId)).toEqual(['used'])
    expect(report.scannedSessions).toBe(2)
    expect(report.totals.sessions).toBe(1)
  })

  it('carries session identity facts onto the ranking row', () => {
    const report = buildReport([{
      sessionId: 's-1',
      title: 'Refactor the parser',
      cwd: '/work/app',
      createdAt: 111,
      samples: [{ time: OFF_PEAK, route: 'x/flash', tokens: tokens(1) }],
    }], OPTIONS, META)

    expect(report.sessions[0]).toMatchObject({
      sessionId: 's-1',
      title: 'Refactor the parser',
      cwd: '/work/app',
      createdAt: 111,
      updatedAt: OFF_PEAK,
    })
  })

  it('falls back to the creation time when a session recorded no sample time', () => {
    const report = buildReport([{
      sessionId: 's-1',
      createdAt: 999,
      samples: [],
    }], OPTIONS, META)

    expect(report.sessions).toEqual([])
    expect(report.scannedSessions).toBe(1)
  })

  it('carries the effective rate card and peak schedule onto the report', () => {
    const report = buildReport([], OPTIONS, META)

    expect(report.prices).toEqual([
      { match: 'flash', input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
    ])
    expect(report.fallbackPrice).toEqual({ match: '', input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 })
    expect(report.peakWindows).toEqual(['09:00-12:00'])
    expect(report.peakWeekdaysOnly).toBe(true)
  })

  it('reports an empty aggregate without inventing rows', () => {
    const report = buildReport([], OPTIONS, META)

    expect(report.totals).toEqual({
      uncachedInputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cost: 0,
      calls: 0,
      sessions: 0,
    })
    expect(report.days).toEqual([])
    expect(report.models).toEqual([])
    expect(report.sessions).toEqual([])
    expect(report.unpricedRoutes).toEqual([])
    expect(report.cached).toBe(false)
  })

  it('agrees with a per-sample sum when peak and off-peak samples share a day', () => {
    const report = buildReport([
      session('a', [[PEAK, 'x/flash', tokens(1_000_000)], [OFF_PEAK, 'x/flash', tokens(1_000_000)]]),
    ], OPTIONS, META)

    expect(report.days).toHaveLength(1)
    expect(report.days[0]?.cost).toBeCloseTo(3, 10)
    expect(report.totals.cost).toBeCloseTo(3, 10)
  })
})
