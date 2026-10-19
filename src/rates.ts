/**
 * Durable price edits, kept per model.
 *
 * The cards a profile is configured with match a model's name as a substring of
 * the route: convenient, and quietly wrong the moment a route they were never
 * written for happens to contain that name. An edit is the correction — one
 * model, two complete sets of prices, and a switch saying whether the peak set
 * applies — and this module owns where it lives.
 *
 * Edits are keyed by model rather than by route, which is what makes one edit
 * reach every vendor route of the same model. Consumption is not stored here and
 * is not affected by an edit: the fold still reports each route separately.
 *
 * It is a small JSON file under the harness home rather than a storage form: this
 * plugin mounts bare on deployments that have no storage backend, and a price
 * table the reader typed is worth persisting without making the whole panel
 * depend on a service that may not be there. The file is written through a
 * temporary sibling and renamed, so a crash mid-write cannot leave a truncated
 * table behind.
 *
 * @module dsh-local-usage/rates
 */

import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { UsageModelEdit, UsagePricingUpdate, UsageRate } from './types.ts'

/** Version of the on-disk document, bumped when its shape changes. */
const DOCUMENT_VERSION = 2

/**
 * The version this one migrates from: a table of per-route overrides.
 *
 * Those rows stored one set of prices each, and the peak prices were derived from
 * a multiplier that lived in configuration rather than in the file. The migration
 * therefore has to pick the multiplier the rows were most likely billed at; the
 * shipped default is two, and a row migrated at two keeps the money it was
 * showing.
 */
const LEGACY_DOCUMENT_VERSION = 1

/** The peak multiplier the legacy rows were billed at. */
const LEGACY_PEAK_MULTIPLIER = 2

/** Highest price this plugin accepts, per million tokens, in any currency. */
const MAX_RATE = 1_000_000

/** Every bucket price, in the order the panel writes them. */
const BUCKETS = ['input', 'cacheRead', 'cacheWrite', 'output'] as const

/**
 * The harness home the price file is written under.
 * @param env - process environment, read for `DSH_HOME`.
 * @param home - the user's home directory when `DSH_HOME` is unset.
 * @returns the absolute harness home.
 */
export function resolveDshHome(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  const configured = env.DSH_HOME?.trim()
  return configured !== undefined && configured.length > 0 ? configured : join(home, '.dsh')
}

/**
 * Where one harness home keeps this plugin's price file.
 * @param dshHome - absolute harness home.
 * @returns the absolute path of the file.
 */
export function pricingFilePath(dshHome: string): string {
  return join(dshHome, 'local-usage', 'pricing.json')
}

/**
 * Read one set of prices out of an untrusted value.
 * @param value - a candidate bucket map.
 * @returns the prices, or `undefined` when any bucket is not a sane non-negative price.
 */
export function readRate(value: unknown): UsageRate | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>
  const rate: Record<string, number> = {}
  for (const bucket of BUCKETS) {
    const raw = source[bucket]
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > MAX_RATE) return undefined
    rate[bucket] = raw
  }
  return rate as unknown as UsageRate
}

/**
 * Read one model edit out of an untrusted value.
 * @param value - a candidate edit.
 * @returns the edit, or `undefined` when either set of prices is not sane.
 */
export function readModelEdit(value: unknown): UsageModelEdit | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>
  if (typeof source.peakEnabled !== 'boolean') return undefined
  const peak = readRate(source.peak)
  const offPeak = readRate(source.offPeak)
  if (peak === undefined || offPeak === undefined) return undefined
  return { peakEnabled: source.peakEnabled, peak, offPeak }
}

/** Read one model map out of an untrusted document, dropping entries it cannot vouch for. */
function readModelEdits(value: unknown): Map<string, UsageModelEdit> {
  const edits = new Map<string, UsageModelEdit>()
  if (typeof value !== 'object' || value === null) return edits
  for (const [match, candidate] of Object.entries(value as Record<string, unknown>)) {
    const edit = readModelEdit(candidate)
    // The empty key is the fallback card, which is a legitimate entry.
    if (edit !== undefined) edits.set(match, edit)
  }
  return edits
}

