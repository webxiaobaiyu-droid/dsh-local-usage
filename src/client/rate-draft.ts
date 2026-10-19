/**
 * Editing the model price cards.
 *
 * The editor holds text fields, not numbers: a reader clearing one to fall back
 * to the value in effect is a real intention, and a number input cannot tell
 * "empty" from "zero". The drafts are therefore strings until the moment they
 * become an update, and this module owns that translation — which cards actually
 * changed, which fields hold something that is not a price, and which set of
 * prices a field belongs to.
 *
 * A card is a model, not a route: editing one changes every route that model is
 * sold under, which is the point of pricing by model. Consumption stays per route
 * and is not edited here at all.
 *
 * @module dsh-local-usage/client/rate-draft
 */

import type { UsageModelEdit, UsageModelPrice, UsagePricingUpdate, UsageRate } from '../types.ts'

/** One set of four price fields, as typed. */
export interface PriceFields {
  input: string
  cacheRead: string
  cacheWrite: string
  output: string
}

/** One model's draft: the switch and both sets of prices. */
export interface ModelDraft {
  /** Whether the model prices peak separately. */
  peakEnabled: boolean
  /** Prices inside a peak window; ignored while {@link peakEnabled} is false. */
  peak: PriceFields
  /** Prices outside one, or the flat price when {@link peakEnabled} is false. */
  offPeak: PriceFields
}

/** Every model's draft, keyed by the card's `match`. */
export type ModelDrafts = Record<string, ModelDraft>

/** The four buckets, in the order the editor writes them. */
export const RATE_FIELDS = ['input', 'cacheRead', 'cacheWrite', 'output'] as const

/** One bucket of one card. */
export type RateField = typeof RATE_FIELDS[number]

/** Which of a card's two sets of prices a field belongs to. */
export type PriceSet = 'peak' | 'offPeak'

/** What one set of drafts amounts to. */
export type RateDraftResult =
  /** Nothing to write: every card already matches the prices in effect. */
  | { readonly status: 'empty' }
  /** A field holds text that is not a price; names the card, the set and the field. */
  | {
    readonly status: 'invalid'
    readonly model: string
    readonly set: PriceSet
    readonly field: RateField
  }
  /** A write to send. */
  | { readonly status: 'ready'; readonly update: UsagePricingUpdate }

/** Render one number the way an editable field shows it. */
function draftOf(value: number): string {
  return Number.isFinite(value) ? String(value) : ''
}

/** The four fields of one set, as the editor shows them. */
function fieldsOf(rate: UsageRate): PriceFields {
  return {
    input: draftOf(rate.input),
    cacheRead: draftOf(rate.cacheRead),
    cacheWrite: draftOf(rate.cacheWrite),
    output: draftOf(rate.output),
  }
}

/**
 * The drafts an editor opens on: one per card, pre-filled with what is in effect.
 * @param models - the cards the report published, in match order.
 * @returns one draft per card, keyed by `match`.
 */
export function draftsFrom(models: readonly UsageModelPrice[]): ModelDrafts {
  const drafts: ModelDrafts = {}
  for (const card of models) {
    drafts[card.match] = {
      peakEnabled: card.peakEnabled,
      peak: fieldsOf(card.peak),
      offPeak: fieldsOf(card.offPeak),
    }
  }
  return drafts
}

/** Parse one field: `undefined` for blank, `null` for text that is not a price. */
function readField(text: string): number | undefined | null {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** Whether every field of one set is blank. */
function isBlank(fields: PriceFields): boolean {
  return RATE_FIELDS.every(field => fields[field].trim().length === 0)
}

/** Whether two sets state the same four prices. */
function samePrices(left: UsageRate, right: UsageRate): boolean {
  return RATE_FIELDS.every(field => left[field] === right[field])
}

/**
 * Turn one set of drafts into the write it implies.
 *
 * A card is written only when it differs from what is in effect, so the table
 * never fills with edits that merely restate the configuration. Blank fields are
 * completed from the value in effect rather than rejected — a reader editing only
 * the output price means the other three as they stand — and a card whose fields
 * are all blank asks for the reader's edit to be dropped, returning the model to
 * its configured prices.
 *
 * @param drafts - the fields as typed.
 * @param models - the cards and the prices currently in effect.
 * @returns nothing to do, the first invalid field, or the update to send.
 */
export function pendingUpdate(
  drafts: ModelDrafts,
  models: readonly UsageModelPrice[],
): RateDraftResult {
  const writes: Record<string, UsageModelEdit | null> = {}

  for (const card of models) {
    const draft = drafts[card.match]
    if (draft === undefined) continue

    // A card blanked on both sets asks for the edit to be dropped. With the
    // switch off, the peak set is not read at all, so only the flat set counts.
    const blankBoth = isBlank(draft.offPeak) && isBlank(draft.peak)
    if (blankBoth) {
      writes[card.match] = null
      continue
    }

    const offPeak = resolve(draft.offPeak, card.offPeak)
    if ('field' in offPeak) {
      return { status: 'invalid', model: card.match, set: 'offPeak', field: offPeak.field }
    }
    // The peak set only matters while the switch is on; a flat model keeps
    // whatever peak prices it carries rather than validating fields it ignores.
    let peak: UsageRate = card.peak
    if (draft.peakEnabled) {
      const read = resolve(draft.peak, card.peak)
      if ('field' in read) {
        return { status: 'invalid', model: card.match, set: 'peak', field: read.field }
      }
      peak = read.rate
    }

    const next: UsageModelEdit = {
      peakEnabled: draft.peakEnabled,
      peak,
      offPeak: offPeak.rate,
    }
    const unchanged = next.peakEnabled === card.peakEnabled
      && samePrices(next.offPeak, card.offPeak)
      && samePrices(next.peak, card.peak)
    if (!unchanged) writes[card.match] = next
  }

  return Object.keys(writes).length === 0
    ? { status: 'empty' }
    : { status: 'ready', update: { models: writes } }
}

/**
 * Read one set of fields, completing blanks from the prices in effect.
 * @param fields - the four fields as typed.
 * @param effective - the prices those fields stand for when left blank.
 * @returns either the four prices or the first field that is not one.
 */
function resolve(fields: PriceFields, effective: UsageRate): { rate: UsageRate } | { field: RateField } {
  const rate: Record<RateField, number> = {
    input: effective.input,
    cacheRead: effective.cacheRead,
    cacheWrite: effective.cacheWrite,
    output: effective.output,
  }
  for (const field of RATE_FIELDS) {
    const value = readField(fields[field])
    if (value === null) return { field }
    if (value !== undefined) rate[field] = value
  }
  return { rate }
}
