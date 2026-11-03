/**
 * Durable per-session fold cache.
 *
 * Reading a log is the expensive half of this plugin and folding it is not, so
 * the in-memory session cache exists to pay that cost once. It did not survive a
 * restart, which meant every fresh Host process re-decoded the whole corpus
 * before the panel could draw its first cell.
 *
 * What makes the fold cacheable at all is the persistence backend's own change
 * token: `SessionPersistenceSnapshot.revision` identifies one revision of one
 * stored log, and the JSONL backend builds it from the artifact's device, inode,
 * size and nanosecond timestamps. A stored fold whose revision still matches is
 * therefore a fold of exactly the bytes on disk — no re-read, no guessing.
 *
 * A revision that no longer matches is simply a miss: the fold is recomputed and
 * the entry replaced. But a session the backend does not list is *not* a miss —
 * its log may have been deleted while the spend it recorded still happened and
 * was billed. The cache therefore doubles as the per-session ledger the report
 * reads when a log is gone (`all()`); only the retention horizon removes an
 * entry. A stale or damaged fold can still only cost this plugin its own answer,
 * never the logs it was folded from.
 *
 * The file lives beside the pricing overrides under the harness home, is written
 * through a temporary sibling and a rename, and reads an older document version
 * rather than dropping it when the entry fields are still the ones this build
 * understands. A version that cannot be read is dropped with a warning, and a
 * future shape has to bring a migration with it, the way every other stored
 * shape in this product does.
 *
 * @module dsh-local-usage/fold-cache
 */

import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { dayKeyToTime } from './aggregate.ts'
import type { ReliabilityDay, UsageSample } from './aggregate.ts'

/**
 * Version of the on-disk document, bumped when its shape *or* the fold's meaning
 * changes: an entry is only reused when the code that wrote it folded the same
 * way this build does.
 *
 * 2 adds per-settlement turn, step and timing to the samples. An entry written
 * by version 1 has the right tokens but no latency, and a call log that silently
 * stated no latency for every old session would be a different answer from the
 * one this build gives — so the old document is dropped and the logs read again.
 */
const DOCUMENT_VERSION = 2

const MS_PER_DAY = 86_400_000

/**
 * Days of history the cache keeps.
 *
 * The panel reads a rolling window of 52 weeks ending today, so a session whose
 * last recorded activity is older than this can contribute to no window the
 * panel can ask for. The margin above 52 weeks is slack for timezone and
 * calendar-year ranges, not a promise about what is retained: a request reaching
 * further back than what this horizon dropped is answered from a fresh read, not
 * from the cache.
 */
export const RETENTION_DAYS = 400

/**
 * Where one harness home keeps this plugin's fold cache.
 * @param dshHome - absolute harness home.
 * @returns the absolute path of the file.
 */
export function foldCacheFilePath(dshHome: string): string {
  return join(dshHome, 'local-usage', 'fold-cache.json')
}

/** One session's fold, exactly as the in-memory cache holds it. */
export interface CachedFold {
  /** One sample per billable settlement, ascending by time. */
  readonly samples: readonly UsageSample[]
  /** Reliability counters by local day. */
  readonly reliability: readonly ReliabilityDay[]
  readonly title?: string
  readonly cwd?: string
  readonly createdAt: number
}

/** One stored session: its fold plus the log revision it was folded from. */
interface StoredFold extends CachedFold {
  readonly revision: string
}

/** The persisted fold cache, kept in memory and mirrored to disk. */
export interface FoldCache {
  /**
   * Every fold the cache still holds, including sessions the backend no longer
   * lists.
   *
   * A session's log can disappear — deleted by a plugin, removed by hand, or
   * dropped by a retention policy — while its spend already happened and was
   * billed. The fold is the only surviving record of it, so the report reads this
   * as a ledger as well as a cache: an entry whose log is gone still contributes
   * its samples, and only the retention horizon removes it.
   * @returns the session id and fold of every retained entry.
   */
  all(): IterableIterator<[string, CachedFold]>
  /**
   * The fold stored for one session, when it was folded from exactly this revision.
   * @param sessionId - durable session id.
   * @param revision - the revision the log carries now.
   * @param from - the request's inclusive lower bound, or `undefined` when unbounded.
   * @returns the stored fold, or `undefined` on any kind of miss.
   */
  read(sessionId: string, revision: string, from: number | undefined): CachedFold | undefined
  /**
   * Record one session's fold under the revision it was folded from.
   * @param sessionId - durable session id.
   * @param revision - the revision the fold corresponds to.
   * @param fold - the fold to store.
   */
  write(sessionId: string, revision: string, fold: CachedFold): void
  /**
   * Persist the cache, dropping entries no window can reach any more.
   * @param now - the instant retention is measured from.
   */
  flush(now?: number): Promise<void>
}

