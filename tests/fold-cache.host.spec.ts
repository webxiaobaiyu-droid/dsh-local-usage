/**
 * The durable fold cache: what it keeps, what it refuses, and what it drops.
 *
 * The cache exists to make a restarted Host draw the year without opening a
 * single session log, so the tests that matter are the ones about *refusal*: a
 * revision that moved, a request reaching past what retention kept, a document
 * this build cannot read. Every one of them has to come back as a miss, because
 * the only cost of a miss is the read the cache was there to save.
 *
 * @module dsh-local-usage/tests/fold-cache
 */

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFoldCache, foldCacheFilePath, RETENTION_DAYS } from '../src/fold-cache.ts'
import type { CachedFold } from '../src/fold-cache.ts'

const MS_PER_DAY = 86_400_000

/** A fold with one settlement at `time` and one reliability day. */
function fold(time: number): CachedFold {
  return {
    createdAt: time - 1000,
    samples: [{ time, route: 'p/m', tokens: { uncachedInputTokens: 10, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 } }],
    reliability: [{
      day: new Date(time).toISOString().slice(0, 10),
      retries: 1,
      retryCauses: new Map([['RATE_LIMIT', 1]]),
      toolCalls: 2,
      toolErrors: 1,
      toolErrorCodes: new Map([['FS_STALE_VERSION', 1]]),
      compactions: 1,
      compactionFailures: 0,
    }],
    title: 'a session',
    cwd: '/tmp/project',
  }
}

/** A cache file inside a fresh temporary directory, with its parent directory made. */
async function cachePath(): Promise<string> {
  const path = foldCacheFilePath(await mkdtemp(join(tmpdir(), 'dlu-fold-')))
  await mkdir(dirname(path), { recursive: true })
  return path
}

