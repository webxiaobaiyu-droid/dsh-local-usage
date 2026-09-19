/**
 * Where the numbers come from, stated next to the numbers.
 *
 * A usage figure is only as trustworthy as its provenance, and this one has an
 * unusual shape worth saying out loud: the harness keeps no usage database, so
 * the panel reads the durable session logs themselves — every session on the
 * host, not just the current workspace — and folds them in memory. The facts a
 * reader would otherwise have to guess at (what is read, from where, what is
 * left out, whether anything leaves the machine) are listed here rather than
 * left to the README.
 *
 * @module dsh-local-usage/client/DataSourceNotes
 */
import type { ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { UsageInsightsReport } from '../types.ts';
/**
 * Render the provenance disclosure.
 * @param props - the report's live counts, the host facts, the calendar window, and the dictionary.
 * @returns the disclosure block.
 */
export declare function DataSourceNotes({ report, weeks, t }: {
    readonly report: UsageInsightsReport;
    /** Week columns the calendar spans, stated so the window is not a guess. */
    readonly weeks: number;
    readonly t: PropsLocale<'usage'>['t'];
}): ReactNode;
