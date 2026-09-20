/**
 * What the window spent its attempts on, stated under the calendar.
 *
 * Cost and reliability answer two halves of one question, and the panel keeps
 * them apart on purpose: the figures above are what was billed, this block is
 * what it took to get there — provider attempts that had to be repeated, tool
 * calls that came back as errors, and context compactions that failed and so
 * left their context uncompacted. A compromised run is the usual reason a window
 * costs more than its token counts suggest, so the block reads as an explanation
 * of the figures above rather than as a separate report.
 *
 * It renders nothing when the window recorded nothing. A heading that is present
 * but empty would be a claim about windows nobody asked about, and one that is
 * usually there is one readers stop seeing.
 *
 * @module dsh-local-usage/client/ReliabilityNotes
 */
import type { ReactNode } from 'react';
import type { UsageReliability } from '../types.ts';
import type { UsageInsightsLocaleKey } from './locales.ts';
/** The block's inputs: the window's counters and the panel's formatters. */
export interface ReliabilityNotesProps {
    /** The window's reliability fold. */
    readonly reliability: UsageReliability;
    /** Panel translate function. */
    readonly t: (key: UsageInsightsLocaleKey, params?: Record<string, string>) => string;
    /** Full integer formatter owned by the panel. */
    readonly integer: (value: number) => string;
    /** Percentage formatter owned by the panel. */
    readonly percent: (value: number) => string;
}
/**
 * Render the window's reliability statement.
 * @param props - the counters, the dictionary, and the panel's formatters.
 * @returns the block, or `null` when the window recorded nothing.
 */
export declare function ReliabilityNotes({ reliability, t, integer, percent }: ReliabilityNotesProps): ReactNode;
