import { describe, expect, it } from 'vitest'
import { buildReport, localDayKey } from '../src/aggregate.ts'
import type { PricingOptions, ReportMeta, SessionUsageInput } from '../src/aggregate.ts'
import { UNKNOWN_PROJECT } from '../src/types.ts'
import type { UsageTokens } from '../src/types.ts'

/** Monday 2026-09-21, 05:00 UTC — 13:00 Beijing, between the peak windows. */
const OFF_PEAK = Date.UTC(2026, 8, 21, 5, 0, 0)
/** Same Monday, 02:00 UTC — 10:00 Beijing, inside a peak window. */
const PEAK = Date.UTC(2026, 8, 21, 2, 0, 0)
const NEXT_DAY = OFF_PEAK + 86_400_000

const OPTIONS: PricingOptions = {
  currency: 'CNY',
  models: [{
    match: 'flash',
    peakEnabled: true,
    offPeak: { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
    peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
  }],
  fallback: {
    match: '',
    peakEnabled: true,
    offPeak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
    peak: { input: 4, cacheRead: 0.08, cacheWrite: 4, output: 16 },
  },
  peakWindows: [{ start: 9 * 60, end: 12 * 60 }],
  peakWeekdaysOnly: true,
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

    expect(report.prices).toEqual([{
      match: 'flash',
      peakEnabled: true,
      offPeak: { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
      peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
    }])
    expect(report.fallbackPrice).toMatchObject({
      match: '',
      peakEnabled: true,
      offPeak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
    })
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
    expect(report.projects).toEqual([])
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

describe('project rows', () => {
  it('splits a window by working directory, ranked by cost', () => {
    const report = buildReport([
      { ...session('a', [[OFF_PEAK, 'x/flash', tokens(1_000_000)]]), cwd: '/work/api' },
      { ...session('b', [[OFF_PEAK, 'x/flash', tokens(3_000_000)]]), cwd: '/work/web' },
      { ...session('c', [[OFF_PEAK, 'x/flash', tokens(500_000)]]), cwd: '/work/api' },
    ], OPTIONS, META)

    expect(report.projects.map(row => row.path)).toEqual(['/work/web', '/work/api'])
    expect(report.projects[0]).toMatchObject({ cost: 3, calls: 1, sessions: 1 })
    // Two sessions spent from one directory, so the row counts both.
    expect(report.projects[1]).toMatchObject({ cost: 1.5, calls: 2, sessions: 2 })
    expect(report.projects[1]?.uncachedInputTokens).toBe(1_500_000)
  })

  it('buckets sessions whose header named no directory', () => {
    const report = buildReport([
      session('a', [[OFF_PEAK, 'x/flash', tokens(1_000_000)]]),
    ], OPTIONS, META)

    expect(report.projects.map(row => row.path)).toEqual([UNKNOWN_PROJECT])
    expect(report.projects[0]?.sessions).toBe(1)
  })

  it('adds up to the window total across every directory', () => {
    const report = buildReport([
      {
        ...session('a', [[OFF_PEAK, 'x/flash', tokens(1_000_000)], [NEXT_DAY, 'x/flash', tokens(1_000_000)]]),
        cwd: '/work/api',
      },
      { ...session('b', [[NEXT_DAY, 'x/flash', tokens(2_000_000)]]), cwd: '/work/web' },
      session('c', [[OFF_PEAK, 'x/flash', tokens(500_000)]]),
    ], OPTIONS, META)

    const summed = report.projects.reduce((sum, row) => sum + row.cost, 0)
    const summedCalls = report.projects.reduce((sum, row) => sum + row.calls, 0)
    expect(summed).toBeCloseTo(report.totals.cost, 10)
    expect(summedCalls).toBe(report.totals.calls)
  })

  it('gives a row only to a directory that actually spent', () => {
    const report = buildReport([
      { ...session('idle', []), cwd: '/work/unused' },
      { ...session('busy', [[OFF_PEAK, 'x/flash', tokens(1_000_000)]]), cwd: '/work/api' },
    ], OPTIONS, META)

    expect(report.projects.map(row => row.path)).toEqual(['/work/api'])
  })

  it('folds the day window into the same project axis', () => {
    const whole = buildReport([
      {
        ...session('a', [[OFF_PEAK, 'x/flash', tokens(1_000_000)], [NEXT_DAY, 'x/flash', tokens(4_000_000)]]),
        cwd: '/work/api',
      },
    ], OPTIONS, META)
    const oneDay = buildReport([
      {
        ...session('a', [[NEXT_DAY, 'x/flash', tokens(4_000_000)]]),
        cwd: '/work/api',
      },
    ], OPTIONS, META)

    // A drill-down is the same fold over a narrower window, not a second one.
    expect(oneDay.projects).toHaveLength(1)
    expect(oneDay.projects[0]?.path).toBe(whole.projects[0]?.path)
    expect(oneDay.projects[0]?.cost).toBeCloseTo(4, 10)
    expect(oneDay.projects[0]!.cost).toBeLessThan(whole.projects[0]!.cost)
  })
})

describe('route rates', () => {
  /** The same options with one route overridden, and one rule genuinely matched. */
  /** A card written for one model, placed ahead of the general one. */
  const OVERRIDDEN: PricingOptions = {
    ...OPTIONS,
    models: [{
      match: 'glm-5.3',
      peakEnabled: false,
      offPeak: { input: 3, cacheRead: 0.3, cacheWrite: 3, output: 9 },
      peak: { input: 3, cacheRead: 0.3, cacheWrite: 3, output: 9 },
    }, ...OPTIONS.models],
  }

  it('publishes the source of every rate in effect', () => {
    const report = buildReport([
      session('a', [
        [OFF_PEAK, 'x/flash', tokens(1)],
        [OFF_PEAK, 'agg/glm-5.3-flash', tokens(1)],
        [OFF_PEAK, 'input/gpt-5.6-sol', tokens(1)],
      ]),
    ], OVERRIDDEN, META)

    const byRoute = new Map(report.routeRates.map(row => [row.route, row]))
    expect(byRoute.get('x/flash')).toMatchObject({
      source: 'model',
      model: 'flash',
      peakEnabled: true,
      offPeak: { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
      peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
    })
    // The more specific card comes first in configuration order, so it claims
    // this route even though the general one would also match it.
    expect(byRoute.get('agg/glm-5.3-flash')).toMatchObject({ source: 'model', model: 'glm-5.3' })
    expect(byRoute.get('agg/glm-5.3-flash')?.offPeak.output).toBe(9)
    expect(byRoute.get('input/gpt-5.6-sol')).toMatchObject({ source: 'fallback' })
  })

  it('publishes the off-peak rate even when every sample of the route was peak', () => {
    const report = buildReport([
      session('a', [[PEAK, 'x/flash', tokens(1_000_000)]]),
    ], OPTIONS, META)

    // The sample was priced at the peak set, and the row still states both sets:
    // one number could not say what the route is billed at across a day.
    expect(report.totals.cost).toBeCloseTo(2, 10)
    expect(report.routeRates[0]?.offPeak).toEqual({ input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 })
    expect(report.routeRates[0]?.peak).toEqual({ input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 })
  })

  it('bills a route at the more specific card that claims it', () => {
    const report = buildReport([
      session('a', [[OFF_PEAK, 'agg/glm-5.3-flash', tokens(1_000_000)]]),
    ], OVERRIDDEN, META)

    expect(report.totals.cost).toBeCloseTo(3, 10)
    expect(report.models[0]?.priced).toBe(true)
    expect(report.unpricedRoutes).toEqual([])
  })

  it('still names the routes nothing claims, and counts their tokens', () => {
    const report = buildReport([
      session('a', [[OFF_PEAK, 'input/gpt-5.6-sol', tokens(1_000_000)]]),
    ], OVERRIDDEN, META)

    expect(report.unpricedRoutes).toEqual(['input/gpt-5.6-sol'])
    expect(report.unpricedTokens).toBe(1_000_000)
  })

  it('orders the table by token volume, so the costly routes are read first', () => {
    const report = buildReport([
      session('a', [
        [OFF_PEAK, 'x/flash', tokens(10)],
        [OFF_PEAK, 'input/gpt-5.6-sol', tokens(5_000)],
      ]),
    ], OPTIONS, META)

    expect(report.routeRates.map(row => row.route)).toEqual(['input/gpt-5.6-sol', 'x/flash'])
    expect(report.routeRates.map(row => row.tokens)).toEqual([5_000, 10])
  })
})

describe('buildReport: the shape of the day', () => {
  it('always answers a whole day of ten-minute slices, quiet ones at zero', () => {
    const report = buildReport([session('a', [[PEAK, 'x/flash', tokens(1_000_000)]])], OPTIONS, META)

    expect(report.slices).toHaveLength(144)
    expect(report.slices.map(row => row.minutes)).toEqual(
      Array.from({ length: 144 }, (_, index) => index * 10),
    )
    expect(report.slices[0]).toMatchObject({ cost: 0, calls: 0, tokens: 0 })
  })

  it('buckets in Beijing time rather than the host machine’s zone', () => {
    // 02:00 UTC is 10:00 in Beijing, whatever the machine running this believes:
    // the sixtieth slice is the one that carries it.
    const report = buildReport([session('a', [[PEAK, 'x/flash', tokens(1_000_000)]])], OPTIONS, META)

    expect(report.slices[60]?.minutes).toBe(600)
    expect(report.slices[60]?.calls).toBe(1)
    expect(report.slices[60]?.cost).toBeCloseTo(2)
    expect(report.slices[60]?.tokens).toBe(1_000_000)
  })

  it('accumulates settlements a minute apart into the slice they share', () => {
    const report = buildReport([
      session('a', [[PEAK, 'x/flash', tokens(1_000_000)]]),
      session('b', [[PEAK + 60_000, 'x/flash', tokens(2_000_000)]]),
    ], OPTIONS, META)

    expect(report.slices[60]).toMatchObject({ calls: 2, tokens: 3_000_000 })
    expect(report.slices.reduce((sum, row) => sum + row.calls, 0)).toBe(2)
  })
})
