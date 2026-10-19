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

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import type { TokenUsage } from '@deepseek-ai/dsh-llm/types'
import { apply, DEFAULT_CONFIG, PRICING_PATH, PROGRESS_PATH, REPORT_PATH } from '../src/index.ts'
import type { UsageInsightsConfig } from '../src/index.ts'

// Every test mounts the plugin, which hydrates the rate table from `DSH_HOME`.
// Pointing that at a fresh directory keeps the suite off the developer's real
// machine and gives each case an empty table to start from.
beforeEach(async () => {
  process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'dlu-assemble-'))
})

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
function record(id: string, seeded = false, cwd?: string, live = false): unknown {
  return {
    header: {
      version: 3,
      id,
      createdAt: DAY_ONE,
      isSeeded: seeded,
      ...cwd === undefined ? {} : { cwd },
    },
    live,
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

/** What one mount's host has to offer beyond the engine. */
interface MountOptions {
  /** Stored-log change tokens, as a mounted persistence backend would list them. */
  readonly revisions?: Readonly<Record<string, string>>
  /** Session ids whose events are live in this process. */
  readonly live?: readonly string[]
  /** How many of the first corpus listings reject, so a transient failure can be told from a permanent one. */
  readonly failListings?: number
  /**
   * Holds every batch projection open until it resolves, so a test can let a
   * background fold and a request race for the same corpus on purpose.
   */
  readonly gate?: Promise<void>
  /** Configuration overrides; the warm-up is off unless a test asks for it. */
  readonly config?: Partial<UsageInsightsConfig>
}

interface Mounted {
  readonly route: { readonly fetch: (request: Request) => Promise<Response> }
  /** The rate-table route the same activation registered. */
  readonly pricing: { readonly fetch: (request: Request) => Promise<Response> }
  /** The progress route the same activation registered. */
  readonly progress: { readonly fetch: (request: Request) => Promise<Response> }
  /** Session ids the exact read was asked for, in call order. */
  readonly exactReads: string[]
  /** Session ids each batch projection was asked for. */
  readonly batches: (readonly string[])[]
  /** Fire the host event that invalidates one session's cached fold. */
  readonly emit: (id: string) => void
  /** `undefined` mounts an engine with no batch projection at all. */
  readonly offersBatch: boolean
}

/** Mount the plugin over a fake engine and capture the routes it registers. */
function mount(logs: ReadonlyMap<string, FakeLog>, offersBatch: boolean, options: MountOptions = {}): Mounted {
  const exactReads: string[] = []
  const batches: (readonly string[])[] = []
  const invalidated: ((session: { id: string }) => void)[] = []
  const routes = new Map<string, { fetch: (request: Request) => Promise<Response> }>()
  const live = new Set(options.live ?? [])
  let listingsLeft = options.failListings ?? 0

  const engine: Record<string, unknown> = {
    listSessions: () => {
      if (listingsLeft > 0) {
        listingsLeft -= 1
        return Promise.reject(new Error('listing failed'))
      }
      return Promise.resolve([...logs.keys()].map(id => record(
        id,
        logs.get(id)?.seeded === true,
        logs.get(id)?.cwd,
        live.has(id),
      )))
    },
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
    engine.projectMany = async (ids: readonly string[], project: (source: unknown) => unknown) => {
      batches.push([...ids])
      if (options.gate !== undefined) await options.gate
      return ids.map((id) => {
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
      })
    }
  }

  const persistence = options.revisions === undefined ? undefined : {
    list: () => Promise.resolve(Object.entries(options.revisions ?? {}).map(([id, revision]) => ({
      header: { id },
      revision,
    }))),
  }

  const ctx = {
    connection: { fetch: { register: (candidate: { path: string; fetch: (request: Request) => Promise<Response> }) => { routes.set(candidate.path, candidate); return () => Promise.resolve() } } },
    sessionQuery: engine,
    logger: { warn: () => {} },
    // `ctx.get` is how an optional service is read without depending on it.
    get: (name: string) => (name === 'sessionPersistence' ? persistence : undefined),
    on: (name: string, handler: (session: { id: string }) => void) => { if (name === 'session/event') invalidated.push(handler) },
    effect: (callback: () => unknown) => { callback() },
  } as unknown as Context

  apply(ctx, {
    ...DEFAULT_CONFIG,
    // Off unless a test asks for it: the mount is per-test, and a fold scheduled
    // by one test would run against a torn-down host in the next.
    warmup: false,
    ...options.config,
  })

  const route = routes.get(REPORT_PATH)
  const pricing = routes.get(PRICING_PATH)
  const progressRoute = routes.get(PROGRESS_PATH)
  if (route === undefined) throw new Error('apply did not register the report route')
  if (pricing === undefined) throw new Error('apply did not register the pricing route')
  if (progressRoute === undefined) throw new Error('apply did not register the progress route')
  return {
    route,
    pricing,
    progress: progressRoute,
    exactReads,
    batches,
    offersBatch,
    emit: (id: string) => { for (const handler of invalidated) handler({ id }) },
  }
}

/** Ask the registered route for one window. */
async function report(
  mounted: Mounted,
  params: {
    readonly from?: number
    readonly to?: number
    readonly refresh?: boolean
  } = {},
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

describe('assembleReport: the durable fold cache', () => {
  // Instants relative to the real clock, because the cache prunes what no window
  // can reach any more and a pinned 2026 date would age out of that horizon.
  const RECENT = Date.now() - 2 * MS_PER_DAY

  it('reuses a stored fold after a restart without opening the log', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, RECENT, 2) }]])
    const revisions = { a: 'rev-1' }

    const first = mount(logs, true, { revisions })
    const cold = await report(first)
    expect(cold.cached).toBe(false)
    expect(first.batches).toEqual([['a']])

    // A second process over the same harness home: nothing in memory, one
    // revision that still matches, so no log is opened at all.
    const second = mount(logs, true, { revisions })
    const warm = await report(second)

    expect(second.batches).toEqual([])
    expect(second.exactReads).toEqual([])
    expect(warm.cached).toBe(true)
    expect(warm.totals).toMatchObject({ calls: 2, uncachedInputTokens: 200 })
    expect(warm.scannedSessions).toBe(1)
  })

  it('re-reads the one session whose stored log changed', async () => {
    const logs = new Map<string, FakeLog>([
      ['a', { events: log(0, RECENT, 2) }],
      ['b', { events: log(0, RECENT, 3) }],
    ])

    await report(mount(logs, true, { revisions: { a: 'rev-1', b: 'rev-1' } }))

    const second = mount(logs, true, { revisions: { a: 'rev-1', b: 'rev-2' } })
    const value = await report(second)

    expect(second.batches).toEqual([['b']])
    expect(value.totals).toMatchObject({ calls: 5 })
  })

  it('falls back to a full read when the log is no longer listed', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, RECENT, 2) }]])

    await report(mount(logs, true, { revisions: { a: 'rev-1' } }))

    const second = mount(logs, true, { revisions: {} })
    const value = await report(second)

    expect(second.batches).toEqual([['a']])
    expect(value.totals).toMatchObject({ calls: 2 })
  })

  it('stores nothing for a live session, whose events are only in memory', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, RECENT, 2) }]])

    const live = mount(logs, true, { revisions: { a: 'rev-1' }, live: ['a'] })
    await report(live)
    expect(live.batches).toEqual([['a']])

    // The same revision, now not live: the fold was never written, because it
    // came from events the stored log may not carry yet.
    const restarted = mount(logs, true, { revisions: { a: 'rev-1' } })
    await report(restarted)

    expect(restarted.batches).toEqual([['a']])
  })

  it('bypasses the durable cache when a refresh is asked for', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, RECENT, 2) }]])
    const revisions = { a: 'rev-1' }

    await report(mount(logs, true, { revisions }))

    const mounted = mount(logs, true, { revisions })
    const refreshed = await report(mounted, { refresh: true })

    expect(mounted.batches).toEqual([['a']])
    expect(refreshed.cached).toBe(false)
  })

  it('replaces the stored fold a refresh read past', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, RECENT, 2) }]])
    const revisions = { a: 'rev-1' }

    await report(mount(logs, true, { revisions }))

    // The refresh re-reads the log, and the entry it read past is replaced rather
    // than left behind, so the next start is warm again.
    const refreshing = mount(logs, true, { revisions })
    await report(refreshing, { refresh: true })
    expect(refreshing.batches).toEqual([['a']])

    const restarted = mount(logs, true, { revisions })
    const warm = await report(restarted)
    expect(restarted.batches).toEqual([])
    expect(warm.cached).toBe(true)
  })

  it('reads logs as before when no persistence backend is mounted', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, RECENT, 2) }]])

    await report(mount(logs, true))
    const second = mount(logs, true)
    await report(second)

    expect(second.batches).toEqual([['a']])
  })
})

