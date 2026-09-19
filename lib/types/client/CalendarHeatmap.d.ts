/**
 * The year in usage: one cell per day, shaded by what that day cost.
 *
 * There is no charting library in this product and adding one is out of bounds,
 * so the calendar is a CSS grid of fixed-size cells — never fractional tracks,
 * because a cell whose box depends on its track width has no stable intrinsic
 * size to lay out against. A ResizeObserver measures the panel instead: while a
 * year of weeks fits at the minimum cell edge the cells grow to fill it, and
 * below that the grid keeps the minimum edge and drops its oldest weeks. Either
 * way the grid never scrolls sideways.
 *
 * Shading is a quantile ramp over the window's active days (median, then 75th
 * and 90th percentiles), so the scale adapts to how the profile actually spends
 * instead of assuming a distribution.
 *
 * @module dsh-local-usage/client/CalendarHeatmap
 */
import { type ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { UsageDayRow } from '../types.ts';
/** Everything the calendar renders, resolved by the panel that owns the data. */
export interface CalendarHeatmapProps {
    /** First day of the window, Unix epoch milliseconds; a Sunday by construction. */
    readonly from: number;
    /** Last rendered day inclusive, normally today. */
    readonly to: number;
    /** Day rows in the window, ascending; days with no usage are simply absent. */
    readonly days: readonly UsageDayRow[];
    /** Cost over the whole window. */
    readonly totalCost: number;
    /** The most expensive day in the window, when it has any usage. */
    readonly peak: UsageDayRow | undefined;
    /** Panel translate function. */
    readonly t: PropsLocale<'usage'>['t'];
    /** Currency formatter owned by the panel. */
    readonly formatCost: (value: number) => string;
    /** Token formatter owned by the panel. */
    readonly formatTokens: (value: number) => string;
}
/**
 * Render the calendar grid plus its legend and hover card.
 * @param props - the window, its day rows, the selected range, formatters, and copy.
 * @returns the calendar figure.
 */
export declare function CalendarHeatmap({ from, to, days, totalCost, peak, t, formatCost, formatTokens, }: CalendarHeatmapProps): ReactNode;
