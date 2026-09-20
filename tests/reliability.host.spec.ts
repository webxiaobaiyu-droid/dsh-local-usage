/**
 * The reliability fold: what a window's retries, tool errors and failed
 * compactions are counted from, and how a day-bounded window cuts them.
 *
 * Every counter is an event count rather than an inference, so these tests drive
 * real event shapes and check the grouping, the day bucketing, the window cut,
 * and the merge across sessions.
 *
 * @module dsh-local-usage/tests/reliability
 */

import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { reliabilityOf, reliabilityWithin, buildReport, UNKNOWN_CAUSE } from '../src/aggregate.ts'
import type { PricingOptions, SessionUsageInput } from '../src/aggregate.ts'

const MS_PER_DAY = 86_400_000
const DAY_ONE = new Date(2026, 4, 10).getTime()
const DAY_TWO = DAY_ONE + MS_PER_DAY

/** One durable event, structurally faithful without dragging in every field. */
function event(type: string, time: number, data: Record<string, unknown>, seq: number): SessionEvent {
  return { type, seq, time, data } as unknown as SessionEvent
}

const PRICING: PricingOptions = {
  currency: 'CNY',
  rules: [],
  fallback: { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
  peakWindows: [],
  peakWeekdaysOnly: true,
  peakMultiplier: 1,
}

describe('reliabilityOf', () => {
  it('counts retries by the code the failure carried', () => {
    const fold = reliabilityOf([
      event('llm/retry', DAY_ONE, { failure: { message: 'timed out', code: 'TIMEOUT' } }, 1),
      event('llm/retry', DAY_ONE, { failure: { message: 'slow', code: 'TIMEOUT' } }, 2),
      event('llm/retry', DAY_ONE, { failure: { message: '429', code: 'RATE_LIMIT' } }, 3),
    ])
    expect(fold).toHaveLength(1)
    expect(fold[0]?.retries).toBe(3)
    expect(fold[0]?.retryCauses.get('TIMEOUT')).toBe(2)
    expect(fold[0]?.retryCauses.get('RATE_LIMIT')).toBe(1)
  })

  it('counts a failure whose shape it cannot read rather than dropping it', () => {
    const fold = reliabilityOf([event('llm/retry', DAY_ONE, { failure: 'boom' }, 1)])
    expect(fold[0]?.retries).toBe(1)
    expect(fold[0]?.retryCauses.get(UNKNOWN_CAUSE)).toBe(1)
  })

  it('counts tool calls and only those results that carried an error', () => {
    const fold = reliabilityOf([
      event('tool/call', DAY_ONE, { callId: 'a', name: 'read' }, 1),
      event('tool/result', DAY_ONE, { callId: 'a', message: {} }, 2),
      event('tool/call', DAY_ONE, { callId: 'b', name: 'edit' }, 3),
      event('tool/result', DAY_ONE, { callId: 'b', error: { name: 'FsError', code: 'FS_STALE_VERSION' } }, 4),
      event('tool/result', DAY_ONE, { callId: 'c', error: null }, 5),
    ])
    expect(fold[0]?.toolCalls).toBe(2)
    expect(fold[0]?.toolErrors).toBe(1)
    expect(fold[0]?.toolErrorCodes.get('FS_STALE_VERSION')).toBe(1)
  })

  it('falls back to the error name when it carries no code', () => {
    const fold = reliabilityOf([event('tool/result', DAY_ONE, { error: { name: 'WebError' } }, 1)])
    expect(fold[0]?.toolErrorCodes.get('WebError')).toBe(1)
  })

  it('counts compactions attempted and compactions that failed', () => {
    const fold = reliabilityOf([
      event('compaction/start', DAY_ONE, { compactionId: 'c1', turn: 1 }, 1),
      event('compaction/end', DAY_ONE, { compactionId: 'c1', turn: 1, error: '400: bad option' }, 2),
      event('compaction/start', DAY_ONE, { compactionId: 'c2', turn: 2 }, 3),
      event('compaction/end', DAY_ONE, { compactionId: 'c2', turn: 2 }, 4),
    ])
    expect(fold[0]?.compactions).toBe(2)
    expect(fold[0]?.compactionFailures).toBe(1)
  })

  it('buckets by local day, ascending', () => {
    const fold = reliabilityOf([
      event('tool/call', DAY_TWO, { callId: 'a', name: 'read' }, 1),
      event('tool/call', DAY_ONE, { callId: 'b', name: 'read' }, 2),
    ])
    expect(fold.map(day => day.day)).toEqual(['2026-05-10', '2026-05-11'])
  })

  it('records nothing for a log that recorded nothing', () => {
    expect(reliabilityOf([event('assistant/message', DAY_ONE, {}, 1)])).toEqual([])
  })
})

describe('reliabilityWithin', () => {
  const fold = reliabilityOf([
    event('tool/call', DAY_ONE, { callId: 'a', name: 'read' }, 1),
    event('tool/call', DAY_TWO, { callId: 'b', name: 'read' }, 2),
  ])

  it('keeps every day when the window is unbounded', () => {
    expect(reliabilityWithin(fold, undefined, undefined)).toHaveLength(2)
  })

  it('cuts to the days whose own midnight lies inside the window', () => {
    expect(reliabilityWithin(fold, DAY_ONE, DAY_ONE).map(day => day.day)).toEqual(['2026-05-10'])
    expect(reliabilityWithin(fold, DAY_TWO, DAY_TWO).map(day => day.day)).toEqual(['2026-05-11'])
    expect(reliabilityWithin(fold, DAY_ONE, DAY_TWO + 1)).toHaveLength(2)
  })
})

describe('buildReport reliability', () => {
  const input = (sessionId: string, reliability: ReturnType<typeof reliabilityOf>): SessionUsageInput => ({
    sessionId,
    createdAt: DAY_ONE,
    samples: [],
    reliability,
  })

  it('merges every session and orders causes by count', () => {
    const left = reliabilityOf([
      event('llm/retry', DAY_ONE, { failure: { code: 'TIMEOUT' } }, 1),
      event('llm/retry', DAY_ONE, { failure: { code: 'TIMEOUT' } }, 2),
    ])
    const right = reliabilityOf([
      event('llm/retry', DAY_ONE, { failure: { code: 'TIMEOUT' } }, 1),
      event('llm/retry', DAY_ONE, { failure: { code: 'RATE_LIMIT' } }, 2),
      event('tool/call', DAY_ONE, { callId: 'a', name: 'read' }, 3),
      event('tool/result', DAY_ONE, { error: { code: 'FS_NOT_FOUND' } }, 4),
    ])
    const report = buildReport(
      [input('a', left), input('b', right)],
      PRICING,
      { generatedAt: DAY_ONE, unreadableSessions: 0, cached: false },
    )

    expect(report.reliability.retries).toBe(4)
    expect(report.reliability.retryCauses).toEqual([
      { code: 'TIMEOUT', count: 3 },
      { code: 'RATE_LIMIT', count: 1 },
    ])
    expect(report.reliability.toolCalls).toBe(1)
    expect(report.reliability.toolErrors).toBe(1)
    expect(report.reliability.toolErrorCodes).toEqual([{ code: 'FS_NOT_FOUND', count: 1 }])
  })

  it('states nothing for a window whose sessions recorded no reliability at all', () => {
    const report = buildReport(
      [{ sessionId: 'a', createdAt: DAY_ONE, samples: [] }],
      PRICING,
      { generatedAt: DAY_ONE, unreadableSessions: 0, cached: false },
    )
    expect(report.reliability).toMatchObject({ retries: 0, toolCalls: 0, toolErrors: 0, compactionFailures: 0 })
    expect(report.reliability.retryCauses).toEqual([])
  })
})
