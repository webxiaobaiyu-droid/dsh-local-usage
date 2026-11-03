/**
 * The corpus reader: every readable session log, folded once into the caches the
 * report and the call log share.
 *
 * Reading a log is the expensive half of this plugin; folding it is not. This
 * module owns the two read paths and the durable-cache lookup around them, while
 * the entry owns activation and the HTTP surface. The progress object is passed
 * in rather than owned here, because one read at a time is an invariant of the
 * service that queues these calls.
 *
 * @module dsh-local-usage/host/corpus-reader
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
// Type-only: activates the optional `ctx.sessionPersistence` declaration.
import type {} from '@deepseek-ai/dsh-session-persistence'
import type { FoldCache } from '../fold-cache.ts'
import type { ProgressTracker } from '../progress.ts'
import { foldSession } from './session-fold.ts'
import type { CachedSession, Contributor } from './session-fold.ts'

/**
 * Session logs folded concurrently by the exact-read path.
 *
 * Only the sessions that cannot take the batch projection come through here, so
 * this bounds an exceptional path rather than the common one. Raising it would
 * not help anyway: decoding and parsing a log are synchronous, and the fold that
 * consumes them is already the smaller half of the cost.
 */
const READ_CONCURRENCY = 4

/** One session's batch projection outcome, as the engine reports it. */
type BatchOutcome<Value> =
  | { readonly sessionId: SessionId; readonly status: 'fulfilled'; readonly value: Value }
  | { readonly sessionId: SessionId; readonly status: 'rejected'; readonly reason: unknown }

/** The engine's batch projection, named off its own declaration so the two agree. */
type BatchProjection = <Value>(
  sessionIds: readonly SessionId[],
  project: (source: {
    readonly header: { readonly createdAt: number; readonly cwd?: string }
    readonly events: readonly SessionEvent[]
  }) => Value,
  signal?: AbortSignal,
) => Promise<readonly BatchOutcome<Value>[]>

/**
 * Read the engine's batch projection, when the mounted build has one.
 *
 * Read reflectively rather than called straight through: a harness whose engine
 * predates the projection would otherwise throw here and take the whole route
 * with it. Declared structurally, like {@link UsageInsightsConnection}, so this
 * package carries no dependency on the module that provides the service.
 *
 * The win is not concurrency, which the fold does not use: it is that this path
 * hands the fold the log as the reader already holds it, while the exact read
 * deep-clones every event — including the message bodies and tool results the
 * fold never looks at — and replay-validates the log by building a Session from
 * it. On a real corpus that clone is about a third of the whole cold read.
 *
 * @param engine - the mounted session query engine.
 * @returns the bound projection, or `undefined` when this build has none.
 */
function batchProjectionOf(engine: SessionQueryEngine): BatchProjection | undefined {
  const candidate: unknown = Reflect.get(engine, 'projectMany')
  return typeof candidate === 'function'
    ? (candidate as BatchProjection).bind(engine)
    : undefined
}

/** Run one async mapper over items with a fixed number of workers. */
async function mapBounded<T, R>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      // oxlint-disable-next-line typescript/no-non-null-assertion -- index is inside the array
      results[index] = await map(items[index]!)
    }
  })
  await Promise.all(workers)
  return results
}

/** A session log this read has to fold. */
interface PendingSession {
  readonly id: SessionId
  /** Whether the log carries a fork-inherited prefix, which the batch read cannot skip. */
  readonly seeded: boolean
  /** The session's invalidation generation when this read captured it. */
  readonly generation: number
  /**
   * Revision of the stored log this read folds, when one is known.
   *
   * Present only for a fold the durable cache may keep: a live session is folded
   * from the events in memory, so storing that fold under the revision of a log
   * that may lag behind it would be a claim the next process would believe.
   */
  readonly revision?: string
}

/** A session the in-memory cache cannot answer for. */
interface NeedySession {
  readonly id: SessionId
  readonly seeded: boolean
  /** Whether the events currently live in this process are the truth for this session. */
  readonly live: boolean
}

/** One stored session's change token, as the persistence service reports it. */
interface StoredRevision {
  readonly header: { readonly id: SessionId }
  readonly revision: string
}

/**
 * The one persistence read this plugin makes, declared structurally.
 *
 * The harness's own `SessionPersistence` service declares `ctx.sessionPersistence`
 * with a much wider surface — open, create, resume — and none of it matters here.
 * Naming only the listing keeps this package free of a runtime dependency on the
 * backend that provides it, exactly as the route registrar is.
 */
interface UsageInsightsPersistence {
  list(options?: { readonly signal?: AbortSignal }): Promise<readonly StoredRevision[]>
}

