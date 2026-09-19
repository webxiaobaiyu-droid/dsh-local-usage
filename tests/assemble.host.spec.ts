/**
 * The report assembly: which read path each session takes, and what is cached.
 *
 * Driven through the plugin's own `apply` and the route it registers, rather than
 * through an exported helper, so the test also covers the wiring: `name`/`inject`
 * being irrelevant here, `ctx.on('session/event')` being subscribed, and the
 * query parameters reaching the fold.
 *
 * The two read paths exist because the exact read deep-clones every event while
 * the batch projection does not, and because a forked log's inherited prefix
 * length is only reported by the exact read. These tests pin both.
 *
 * @module dsh-local-usage/tests/assemble
 */

import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { TokenUsage } from '@deepseek-ai/dsh-llm/types'
import { apply, DEFAULT_CONFIG, REPORT_PATH } from '../src/index.ts'

const MS_PER_DAY = 86_400_000
/** A fixed instant, so a window can be expressed as whole days around it. */
const DAY_ONE = new Date(2026, 4, 10).getTime()
const DAY_TWO = DAY_ONE + MS_PER_DAY

const USAGE: TokenUsage = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 }

/** One billable settlement, structurally faithful to a durable log event. */
function message(seq: number, time: number, turn: number, usage: TokenUsage = USAGE): SessionEvent {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: {
      turn,
      step: 1,
      message: { source: { provider: 'p', model: 'm' } },
      stream: [],
      usage,
    },
  } as unknown as SessionEvent
}

/** A log of `count` billable settlements on one day, each in its own turn slot. */
function log(seqStart: number, time: number, count: number, firstTurn = 1): SessionEvent[] {
  return Array.from(
    { length: count },
    (_, index) => message(seqStart + index, time + index, firstTurn + index),
  )
}

/** A `listSessions` record for one session id. */
function record(id: string, seeded = false, cwd?: string): unknown {
  return {
    header: {
      version: 3,
      id,
      createdAt: DAY_ONE,
      isSeeded: seeded,
      ...cwd === undefined ? {} : { cwd },
    },
    live: false,
    persisted: true,
  }
}

/** What the fake engine must answer with, per session. */
interface FakeLog {
  readonly events: readonly SessionEvent[]
  readonly seeded?: boolean
  readonly cwd?: string
  readonly inheritedEventCount?: number
  /** When true, both read paths reject for this session. */
  readonly broken?: boolean
}

interface Mounted {
  readonly route: { readonly fetch: (request: Request) => Promise<Response> }
  /** Session ids the exact read was asked for, in call order. */
  readonly exactReads: string[]
  /** Session ids each batch projection was asked for. */
  readonly batches: (readonly string[])[]
  /** Fire the host event that invalidates one session's cached fold. */
  readonly emit: (id: string) => void
  /** `undefined` mounts an engine with no batch projection at all. */
  readonly offersBatch: boolean
}

/** Mount the plugin over a fake engine and capture the route it registers. */
function mount(logs: ReadonlyMap<string, FakeLog>, offersBatch: boolean): Mounted {
  const exactReads: string[] = []
  const batches: (readonly string[])[] = []
  const invalidated: ((session: { id: string }) => void)[] = []
  let route: { fetch: (request: Request) => Promise<Response> } | undefined

  const engine: Record<string, unknown> = {
    listSessions: () => Promise.resolve([...logs.keys()].map(id => record(id, logs.get(id)?.seeded === true, logs.get(id)?.cwd))),
    readSession: (id: string) => {
      exactReads.push(id)
      const entry = logs.get(id)
      if (entry === undefined || entry.broken === true) return Promise.reject(new Error('unreadable'))
      return Promise.resolve({
        session: { id, createdAt: DAY_ONE, ...entry.cwd === undefined ? {} : { cwd: entry.cwd } },
        inheritedEventCount: entry.inheritedEventCount ?? 0,
        events: entry.events,
      })
    },
  }
  if (offersBatch) {
    engine.projectMany = (ids: readonly string[], project: (source: unknown) => unknown) => {
      batches.push([...ids])
      return Promise.resolve(ids.map((id) => {
        const entry = logs.get(id)
        if (entry === undefined || entry.broken === true) {
          return { sessionId: id, status: 'rejected' as const, reason: new Error('unreadable') }
        }
        const value = project({
          header: { createdAt: DAY_ONE, ...entry.cwd === undefined ? {} : { cwd: entry.cwd } },
          // The projection receives the log as the reader holds it, which is the
          // whole point of this path: no clone, no replay validation.
          events: entry.events,
        })
        return { sessionId: id, status: 'fulfilled' as const, value }
      }))
    }
  }

  const ctx = {
    connection: { fetch: { register: (candidate: typeof route) => { route = candidate; return () => Promise.resolve() } } },
    sessionQuery: engine,
    logger: { warn: () => {} },
    on: (name: string, handler: (session: { id: string }) => void) => { if (name === 'session/event') invalidated.push(handler) },
    effect: (callback: () => unknown) => { callback() },
  } as unknown as Context

  apply(ctx, DEFAULT_CONFIG)

  if (route === undefined) throw new Error('apply did not register the report route')
  return {
    route,
    exactReads,
    batches,
    offersBatch,
    emit: (id: string) => { for (const handler of invalidated) handler({ id }) },
  }
}

