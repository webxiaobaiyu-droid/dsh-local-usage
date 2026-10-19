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
import type { UsageModelPrice, UsagePricingUpdate } from '../types.ts';
/** One set of four price fields, as typed. */
export interface PriceFields {
    input: string;
    cacheRead: string;
    cacheWrite: string;
    output: string;
}
/** One model's draft: the switch and both sets of prices. */
export interface ModelDraft {
    /** Whether the model prices peak separately. */
    peakEnabled: boolean;
    /** Prices inside a peak window; ignored while {@link peakEnabled} is false. */
    peak: PriceFields;
    /** Prices outside one, or the flat price when {@link peakEnabled} is false. */
    offPeak: PriceFields;
}
/** Every model's draft, keyed by the card's `match`. */
export type ModelDrafts = Record<string, ModelDraft>;
/** The four buckets, in the order the editor writes them. */
export declare const RATE_FIELDS: readonly ["input", "cacheRead", "cacheWrite", "output"];
/** One bucket of one card. */
export type RateField = typeof RATE_FIELDS[number];
/** Which of a card's two sets of prices a field belongs to. */
export type PriceSet = 'peak' | 'offPeak';
/** What one set of drafts amounts to. */
export type RateDraftResult = 
/** Nothing to write: every card already matches the prices in effect. */
{
    readonly status: 'empty';
}
/** A field holds text that is not a price; names the card, the set and the field. */
 | {
    readonly status: 'invalid';
    readonly model: string;
    readonly set: PriceSet;
    readonly field: RateField;
}
/** A write to send. */
 | {
    readonly status: 'ready';
    readonly update: UsagePricingUpdate;
};
/**
 * The drafts an editor opens on: one per card, pre-filled with what is in effect.
 * @param models - the cards the report published, in match order.
 * @returns one draft per card, keyed by `match`.
 */
export declare function draftsFrom(models: readonly UsageModelPrice[]): ModelDrafts;
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
export declare function pendingUpdate(drafts: ModelDrafts, models: readonly UsageModelPrice[]): RateDraftResult;