describe('the background fold', () => {
  /** Let a scheduled fold start and its microtasks settle. */
  const settle = async (): Promise<void> => { await new Promise(resolve => { setTimeout(resolve, 0) }) }

  it('folds the corpus at activation, so the first request reads no log', async () => {
    const logs = new Map<string, FakeLog>([
      ['a', { events: log(0, DAY_ONE, 2) }],
      ['b', { events: log(0, DAY_ONE, 3) }],
    ])
    const mounted = mount(logs, true, { config: { warmup: true, warmupDelayMs: 0 } })
    await settle()

    // The fold happened before anyone asked for a report.
    expect(mounted.batches).toEqual([['a', 'b']])

    const value = await report(mounted)
    expect(value.totals).toMatchObject({ calls: 5 })
    // And the request itself opened nothing.
    expect(mounted.batches).toEqual([['a', 'b']])
    expect(value.cached).toBe(true)
  })

  it('lets a request arriving mid-fold wait for it rather than read again', async () => {
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 2) }]])
    const mounted = mount(logs, true, { config: { warmup: true, warmupDelayMs: 0 }, gate })
    await settle()

    // The background fold is parked inside the projection.
    expect(mounted.batches).toEqual([['a']])

    const asked = report(mounted)
    await settle()
    // The request did not start a second read of the same corpus.
    expect(mounted.batches).toEqual([['a']])

    release()
    const value = await asked
    expect(mounted.batches).toEqual([['a']])
    expect(value.totals).toMatchObject({ calls: 2 })
  })

  it('reads nothing until asked when the warm-up is off', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 2) }]])
    const mounted = mount(logs, true)
    await settle()

    expect(mounted.batches).toEqual([])
    await report(mounted)
    expect(mounted.batches).toEqual([['a']])
  })

  it('costs the reader nothing when the background fold fails', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 2) }]])
    const mounted = mount(logs, true, { config: { warmup: true, warmupDelayMs: 0 }, failListings: 1 })
    await settle()

    // The failed fold left no cache behind, so the request reads the corpus
    // itself rather than inheriting the failure.
    const value = await report(mounted)
    expect(value.totals).toMatchObject({ calls: 2 })
  })
})

