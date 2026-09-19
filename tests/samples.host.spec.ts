import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { TokenUsage } from '@deepseek-ai/dsh-llm/types'
import { samplesOf } from '../src/aggregate.ts'

/** Build a minimal but structurally faithful event for the extractor. */
function event(type: string, seq: number, time: number, data: Record<string, unknown>): SessionEvent {
  return { type, seq, time, data } as unknown as SessionEvent
}

/** One assistant settlement carrying provider usage directly on the event; `null` omits the source. */
function message(
  seq: number,
  time: number,
  turn: number,
  step: number,
  usage: TokenUsage,
  source: { provider: string; model: string } | null = { provider: 'p', model: 'm' },
): SessionEvent {
  return event('assistant/message', seq, time, {
    turn,
    step,
    message: source === null ? {} : { source },
    stream: [],
    usage,
  })
}

const USAGE: TokenUsage = {
  inputTokens: 100,
  outputTokens: 10,
  cacheReadTokens: 5,
  cacheWriteTokens: 1,
}

describe('samplesOf', () => {
  it('emits one sample per settlement with its own instant', () => {
    const samples = samplesOf([message(0, 1000, 1, 1, USAGE)])

    expect(samples).toEqual([{
      time: 1000,
      route: 'p/m',
      tokens: { uncachedInputTokens: 100, outputTokens: 10, cacheReadTokens: 5, cacheWriteTokens: 1 },
    }])
  })

  it('replaces the settlement of the same turn and step slot', () => {
    const samples = samplesOf([
      message(0, 1000, 1, 1, USAGE),
      message(1, 2000, 1, 1, { inputTokens: 7, outputTokens: 3 }),
    ])

    expect(samples).toHaveLength(1)
    expect(samples[0]).toEqual({
      time: 2000,
      route: 'p/m',
      tokens: { uncachedInputTokens: 7, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 },
    })
  })

  it('ignores an identical repeat settlement', () => {
    const samples = samplesOf([message(0, 1000, 1, 1, USAGE), message(1, 2000, 1, 1, USAGE)])

    expect(samples).toHaveLength(1)
    expect(samples[0]?.time).toBe(1000)
  })

  it('bills a retried attempt separately once the retry closes the slot', () => {
    const samples = samplesOf([
      message(0, 1000, 1, 1, USAGE),
      event('llm/retry-started', 1, 1500, { turn: 1, step: 1 }),
      message(2, 2000, 1, 1, { inputTokens: 20, outputTokens: 2 }),
    ])

    expect(samples.map(sample => sample.tokens.uncachedInputTokens)).toEqual([100, 20])
  })

  it('keeps slots independent across turns and steps', () => {
    const samples = samplesOf([
      message(0, 1000, 1, 1, USAGE),
      message(1, 2000, 1, 2, USAGE),
      message(2, 3000, 2, 1, USAGE),
    ])

    expect(samples).toHaveLength(3)
  })

  it('prefers the message route over the latest request header', () => {
    const samples = samplesOf([
      event('request/header', 0, 500, { header: { config: { provider: 'h', model: 'x' } } }),
      message(1, 1000, 1, 1, USAGE),
    ])

    expect(samples[0]?.route).toBe('p/m')
  })

  it('falls back to the request header when a message names no route', () => {
    const samples = samplesOf([
      event('request/header', 0, 500, { header: { config: { provider: 'h', model: 'x' } } }),
      message(1, 1000, 1, 1, USAGE, null),
    ])

    expect(samples[0]?.route).toBe('h/x')
  })

  it('reports an unknown route when nothing names one', () => {
    expect(samplesOf([message(0, 1000, 1, 1, USAGE, null)])[0]?.route).toBe('unknown')
  })

  it('ignores events that carry no usage sample', () => {
    const samples = samplesOf([
      event('turn/start', 0, 500, { turn: 1 }),
      event('step/start', 1, 600, { turn: 1, step: 1 }),
      event('assistant/message', 2, 700, { turn: 1, step: 1, message: {}, stream: [] }),
      event('tool/result', 3, 800, { callId: 'c' }),
      event('turn/end', 4, 900, { turn: 1 }),
    ])

    expect(samples).toEqual([])
  })

  it('returns nothing for an empty log', () => {
    expect(samplesOf([])).toEqual([])
  })
})