/**
 * Migrate a table of per-route overrides into model cards.
 *
 * Each row is keyed by the full route it was written for, and its peak set is the
 * row's own prices at the legacy multiplier. Keying by the route means the
 * migration never has to guess which part of `vendor/cn:model` is the model — the
 * card simply claims the route it was written for, exactly as narrowly as the
 * reader wrote it.
 *
 * @param value - the legacy `routes` map.
 * @returns one card per migrated route.
 */
function migrateRoutes(value: unknown): Map<string, UsageModelEdit> {
  const edits = new Map<string, UsageModelEdit>()
  if (typeof value !== 'object' || value === null) return edits
  for (const [route, candidate] of Object.entries(value as Record<string, unknown>)) {
    const rate = readRate(candidate)
    if (route.length === 0 || rate === undefined) continue
    edits.set(route, {
      peakEnabled: true,
      peak: {
        input: rate.input * LEGACY_PEAK_MULTIPLIER,
        cacheRead: rate.cacheRead * LEGACY_PEAK_MULTIPLIER,
        cacheWrite: rate.cacheWrite * LEGACY_PEAK_MULTIPLIER,
        output: rate.output * LEGACY_PEAK_MULTIPLIER,
      },
      offPeak: rate,
    })
  }
  return edits
}

/** The persisted price edits, kept in memory and mirrored to disk. */
export interface RateStore {
  /** Every edit in effect, keyed by model `match`. */
  read(): ReadonlyMap<string, UsageModelEdit>
  /**
   * Apply one validated update and persist the result.
   * @param update - models to write; `null` clears that model's edit.
   * @returns the table in effect after the write.
   */
  write(update: UsagePricingUpdate): Promise<Record<string, UsageModelEdit>>
}

/**
 * Create the store for one file, hydrating it from disk immediately.
 *
 * Hydration is synchronous on purpose: the report path is the hot one, this runs
 * once at activation, and the document is a handful of lines. A read that fails
 * is not an error the plugin can act on — an absent or unreadable table is simply
 * no edits, and the next write replaces the file.
 *
 * @param path - absolute path of the price file.
 * @returns the store.
 */
export function createRateStore(path: string): RateStore {
  const models = new Map<string, UsageModelEdit>()
  try {
    const document = JSON.parse(readFileSync(path, 'utf8')) as {
      version?: unknown
      models?: unknown
      routes?: unknown
    }
    // A document from a future build is not guessed at; a bump has to bring a
    // migration with it, the way every other stored shape in this product does.
    if (document.version === DOCUMENT_VERSION) {
      for (const [match, edit] of readModelEdits(document.models)) models.set(match, edit)
    } else if (document.version === LEGACY_DOCUMENT_VERSION) {
      // Read, migrated, and written back on the next save: the v1 rows are the
      // reader's prices, and losing them to a version bump would be the one cost
      // of this change they would notice.
      for (const [route, edit] of migrateRoutes(document.routes)) models.set(route, edit)
    }
  } catch {
    // No table yet: start empty.
  }

  const snapshot = (): Record<string, UsageModelEdit> => Object.fromEntries(models)

  return {
    read: () => models,
    write: async (update) => {
      for (const [match, edit] of Object.entries(update.models)) {
        if (edit === null) models.delete(match)
        else models.set(match, edit)
      }
      const document = `${JSON.stringify({ version: DOCUMENT_VERSION, models: snapshot() }, null, 2)}\n`
      await mkdir(dirname(path), { recursive: true })
      const temporary = `${path}.${String(process.pid)}.tmp`
      await writeFile(temporary, document, 'utf8')
      await rename(temporary, path)
      return snapshot()
    },
  }
}