/**
 * The change token of every stored log, or an empty map when none can be had.
 *
 * A backend that is absent, or a listing that fails, costs this plugin the
 * durable cache and nothing else: every session then takes the read path it took
 * before that cache existed, and the report is still complete.
 *
 * @param ctx - host context, read for the optional persistence service.
 * @returns session id to stored-log revision.
 */
async function storedRevisions(ctx: Context): Promise<ReadonlyMap<string, string>> {
  try {
    // `ctx.get` reads a service without declaring a dependency on it, which is
    // what keeps the durable cache optional: a deployment that mounts no
    // persistence backend still mounts this panel.
    const persistence = ctx.get('sessionPersistence') as UsageInsightsPersistence | undefined
    if (persistence === undefined || typeof persistence.list !== 'function') return new Map()
    const snapshots = await persistence.list()
    const revisions = new Map<string, string>()
    for (const snapshot of snapshots) revisions.set(String(snapshot.header.id), snapshot.revision)
    return revisions
  } catch (error: unknown) {
    ctx.logger.warn(`dsh-local-usage: stored-log listing failed: ${describe(error)}`)
    return new Map()
  }
}

/** What one corpus read found: the folds, and what it cost to obtain them. */
export interface CorpusRead {
  /** Every session in the requested window, with the fold it contributed from. */
  readonly contributors: readonly Contributor[]
  /** Sessions whose logs could not be read. */
  readonly unreadable: number
  /**
   * Sessions counted from the fold cache because the backend no longer lists
   * them — their logs are gone, but their spend is not.
   */
  readonly restoredIds: readonly string[]
  /** Whether every fold came from the caches rather than a fresh read. */
  readonly cached: boolean
}

/**
 * Read every readable session log into folds, reusing whatever the caches answer.
 *
 * Two read paths, one fold. Sessions whose log carries no inherited prefix go
 * through the engine's batch projection, which hands the fold the events as the
 * reader already holds them. Everything else — a seeded log, whose prefix length
 * only the exact read reports, and every session when the mounted engine has no
 * batch projection at all — takes the per-session read.
 *
 * A session neither path has to touch is the point of the durable cache: when the
 * stored log still carries the revision a previous process folded, that fold is
 * reused and the log is never opened.
 *
 * Shared by the report and the call log. They ask different questions of the
 * same folds, so reading once here is what keeps a page of calls from paying for
 * a second pass over the corpus.
 *
 * @param ctx - host context carrying the session query engine.
 * @param cache - the in-memory fold cache, keyed by session id.
 * @param folds - the durable fold cache, keyed by session id and log revision.
 * @param progress - publishes how far this read has got.
 * @param request - the window the durable cache must still reach, and whether to discard it.
 * @returns the contributors, the unreadable count and whether the read was cached.
 */