describe('createFoldCache', () => {
  it('answers a read with the fold it stored under the same revision', async () => {
    const path = await cachePath()
    const cache = createFoldCache(path)
    const time = Date.now() - MS_PER_DAY

    cache.write('s1', 'rev-1', fold(time))
    await cache.flush()

    const reopened = createFoldCache(path)
    const hit = reopened.read('s1', 'rev-1', undefined)
    expect(hit?.samples).toHaveLength(1)
    expect(hit?.title).toBe('a session')
    expect(hit?.cwd).toBe('/tmp/project')
    // The two count maps survive the round trip as maps, not as plain objects.
    expect(hit?.reliability[0]?.retryCauses.get('RATE_LIMIT')).toBe(1)
    expect(hit?.reliability[0]?.toolErrorCodes.get('FS_STALE_VERSION')).toBe(1)
    expect(hit?.reliability[0]?.toolCalls).toBe(2)
  })

  it('round-trips per-settlement timing and retry metadata', async () => {
    const path = await cachePath()
    const cache = createFoldCache(path)
    const time = Date.now() - MS_PER_DAY

    cache.write('s1', 'rev-1', {
      ...fold(time),
      samples: [{
        time,
        route: 'p/m',
        tokens: { uncachedInputTokens: 10, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
        turn: 3,
        step: 2,
        firstTokenMs: 250,
        durationMs: 1400,
        outputTps: 42.5,
      }],
    })
    await cache.flush()

    expect(createFoldCache(path).read('s1', 'rev-1', undefined)?.samples[0]).toMatchObject({
      turn: 3,
      step: 2,
      firstTokenMs: 250,
      durationMs: 1400,
      outputTps: 42.5,
    })
  })

  it('refuses a fold stored under another revision', async () => {
    const path = await cachePath()
    const cache = createFoldCache(path)
    cache.write('s1', 'rev-1', fold(Date.now() - MS_PER_DAY))
    await cache.flush()

    expect(createFoldCache(path).read('s1', 'rev-2', undefined)).toBeUndefined()
  })

  it('refuses a window reaching past what retention kept', async () => {
    const path = await cachePath()
    const now = Date.now()
    const cache = createFoldCache(path)
    cache.write('s1', 'rev-1', fold(now - MS_PER_DAY))
    await cache.flush(now)

    const reopened = createFoldCache(path)
    const horizon = now - RETENTION_DAYS * MS_PER_DAY
    // Inside the horizon, and the entry's own window: both answered.
    expect(reopened.read('s1', 'rev-1', horizon + MS_PER_DAY)).toBeDefined()
    // Before it: the cache cannot vouch for that far back, so it misses.
    expect(reopened.read('s1', 'rev-1', horizon - MS_PER_DAY)).toBeUndefined()
  })

  it('lists every retained entry, including one the backend no longer lists', async () => {
    const path = await cachePath()
    const now = Date.now()
    const cache = createFoldCache(path)
    cache.write('still-listed', 'rev-1', fold(now - MS_PER_DAY))
    cache.write('deleted', 'rev-1', fold(now - 2 * MS_PER_DAY))
    await cache.flush(now)

    const reopened = createFoldCache(path)
    const ids = [...reopened.all()].map(([id]) => id).sort()
    expect(ids).toEqual(['deleted', 'still-listed'])
  })

  it('reads a version-1 document instead of discarding the sessions only it remembers', async () => {
    const path = await cachePath()
    const time = Date.now() - MS_PER_DAY
    const stored = {
      version: 1,
      prunedBefore: 0,
      sessions: {
        old: {
          revision: 'rev-1',
          createdAt: time - 1000,
          samples: [{ time, route: 'p/m', tokens: { uncachedInputTokens: 10, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 } }],
          reliability: [],
        },
      },
    }
    await writeFile(path, JSON.stringify(stored), 'utf8')

    const cache = createFoldCache(path)
    const fold = cache.read('old', 'rev-1', undefined)
    expect(fold?.samples).toHaveLength(1)
    expect(fold?.samples[0]?.tokens.uncachedInputTokens).toBe(10)
    // Version 1 had no per-call timing; the missing fields stay absent.
    expect(fold?.samples[0]?.firstTokenMs).toBeUndefined()
  })

  it('drops an entry no window can reach any more', async () => {
    const path = await cachePath()
    const now = Date.now()
    const cache = createFoldCache(path)
    cache.write('old', 'rev-1', fold(now - (RETENTION_DAYS + 10) * MS_PER_DAY))
    cache.write('recent', 'rev-1', fold(now - MS_PER_DAY))
    await cache.flush(now)

    const document = JSON.parse(await readFile(path, 'utf8')) as { sessions: Record<string, unknown> }
    expect(Object.keys(document.sessions)).toEqual(['recent'])
  })

  it('keeps an entry that recorded nothing, because it is undatable and tiny', async () => {
    const path = await cachePath()
    const now = Date.now()
    const cache = createFoldCache(path)
    cache.write('quiet', 'rev-1', {
      createdAt: now - (RETENTION_DAYS + 100) * MS_PER_DAY,
      samples: [],
      reliability: [],
    })
    await cache.flush(now)

    const document = JSON.parse(await readFile(path, 'utf8')) as { sessions: Record<string, unknown> }
    expect(Object.keys(document.sessions)).toEqual(['quiet'])
  })

  it('starts empty on a document from another build', async () => {
    const path = await cachePath()
    await writeFile(path, JSON.stringify({
      version: 99,
      sessions: { s1: { revision: 'rev-1', createdAt: 1, samples: [], reliability: [] } },
    }), 'utf8')

    expect(createFoldCache(path).read('s1', 'rev-1', undefined)).toBeUndefined()
  })

  it('drops only the entries a damaged document cannot vouch for', async () => {
    const path = await cachePath()
    const now = Date.now()
    const good = fold(now - MS_PER_DAY)
    await writeFile(path, JSON.stringify({
      version: 2,
      sessions: {
        good: { revision: 'rev-1', createdAt: good.createdAt, samples: good.samples, reliability: [] },
        // A sample whose token buckets are not numbers: this entry is dropped,
        // and its neighbour is not.
        bad: { revision: 'rev-1', createdAt: 1, samples: [{ time: 1, route: 'p/m', tokens: { uncachedInputTokens: 'many' } }], reliability: [] },
      },
    }), 'utf8')

    const cache = createFoldCache(path)
    expect(cache.read('good', 'rev-1', undefined)).toBeDefined()
    expect(cache.read('bad', 'rev-1', undefined)).toBeUndefined()
  })

  it('treats an unreadable file as no cache at all', async () => {
    const path = await cachePath()
    await writeFile(path, 'not json', 'utf8')

    expect(createFoldCache(path).read('s1', 'rev-1', undefined)).toBeUndefined()
  })

  it('serializes overlapping flushes rather than interleaving one temp file', async () => {
    const path = await cachePath()
    const cache = createFoldCache(path)
    cache.write('s1', 'rev-1', fold(Date.now() - MS_PER_DAY))

    await Promise.all([cache.flush(), cache.flush(), cache.flush()])

    const document = JSON.parse(await readFile(path, 'utf8')) as { sessions: Record<string, unknown> }
    expect(Object.keys(document.sessions)).toEqual(['s1'])
  })
})
