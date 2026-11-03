/**
 * The window's spend, listed by the route that billed it and the directory it
 * happened in.
 *
 * The figure above answers what the window's shape was; these answer what it was
 * made of, and they answer it with numbers rather than with curves: a table can
 * be read exactly, compared down a column, and scanned for the one row that is
 * out of proportion, which is what a reader does with a model's or a project's
 * spend. Both of these have been in the report since the fold was written and
 * have had no surface until now.
 *
 * Two tables rather than one with a switch: they answer different questions —
 * *which model* the money went to, and *whose work* it was — and a reader who
 * wants one is not always asking the other. Both are the same table, so both are
 * drawn by the same code.
 *
 * @module dsh-local-usage/client/StatsTables
 */
import type { ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { UsageInsightsReport } from '../types.ts';
/** Props for the tables. */
export interface StatsTablesProps {
    /** The report for the range the reader selected. */
    readonly report: UsageInsightsReport;
    readonly t: PropsLocale<'usage'>['t'];
    readonly formatCost: (value: number) => string;
    readonly formatInteger: (value: number) => string;
    readonly formatPercent: (value: number) => string;
}
/**
 * Render the window's spend by model and by project.
 * @param props - the report and the formatters.
 * @returns the two tables.
 */
export declare function StatsTables({ report, t, formatCost, formatInteger, formatPercent }: StatsTablesProps): ReactNode;
