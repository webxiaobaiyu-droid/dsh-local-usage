import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRateStore } from '../src/rates.ts'

const RATE = { input: 1.5, cacheRead: 0.05, cacheWrite: 1.5, output: 6 }

let dir = ''

beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'dlu-rates-')) })
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

describe('createRateStore', () => {
  it('starts empty and writes a model edit', async () => {
    const path = join(dir, 'pricing.json')
    const store = createRateStore(path)
    expect(store.read().size).toBe(0)

    const saved = await store.write({
      models: { flash: { peakEnabled: true, peak: { ...RATE, input: 3 }, offPeak: RATE } },
    })
    expect(saved.flash).toMatchObject({ peakEnabled: true, offPeak: RATE })
    // Re-read from disk: a fresh store sees the same table.
    expect(createRateStore(path).read().get('flash')?.peak.input).toBe(3)
  })

  it('clears an edit with a null', async () => {
    const path = join(dir, 'pricing.json')
    const store = createRateStore(path)
    await store.write({ models: { flash: { peakEnabled: false, peak: RATE, offPeak: RATE } } })
    expect(await store.write({ models: { flash: null } })).toEqual({})
  })

  it('leaves a document from a future version alone', async () => {
    const path = join(dir, 'pricing.json')
    await writeFile(path, JSON.stringify({ version: 99, models: { flash: { peakEnabled: true, peak: RATE, offPeak: RATE } } }))
    expect(createRateStore(path).read().size).toBe(0)
  })

  it('migrates a per-route table into cards that claim each route', async () => {
    const path = join(dir, 'pricing.json')
    await writeFile(path, JSON.stringify({ version: 1, routes: { 'vendor/cn:model-a': RATE } }))
    const store = createRateStore(path)

    // The old row becomes a card keyed by the route it was written for, so the
    // migration never has to guess which part of a route is the model.
    expect(store.read().get('vendor/cn:model-a')).toEqual({
      peakEnabled: true,
      // The legacy rows were billed at the shipped multiplier of two.
      peak: { input: 3, cacheRead: 0.1, cacheWrite: 3, output: 12 },
      offPeak: RATE,
    })
  })

  it('writes the migrated table back as a v2 document on the next save', async () => {
    const path = join(dir, 'pricing.json')
    await writeFile(path, JSON.stringify({ version: 1, routes: { 'a/model': RATE } }))
    const store = createRateStore(path)
    await store.write({ models: { other: { peakEnabled: false, peak: RATE, offPeak: RATE } } })

    const document = JSON.parse(await readFile(path, 'utf8')) as { version: number; routes?: unknown }
    expect(document.version).toBe(2)
    expect(document.routes).toBeUndefined()
  })
})