/** Serialize one reliability day: its two count maps become plain records. */
function storedDay(day: ReliabilityDay): Record<string, unknown> {
  return {
    day: day.day,
    retries: day.retries,
    retryCauses: Object.fromEntries(day.retryCauses),
    toolCalls: day.toolCalls,
    toolErrors: day.toolErrors,
    toolErrorCodes: Object.fromEntries(day.toolErrorCodes),
    compactions: day.compactions,
    compactionFailures: day.compactionFailures,
  }
}

/** Read one non-negative finite count out of an untrusted value. */
function readCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** Read one `code -> count` map, dropping entries that are not counts. */
function readCounts(value: unknown): Map<string, number> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const counts = new Map<string, number>()
  for (const [code, candidate] of Object.entries(value as Record<string, unknown>)) {
    const count = readCount(candidate)
    if (code.length > 0 && count !== undefined) counts.set(code, count)
  }
  return counts
}

/** Read one optional non-negative finite count, treating an absent field as absent. */
function optionalCount(value: unknown): number | undefined {
  return value === undefined ? undefined : readCount(value)
}

/** Read one sample out of an untrusted document. */
function readSample(value: unknown): UsageSample | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>
  const time = readCount(source.time)
  const route = source.route
  if (time === undefined || typeof route !== 'string') return undefined
  const raw = source.tokens
  if (typeof raw !== 'object' || raw === null) return undefined
  const bucket = raw as Record<string, unknown>
  const uncachedInputTokens = readCount(bucket.uncachedInputTokens)
  const outputTokens = readCount(bucket.outputTokens)
  const cacheReadTokens = readCount(bucket.cacheReadTokens)
  const cacheWriteTokens = readCount(bucket.cacheWriteTokens)
  if (uncachedInputTokens === undefined || outputTokens === undefined
    || cacheReadTokens === undefined || cacheWriteTokens === undefined) return undefined
  const turn = optionalCount(source.turn)
  const step = optionalCount(source.step)
  const firstTokenMs = optionalCount(source.firstTokenMs)
  const durationMs = optionalCount(source.durationMs)
  const outputTps = optionalCount(source.outputTps)
  return {
    time,
    route,
    tokens: { uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens },
    ...turn === undefined ? {} : { turn },
    ...step === undefined ? {} : { step },
    ...firstTokenMs === undefined ? {} : { firstTokenMs },
    ...durationMs === undefined ? {} : { durationMs },
    ...outputTps === undefined ? {} : { outputTps },
  }
}

/** Read one reliability day out of an untrusted document. */
function readDay(value: unknown): ReliabilityDay | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>
  const day = source.day
  if (typeof day !== 'string' || dayKeyToTime(day) === undefined) return undefined
  const retries = readCount(source.retries)
  const toolCalls = readCount(source.toolCalls)
  const toolErrors = readCount(source.toolErrors)
  const compactions = readCount(source.compactions)
  const compactionFailures = readCount(source.compactionFailures)
  const retryCauses = readCounts(source.retryCauses)
  const toolErrorCodes = readCounts(source.toolErrorCodes)
  if (retries === undefined || toolCalls === undefined || toolErrors === undefined
    || compactions === undefined || compactionFailures === undefined
    || retryCauses === undefined || toolErrorCodes === undefined) return undefined
  return {
    day,
    retries,
    retryCauses,
    toolCalls,
    toolErrors,
    toolErrorCodes,
    compactions,
    compactionFailures,
  }
}

/** Read one stored session out of an untrusted document. */
function readStored(value: unknown): StoredFold | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>
  const revision = source.revision
  const createdAt = readCount(source.createdAt)
  if (typeof revision !== 'string' || revision.length === 0 || createdAt === undefined) return undefined
  if (!Array.isArray(source.samples) || !Array.isArray(source.reliability)) return undefined
  const samples: UsageSample[] = []
  for (const candidate of source.samples) {
    const sample = readSample(candidate)
    if (sample === undefined) return undefined
    samples.push(sample)
  }
  const reliability: ReliabilityDay[] = []
  for (const candidate of source.reliability) {
    const day = readDay(candidate)
    if (day === undefined) return undefined
    reliability.push(day)
  }
  const title = source.title
  const cwd = source.cwd
  return {
    revision,
    createdAt,
    samples,
    reliability,
    ...typeof title === 'string' && title.length > 0 ? { title } : {},
    ...typeof cwd === 'string' && cwd.length > 0 ? { cwd } : {},
  }
}

/**
 * The newest instant an entry proves it has no data after.
 *
 * Samples carry their own instant; a reliability day is known to end at its
 * local midnight plus a day. An entry that recorded neither is undatable — an
 * empty session can be any age — so it reports `undefined` and is never pruned:
 * it is a couple of hundred bytes and it is exactly the entry that saves a read.
 *
 * @param entry - one stored session.
 * @returns the last covered instant, or `undefined` when the entry is undatable.
 */
