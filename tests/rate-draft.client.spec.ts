import { describe, expect, it } from 'vitest'
import { draftsFrom, pendingUpdate, RATE_FIELDS } from '../src/client/rate-draft.ts'
import type { ModelDrafts, ModelDraft } from '../src/client/rate-draft.ts'
import type { UsageModelPrice } from '../src/types.ts'

const FLASH = { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 }
const STRICT = { input: 3, cacheRead: 0.3, cacheWrite: 3, output: 9 }

/** Two cards: one that prices peak separately, one flat. */
const CARDS: readonly UsageModelPrice[] = [
  {
    match: 'flash',
    peakEnabled: true,
    offPeak: FLASH,
    peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
  },
  {
    match: 'strict-model',
    peakEnabled: false,
    offPeak: STRICT,
    peak: STRICT,
  },
]

/** Rewrite one field of one card's draft. */
function edit(model: string, set: 'peak' | 'offPeak', field: string, value: string): ModelDrafts {
  const drafts = draftsFrom(CARDS)
  const card = drafts[model] as unknown as Record<string, Record<string, string> & { peakEnabled: boolean }>
  const target = set === 'peak' ? card.peak : card.offPeak
  if (target !== undefined) target[field] = value
  return drafts
}

describe('draftsFrom', () => {
  it('opens on both sets of prices, with the switch as configured', () => {
    const drafts = draftsFrom(CARDS)
    expect(drafts.flash).toEqual({
      peakEnabled: true,
      peak: { input: '2', cacheRead: '0.04', cacheWrite: '2', output: '8' },
      offPeak: { input: '1', cacheRead: '0.02', cacheWrite: '1', output: '4' },
    })
    expect(drafts['strict-model']?.peakEnabled).toBe(false)
  })
})

describe('pendingUpdate', () => {
  it('writes nothing when nothing was touched', () => {
    expect(pendingUpdate(draftsFrom(CARDS), CARDS)).toEqual({ status: 'empty' })
  })

  it('writes only the card that changed, with both of its sets', () => {
    const result = pendingUpdate(edit('flash', 'offPeak', 'output', '5'), CARDS)
    expect(result).toEqual({
      status: 'ready',
      update: {
        models: {
          flash: {
            peakEnabled: true,
            peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
            offPeak: { ...FLASH, output: 5 },
          },
        },
      },
    })
  })

  it('fills blank fields from the prices in effect', () => {
    const result = pendingUpdate(edit('flash', 'peak', 'input', '7'), CARDS)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.update.models.flash).toMatchObject({
      peak: { input: 7, cacheRead: 0.04, cacheWrite: 2, output: 8 },
    })
  })

  it('drops the edit when both sets are blanked', () => {
    const drafts = draftsFrom(CARDS)
    const card = drafts['strict-model'] as ModelDraft
    for (const field of RATE_FIELDS) card.offPeak[field] = ''
    for (const field of RATE_FIELDS) card.peak[field] = ''
    expect(pendingUpdate(drafts, CARDS))
      .toEqual({ status: 'ready', update: { models: { 'strict-model': null } } })
  })

  it('writes the switch when it is turned on, even with no number typed', () => {
    const drafts = draftsFrom(CARDS)
    ;(drafts['strict-model'] as ModelDraft).peakEnabled = true
    const result = pendingUpdate(drafts, CARDS)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.update.models['strict-model']).toMatchObject({ peakEnabled: true })
  })

  it('names the card, the set and the field that is not a price', () => {
    expect(pendingUpdate(edit('flash', 'peak', 'cacheRead', 'cheap'), CARDS)).toEqual({
      status: 'invalid',
      model: 'flash',
      set: 'peak',
      field: 'cacheRead',
    })
    expect(pendingUpdate(edit('flash', 'offPeak', 'input', '-1'), CARDS)).toEqual({
      status: 'invalid',
      model: 'flash',
      set: 'offPeak',
      field: 'input',
    })
  })

  it('does not validate the peak set of a model that does not price peak', () => {
    // The switch is off, so those four fields are not read at all — a stray
    // character there must not block a save that has nothing to do with them.
    const drafts = edit('strict-model', 'peak', 'input', 'nonsense')
    const result = pendingUpdate(drafts, CARDS)
    expect(result).toEqual({ status: 'empty' })
  })
})
