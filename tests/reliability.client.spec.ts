/**
 * How the reliability block reads its counters: grouping, overflow, and the
 * sentence for a code the dictionary has never heard of.
 *
 * @module dsh-local-usage/tests/reliability-client
 */

import { describe, expect, it } from 'vitest'
import { causeText, hasCompactions, hasToolCalls, signalOverflow, topSignals } from '../src/client/reliability.ts'
import type { UsageSignalRow } from '../src/types.ts'

const rows: UsageSignalRow[] = [
  { code: 'RATE_LIMIT', count: 98 },
  { code: 'TIMEOUT', count: 61 },
  { code: 'TRANSPORT', count: 21 },
  { code: 'SERVER', count: 19 },
  { code: 'SOMETHING_NEW', count: 4 },
]

describe('topSignals', () => {
  it('names the largest codes and stops at the limit', () => {
    expect(topSignals(rows, 2)).toEqual([rows[0], rows[1]])
    expect(topSignals(rows)).toHaveLength(4)
  })

  it('copes with a limit wider than the list, or none at all', () => {
    expect(topSignals(rows, 99)).toHaveLength(5)
    expect(topSignals(rows, 0)).toEqual([])
    expect(topSignals(rows, -1)).toEqual([])
  })
})

describe('signalOverflow', () => {
  it('counts the codes a row did not name', () => {
    expect(signalOverflow(rows, 4)).toBe(1)
    expect(signalOverflow(rows, 5)).toBe(0)
    expect(signalOverflow(rows, 99)).toBe(0)
  })
})

describe('causeText', () => {
  const t = (key: string): string => `dict:${key}`

  it('uses the dictionary sentence for a code it knows', () => {
    expect(causeText('RATE_LIMIT', t)).toBe('dict:causeRateLimit')
    expect(causeText('TIMEOUT', t)).toBe('dict:causeTimeout')
  })

  it('writes an unknown code as itself rather than folding it into "other"', () => {
    expect(causeText('SOMETHING_NEW', t)).toBe('SOMETHING_NEW')
  })
})

describe('share guards', () => {
  const base = {
    retries: 0, retryCauses: [], toolCalls: 0, toolErrors: 0, toolErrorCodes: [],
    compactions: 0, compactionFailures: 0,
  }

  it('states a share only when the population it divides by exists', () => {
    expect(hasToolCalls({ ...base, toolCalls: 0 })).toBe(false)
    expect(hasToolCalls({ ...base, toolCalls: 1 })).toBe(true)
    expect(hasCompactions({ ...base, compactions: 0 })).toBe(false)
    expect(hasCompactions({ ...base, compactions: 1 })).toBe(true)
  })
})