function lastActivity(entry: StoredFold): number | undefined {
  let last: number | undefined
  for (const sample of entry.samples) {
    last = last === undefined ? sample.time : Math.max(last, sample.time)
  }
  for (const day of entry.reliability) {
    const start = dayKeyToTime(day.day)
    if (start === undefined) continue
    const end = start + MS_PER_DAY
    last = last === undefined ? end : Math.max(last, end)
  }
  return last
}

/**
 * Create the cache for one file, hydrating it from disk immediately.
 *
 * Hydration is synchronous for the same reason the rate store's is: it runs once
 * at activation, off the request path, and everything after it is a map lookup.
 * A read that fails is not an error this plugin can act on — an absent, damaged
 * or future-versioned file is simply an empty cache, and the next flush replaces
 * it.
 *
 * @param path - absolute path of the cache file.
 * @returns the cache.
 */
export function createFoldCache(path: string, warn?: (message: string) => void): FoldCache {
  const entries = new Map<string, StoredFold>()
  // The instant this document last dropped entries before. A request reaching
  // further back is answered from a fresh read rather than from a cache that may
  // have pruned what it is asking for.
  let prunedBefore = 0
  let dirty = false
  // Flushes are serialized through this chain: every write goes through the same
  // temporary file name, so two overlapping flushes would interleave into it.
  // The chain swallows failures for its own continuity only — the caller still
  // sees the error from the promise this returns.
  let queue: Promise<unknown> = Promise.resolve()

  const flushNow = async (now: number): Promise<void> => {
    if (!dirty) return
    const horizon = now - RETENTION_DAYS * MS_PER_DAY
    if (prunedBefore < horizon) prunedBefore = horizon
    for (const [sessionId, entry] of entries) {
      const last = lastActivity(entry)
      if (last !== undefined && last < horizon) entries.delete(sessionId)
    }
    const sessions: Record<string, unknown> = {}
    for (const [sessionId, entry] of entries) {
      sessions[sessionId] = {
        revision: entry.revision,
        createdAt: entry.createdAt,
        ...entry.title === undefined ? {} : { title: entry.title },
        ...entry.cwd === undefined ? {} : { cwd: entry.cwd },
        samples: entry.samples,
        reliability: entry.reliability.map(storedDay),
      }
    }
    // Compact rather than indented: this file is machine state that is rewritten
    // whole whenever a log changes, and the rate table's readable layout would
    // roughly double every one of those writes for nobody to read.
    const document = `${JSON.stringify({
      version: DOCUMENT_VERSION,
      prunedBefore,
      sessions,
    })}\n`
    // Cleared before the write rather than after it: a session folded while this
    // write is in flight has to leave the cache dirty, or the fold it just paid
    // for would never reach the disk it was written for.
    dirty = false
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${String(process.pid)}.tmp`
    await writeFile(temporary, document, 'utf8')
    await rename(temporary, path)
  }

  try {
    const document = JSON.parse(readFileSync(path, 'utf8')) as {
      version?: unknown
      prunedBefore?: unknown
      sessions?: unknown
    }
    // Version 1 predates per-settlement turn/step/timing, but its entries carry
    // the same fields this build reads; the missing timing is optional, so a v1
    // document is read rather than dropped. Dropping it would erase sessions whose
    // logs are already gone — the one loss this cache exists to prevent.
    if ((document.version === DOCUMENT_VERSION || document.version === 1)
      && typeof document.sessions === 'object' && document.sessions !== null) {
      for (const [sessionId, candidate] of Object.entries(document.sessions as Record<string, unknown>)) {
        const stored = readStored(candidate)
        if (sessionId.length > 0 && stored !== undefined) entries.set(sessionId, stored)
      }
      prunedBefore = readCount(document.prunedBefore) ?? 0
    } else if (typeof document.version === 'number' && document.version > DOCUMENT_VERSION) {
      warn?.(`dsh-local-usage: fold cache version ${String(document.version)} is newer than this build; starting empty`)
    }
  } catch {
    // No cache yet, or one this build cannot read: start empty.
  }

  return {
    all: () => entries.entries(),
    read: (sessionId, revision, from) => {
      if (from !== undefined && from < prunedBefore) return undefined
      const entry = entries.get(sessionId)
      if (entry === undefined || entry.revision !== revision) return undefined
      return entry
    },
    write: (sessionId, revision, fold) => {
      entries.set(sessionId, {
        revision,
        createdAt: fold.createdAt,
        samples: fold.samples,
        reliability: fold.reliability,
        ...fold.title === undefined ? {} : { title: fold.title },
        ...fold.cwd === undefined ? {} : { cwd: fold.cwd },
      })
      dirty = true
    },
    flush: (now = Date.now()) => {
      const run = queue.then(() => flushNow(now))
      queue = run.catch(() => {})
      return run
    },
  }
}