export async function readCorpus(
  ctx: Context,
  cache: Map<string, CachedSession>,
  folds: FoldCache,
  progress: ProgressTracker,
  request: { refresh: boolean; from: number | undefined; to: number | undefined },
  generations: ReadonlyMap<string, number>,
): Promise<CorpusRead> {
  // A refresh means what it says: every log is read again, so the durable
  // entries are bypassed rather than merely overwritten.
  if (request.refresh) cache.clear()

  const records = await ctx.sessionQuery.listSessions()
  // Every session that contributed, with the fold it contributed from. Kept as
  // pairs rather than as finished inputs because a window is a filter over
  // these folds: deriving a second one — the window before this — costs a
  // re-price, not a second read.
  const contributors: Contributor[] = []
  const needy: NeedySession[] = []
  for (const record of records) {
    const id = String(record.header.id)
    const hit = cache.get(id)
    if (hit !== undefined) {
      contributors.push({ id, fold: hit })
      continue
    }
    needy.push({ id: id as SessionId, seeded: record.header.isSeeded, live: record.live })
  }

  // A log that is gone is not a log that never spent. The durable cache keeps
  // every fold it ever wrote; a session the backend no longer lists — deleted by
  // a plugin, removed by hand, or archived out of the listing — still
  // contributes the samples it was billed for. This costs no read: the samples
  // are already in the document. Only the retention horizon removes them.
  const listed = new Set(records.map(record => String(record.header.id)))
  const restoredIds: string[] = []
  for (const [id, fold] of folds.all()) {
    if (listed.has(id)) continue
    // The same window test `sessionInputOf` applies below: a deleted session from
    // last month is not a contributor to a report about today, and counting it as
    // one would inflate the read's session count.
    const inWindow = request.from === undefined && request.to === undefined
      || fold.samples.some(sample =>
        (request.from === undefined || sample.time >= request.from)
        && (request.to === undefined || sample.time <= request.to))
    if (!inWindow) continue
    // Deliberately not put in the in-memory cache: a log that reappears with new
    // events must go through the revision check, and this fold has no live event
    // stream to invalidate it.
    contributors.push({ id, fold })
    restoredIds.push(id)
  }

  // Revisions turn the durable cache into a lookup: the same token means the
  // bytes on disk are the ones that entry was folded from. They are read even
  // for a refresh, which bypasses the lookup but still has to replace the entry
  // it is re-reading past.
  const asking = needy.some(entry => !entry.live)
  const revisions = asking ? await storedRevisions(ctx) : new Map<string, string>()
  const pending: PendingSession[] = []
  for (const entry of needy) {
    const revision = entry.live ? undefined : revisions.get(entry.id)
    if (revision === undefined) {
      pending.push({ id: entry.id, seeded: entry.seeded, generation: generations.get(entry.id) ?? 0 })
      continue
    }
    const stored = request.refresh ? undefined : folds.read(entry.id, revision, request.from)
    if (stored === undefined) {
      pending.push({
        id: entry.id,
        seeded: entry.seeded,
        revision,
        generation: generations.get(entry.id) ?? 0,
      })
      continue
    }
    cache.set(entry.id, stored)
    contributors.push({ id: entry.id, fold: stored })
  }

  // Every log that still has to be read is one step of this read's progress,
  // so the count the panel shows is the work it is actually waiting on.
  progress.plan(pending.length)

  const cached = pending.length === 0
  const batch = batchProjectionOf(ctx.sessionQuery)
  const batchable = batch === undefined ? [] : pending.filter(entry => !entry.seeded)
  const exact = batch === undefined ? pending : pending.filter(entry => entry.seeded)

  let unreadable = 0

  if (batch !== undefined && batchable.length > 0) {
    // The projection is synchronous and must own everything it keeps. The fold
    // satisfies that by reading primitives off the events and building fresh
    // sample objects, so nothing here aliases the borrowed log.
    const results = await batch(batchable.map(entry => entry.id), source => {
      const fold = foldSession({
        events: source.events,
        createdAt: source.header.createdAt,
        ...source.header.cwd === undefined ? {} : { cwd: source.header.cwd },
        // Reached only for a log with no inherited prefix, by construction above.
        skipBefore: 0,
      })
      // Counted inside the projector because that is where a session's fold
      // actually completes; the projection reports back only when all of them have.
      progress.advance()
      return fold
    })
    const byId = new Map<string, BatchOutcome<CachedSession>>()
    for (const outcome of results) byId.set(String(outcome.sessionId), outcome)
    for (const entry of batchable) {
      const outcome = byId.get(entry.id)
      if (outcome === undefined || outcome.status === 'rejected') {
        unreadable += 1
        continue
      }
      // The event that invalidated this session while it was being folded has
      // already deleted the cache entry; writing the fold back would resurrect
      // the value that event exists to retire. The fold still answers this
      // request as a snapshot, but it does not become the next request's truth.
      if ((generations.get(entry.id) ?? 0) === entry.generation) {
        cache.set(entry.id, outcome.value)
        if (entry.revision !== undefined) folds.write(entry.id, entry.revision, outcome.value)
      }
      contributors.push({ id: entry.id, fold: outcome.value })
    }
  }

  if (exact.length > 0) {
    const folded = await mapBounded(exact, READ_CONCURRENCY, async (entry) => {
      try {
        const snapshot = await ctx.sessionQuery.readSession(entry.id)
        return foldSession({
          events: snapshot.events,
          createdAt: snapshot.session.createdAt,
          ...snapshot.session.cwd === undefined ? {} : { cwd: snapshot.session.cwd },
          // A forked session's log begins with the parent's inherited prefix, and
          // those turns were already billed under the parent. Only the events this
          // session owns are its own spend.
          skipBefore: snapshot.inheritedEventCount,
        })
      } catch {
        return undefined
      } finally {
        progress.advance()
      }
    })
    for (let index = 0; index < folded.length; index += 1) {
      const value = folded[index]
      const entry = exact[index]
      if (value === undefined || entry === undefined) {
        unreadable += 1
        continue
      }
      if ((generations.get(entry.id) ?? 0) === entry.generation) {
        cache.set(entry.id, value)
        if (entry.revision !== undefined) folds.write(entry.id, entry.revision, value)
      }
      contributors.push({ id: entry.id, fold: value })
    }
  }

  // Awaited, so the read this request just paid for survives a process that
  // dies before the next one starts. It is one write of a file the size of the
  // samples, only ever on a read that touched a log, and the panel is already
  // waiting on that read; a disk that refuses it costs the next cold start and
  // never this answer.
  try {
    await folds.flush()
  } catch (error: unknown) {
    ctx.logger.warn(`dsh-local-usage: fold cache write failed: ${describe(error)}`)
  }

  return { contributors, unreadable, restoredIds, cached }
}


/** One line describing an error, for a log line. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
