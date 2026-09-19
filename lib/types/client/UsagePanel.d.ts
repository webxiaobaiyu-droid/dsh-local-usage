/**
 * Usage statistics panel: the year in spend, with a range lens over it.
 *
 * This is a global panel rather than a settings page: the calendar needs the
 * main column's width to show a whole year without scrolling, and what the
 * profile has spent is not a preference. It spans the current year and fills in
 * as the year passes; the range selector narrows the figures and rings the days
 * it covers, so the frame stays put while the reading changes.
 *
 * Everything is fetched per session fold the Host already cached, so switching
 * ranges re-prices instead of re-reading logs.
 *
 * @module dsh-local-usage/client/UsagePanel
 */
import { type ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { UsageInsightsReport } from '../types.ts';
/** Registration-side face the panel reads its data through. */
export interface UsagePanelInjected {
    /** Key this panel occupies in the main column, matching the sidebar entry. */
    panelId: MainPanelId;
    /** Assemble the report; `refresh` discards the Host's per-session fold cache. */
    report: (refresh: boolean, from: number, to: number) => Promise<UsageInsightsReport>;
}
/** Full component props assembled by the main slot renderer. */
export type UsagePanelProps = PropsRuntime<'main'> & PropsLocale<'usage'> & InjectFace<UsagePanelInjected>;
/**
 * Render the Usage statistics panel.
 * @param props - panel runtime, dictionary, and the injected report reader.
 * @returns the panel content.
 */
export declare function UsagePanel({ panelId, report, t, usePanelInfo }: UsagePanelProps): ReactNode;