describe('the progress route', () => {
  it('reports nothing in flight before any read', async () => {
    const mounted = mount(new Map(), true)
    const response = await mounted.progress.fetch(new Request(new URL(PROGRESS_PATH, 'http://localhost')))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ phase: 'idle', done: 0, total: 0 })
  })

  it('reports how many logs the read had to fold', async () => {
    const logs = new Map<string, FakeLog>([
      ['a', { events: log(0, DAY_ONE, 2) }],
      ['b', { events: log(0, DAY_ONE, 3) }],
      ['c', { events: log(0, DAY_ONE, 1) }],
    ])
    const mounted = mount(logs, true)

    await report(mounted)

    const value = await (await mounted.progress.fetch(
      new Request(new URL(PROGRESS_PATH, 'http://localhost')),
    )).json() as Record<string, unknown>
    expect(value).toMatchObject({ phase: 'idle', done: 3, total: 3 })
    expect(typeof value.finishedAt).toBe('number')

    // A second request is answered from the fold cache, so it waits on no log.
    await report(mounted)
    expect(await (await mounted.progress.fetch(
      new Request(new URL(PROGRESS_PATH, 'http://localhost')),
    )).json()).toMatchObject({ phase: 'idle', done: 0, total: 0 })
  })

  it('settles when the read fails, so a poller is never left waiting', async () => {
    const mounted = mount(new Map(), true, { failListings: 1 })

    const failed = await mounted.route.fetch(new Request(new URL(REPORT_PATH, 'http://localhost')))
    expect(failed.status).toBe(500)

    const value = await (await mounted.progress.fetch(
      new Request(new URL(PROGRESS_PATH, 'http://localhost')),
    )).json() as Record<string, unknown>
    expect(value.phase).toBe('idle')
    expect(typeof value.finishedAt).toBe('number')
  })
})

describe('the pricing route', () => {
  /** Post one body to the rate-table route. */
  async function post(mounted: Mounted, body: unknown): Promise<Response> {
    return await mounted.pricing.fetch(new Request(new URL(PRICING_PATH, 'http://localhost'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }))
  }

  const RATE = { input: 3, cacheRead: 0.3, cacheWrite: 3, output: 9 }

  /** A flat-priced model card, as the editor writes one. */

  const CARD = { peakEnabled: false, peak: RATE, offPeak: RATE }

  it('stores an override and bills a later report at it', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 1, 1) }]])
    const mounted = mount(logs, true)

    // The route is priced by the fallback card before the write.
    const before = await report(mounted)
    const beforeCost = (before.totals as { cost: number }).cost

    const response = await post(mounted, { models: { 'p/m': CARD } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ models: { 'p/m': CARD } })

    const after = await report(mounted)
    expect((after.totals as { cost: number }).cost).toBeGreaterThan(beforeCost)
    expect((after.routeRates as { route: string; source: string }[])[0])
      .toMatchObject({ route: 'p/m', source: 'model' })
  })

  it('clears an override with a null rate', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 1, 1) }]])
    const mounted = mount(logs, true)

    await post(mounted, { models: { 'p/m': CARD } })
    const cleared = await post(mounted, { models: { 'p/m': null } })

    expect(await cleared.json()).toEqual({ models: {} })
  })

  it('refuses a body it cannot vouch for', async () => {
    const logs = new Map<string, FakeLog>([['a', { events: log(0, DAY_ONE, 1, 1) }]])
    const mounted = mount(logs, true)

    expect((await post(mounted, { models: { 'p/m': { offPeak: RATE } } })).status).toBe(400)
    expect((await post(mounted, {
      models: { 'p/m': { peakEnabled: true, peak: { ...RATE, output: -1 }, offPeak: RATE } },
    })).status).toBe(400)
    expect((await post(mounted, { set: {} })).status).toBe(400)
    expect((await post(mounted, { set: { '': RATE } })).status).toBe(400)
    // And nothing was written by any of them.
    const after = await report(mounted)
    expect((after.routeRates as { source: string }[])[0]?.source).toBe('fallback')
  })
})