/** Ask the registered route for one window. */
async function report(
  mounted: Mounted,
  params: { readonly from?: number; readonly to?: number; readonly refresh?: boolean } = {},
): Promise<Record<string, unknown>> {
  const url = new URL(REPORT_PATH, 'http://localhost')
  if (params.from !== undefined) url.searchParams.set('from', String(params.from))
  if (params.to !== undefined) url.searchParams.set('to', String(params.to))
  if (params.refresh === true) url.searchParams.set('refresh', '1')
  const response = await mounted.route.fetch(new Request(url))
  expect(response.status).toBe(200)
  return await response.json() as Record<string, unknown>
}

describe('assembleReport: which read path a session takes', () => {
  it('folds every unseeded session through the batch projection, never the exact read', async () => {
    const logs = new Map<string, FakeLog>([
      ['a', { events: log(0, DAY_ONE, 2) }],
      ['b', { events: log(0, DAY_TWO, 3) }],
    ])
    const mounted = mount(logs, true)

    const value = await report(mounted)

    // One batch call carrying both ids, and not a single per-session read.
    expect(mounted.batches).toEqual([['a', 'b']])
    expect(mounted.exactReads).toEqual([])
    expect(value.totals).toMatchObject({ calls: 5, uncachedInputTokens: 500 })
    expect(value.scannedSessions).toBe(2)
    expect(value.unreadableSessions).toBe(0)
  })

  it('falls back to the exact read for a seeded log, whose prefix only that read reports', async () => {
    // 'parent' owns all three; 'fork' replays the first two as its inherited prefix,
    // so only its third settlement is its own spend.
    const logs = new Map<string, FakeLog>([
      ['fork', { events: log(0, DAY_ONE, 3), seeded: true, inheritedEventCount: 2 }],
      ['plain', { events: log(0, DAY_ONE, 4) }],
    ])
    const mounted = mount(logs, true)

    const value = await report(mounted)

    expect(mounted.batches).toEqual([['plain']])
    expect(mounted.exactReads).toEqual(['fork'])
    // 4 from the plain log plus the fork's single owned settlement, not 7.
    expect(value.totals).toMatchObject({ calls: 5 })
  })

  it('reads every session exactly when the engine offers no batch projection', async () => {
    const logs = new Map<string, FakeLog>([
      ['a', { events: log(0, DAY_ONE, 2) }],
      ['b', { events: log(0, DAY_ONE, 3) }],
    ])
    const mounted = mount(logs, false)

    const value = await report(mounted)

    expect(mounted.batches).toEqual([])
    expect(mounted.exactReads.sort()).toEqual(['a', 'b'])
    expect(value.totals).toMatchObject({ calls: 5 })
  })

  it('counts a log it could not read, on either path', async () => {
    const logs = new Map<string, FakeLog>([
      ['good', { events: log(0, DAY_ONE, 2) }],
      ['badBatch', { events: log(0, DAY_ONE, 9), broken: true }],
      ['badExact', { events: log(0, DAY_ONE, 9), broken: true, seeded: true }],
    ])
    const mounted = mount(logs, true)

    const value = await report(mounted)

    expect(value.unreadableSessions).toBe(2)
    // The broken logs contribute nothing to any total.
    expect(value.totals).toMatchObject({ calls: 2 })
    // `scannedSessions` counts the logs that folded, not the logs that were listed:
    // one readable log here, with the two failures named separately.
    expect(value.scannedSessions).toBe(1)
  })

  it('narrows the fold to the requested window', async () => {
    const logs = new Map<string, FakeLog>([
      // Three later turns, numbered past the first two so nothing shares a slot.
      ['a', { events: [...log(0, DAY_ONE, 2, 1), ...log(2, DAY_TWO, 3, 3)] }],
    ])
    const mounted = mount(logs, true)

    const whole = await report(mounted)
    expect(whole.totals).toMatchObject({ calls: 5 })

    const oneDay = await report(mounted, { from: DAY_ONE, to: DAY_ONE + MS_PER_DAY - 1 })
    expect(oneDay.totals).toMatchObject({ calls: 2 })
  })
})

describe('assembleReport: the fold cache', () => {
  it('re-prices a second request without reading any log again', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 2) }]])
    const mounted = mount(logs, true)

    const first = await report(mounted)
    expect(first.cached).toBe(false)

    const second = await report(mounted, { from: DAY_ONE, to: DAY_ONE + MS_PER_DAY - 1 })
    expect(second.cached).toBe(true)
    // The samples are already in hand, so the narrower window re-prices them.
    expect(second.totals).toMatchObject({ calls: 2 })
    expect(mounted.batches).toEqual([['a']])
  })

  it('discards the cache when refresh is asked for', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 2) }]])
    const mounted = mount(logs, true)

    await report(mounted)
    const refreshed = await report(mounted, { refresh: true })

    expect(refreshed.cached).toBe(false)
    expect(mounted.batches).toEqual([['a'], ['a']])
  })

  it('drops one session when it records an event', async () => {
    const logs = new Map<string, FakeLog>([
      ['a', { events: log(0, DAY_ONE, 2) }],
      ['b', { events: log(0, DAY_ONE, 3) }],
    ])
    const mounted = mount(logs, true)

    await report(mounted)
    mounted.emit('a')
    // Only the invalidated session is read again.
    await report(mounted)

    expect(mounted.batches).toEqual([['a', 'b'], ['a']])
  })
})
