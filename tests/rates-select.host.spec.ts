import { describe, expect, it } from 'vitest'
import { matchModel, selectRate } from '../src/pricing.ts'
import type { ModelPrice } from '../src/pricing.ts'

const FALLBACK: ModelPrice = {
  match: '',
  peakEnabled: true,
  offPeak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
  peak: { input: 4, cacheRead: 0.08, cacheWrite: 4, output: 16 },
}
const CARDS: readonly ModelPrice[] = [
  {
    match: 'glm-5.3',
    peakEnabled: true,
    offPeak: { input: 3, cacheRead: 0.3, cacheWrite: 3, output: 9 },
    peak: { input: 6, cacheRead: 0.6, cacheWrite: 6, output: 18 },
  },
  {
    match: 'deepseek-v4.1-flash',
    peakEnabled: true,
    offPeak: { input: 1, cacheRead: 0.02, cacheWrite: 1, output: 4 },
    peak: { input: 2, cacheRead: 0.04, cacheWrite: 2, output: 8 },
  },
]

describe('matchModel', () => {
  it('names the model that claimed a vendor route', () => {
    const match = matchModel(CARDS, FALLBACK, 'workbuddy/cn:deepseek-v4.1-flash')
    expect(match.source).toBe('model')
    expect(match.card.match).toBe('deepseek-v4.1-flash')
  })

  it('gives every route of one model the same card', () => {
    const direct = matchModel(CARDS, FALLBACK, 'commoncode/deepseek-v4.1-flash')
    const vendor = matchModel(CARDS, FALLBACK, 'ds123/deepseek-v4.1-flash')
    // The point of pricing by model: two vendors, one price configuration.
    expect(vendor.card).toBe(direct.card)
  })

  it('answers the fallback when nothing claims the route', () => {
    expect(matchModel(CARDS, FALLBACK, 'input/gpt-5.6-sol'))
      .toEqual({ card: FALLBACK, source: 'fallback' })
  })

  it('prefers the earlier card when two could claim the route', () => {
    const match = matchModel(CARDS, FALLBACK, 'ds123/glm-5.3-deepseek-v4.1-flash')
    expect(match.card.match).toBe('glm-5.3')
  })
})

describe('selectRate sources', () => {
  it('reports the model and both of its price sets', () => {
    const offPeak = selectRate(CARDS, FALLBACK, 'ds123/glm-5.3-flash', false)
    expect(offPeak.source).toBe('model')
    expect(offPeak.model).toBe('glm-5.3')
    expect(offPeak.rate.input).toBe(3)

    const peak = selectRate(CARDS, FALLBACK, 'ds123/glm-5.3-flash', true)
    expect(peak.rate.input).toBe(6)
    expect(peak.peakApplied).toBe(true)
  })

  it('leaves a route no model claims on the fallback card', () => {
    const selection = selectRate(CARDS, FALLBACK, 'input/gpt-5.6-sol', true)
    expect(selection.source).toBe('fallback')
    expect(selection.model).toBeUndefined()
    // The fallback card has a peak set of its own, and it applies.
    expect(selection.rate.input).toBe(4)
  })
})
