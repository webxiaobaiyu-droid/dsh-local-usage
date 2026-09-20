/**
 * One day's usage, split by the directory it was spent in.
 *
 * The calendar answers "when did this profile spend". A single cell cannot
 * answer the question a reader has next, which is *what* it was spent on, and
 * the only axis in this data that answers that is the working directory a
 * session was created in: a session belongs to exactly one, it is what the
 * harness itself groups session logs by on disk, and it is what a reader means
 * by a project.
 *
 * The split is not pre-computed on the calendar's year report. Narrowing the
 * window to this one day re-folds the samples the Host already cached, so
 * opening a day costs one local round trip and re-reads no log — which is why
 * this view can afford to be a full page rather than a drawn-out fetch.
 *
 * @module dsh-local-usage/client/DayDetail
 */
import { type ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { UsageInsightsReport } from '../types.ts';
/** Everything the view renders and the three controls it offers. */
export interface DayDetailProps {
    /** The day being shown, as the report's `YYYY-MM-DD` key. */
    readonly day: string;
    /** That day's report, or `undefined` while the Host is folding it. */
    readonly report: UsageInsightsReport | undefined;
    /** Whether the fold failed; the reader recovers through `onRetry`. */
    readonly failed: boolean;
    /** Panel translate function. */
    readonly t: PropsLocale<'usage'>['t'];
    /** Currency formatter owned by the panel. */
    readonly formatCost: (value: number) => string;
    /** Compact token formatter owned by the panel, for the tiles. */
    readonly formatTokens: (value: number) => string;
    /** Full integer formatter owned by the panel, for the table. */
    readonly formatInteger: (value: number) => string;
    /** Percentage formatter owned by the panel, for the cache hit rate. */
    readonly formatPercent: (value: number) => string;
    /** Localized date formatter owned by the panel. */
    readonly formatDay: (day: string) => string;
    /** Localized weekday name for a day key. */
    readonly weekdayOf: (day: string) => string;
    /** Fold the day again after a failure. */
    readonly onRetry: () => void;
    /** Leave the drill-down and return to the calendar. */
    readonly onBack: () => void;
}
/**
 * Render one day's usage, ranked by the directory that produced it.
 * @param props - the day, its report or its absence, the formatters, and the controls.
 * @returns the day view.
 */
export declare function DayDetail({ day, report, failed, t, formatCost, formatTokens, formatInteger, formatPercent, formatDay, weekdayOf, onRetry, onBack, }: DayDetailProps): ReactNode;
