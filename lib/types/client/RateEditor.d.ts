/**
 * The reader's price cards, one per model.
 *
 * Prices belong to models, not to routes: a model sold through four vendors is
 * the same model at the same price, and pricing is the one thing that should not
 * be re-entered per vendor. Each card therefore states its model's name, whether
 * it prices peak separately, and both sets of prices — four numbers inside a peak
 * window and four outside it, or one set when the switch is off.
 *
 * Consumption is not edited here and is not folded into these numbers: the route
 * table beside this editor states what each route spent, so a reader can see
 * which routes one card now covers without the two figures being merged.
 *
 * @module dsh-local-usage/client/RateEditor
 */
import { type ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { UsageModelPrice, UsagePricingUpdate } from '../types.ts';
/** Props for the card editor. */
export interface RateEditorProps {
    /** The cards in match order; the fallback card has an empty `match`. */
    readonly models: readonly UsageModelPrice[];
    /** Currency every price is expressed in, shown once beside the save action. */
    readonly currency: string;
    /** Panel translate function. */
    readonly t: PropsLocale<'usage'>['t'];
    /** Persist one update; rejects with a message the editor shows. */
    readonly onSave: (update: UsagePricingUpdate) => Promise<void>;
}
/**
 * Render the editable price cards.
 * @param props - the cards, currency, dictionary and the save action.
 * @returns the editor.
 */
export declare function RateEditor({ models, currency, t, onSave }: RateEditorProps): ReactNode;
