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
 * ranges re-prices instead of re-reading logs — and so does opening a day, which
 * is why a calendar cell can lead to a full page rather than a hover card.
 *
 * The panel owns no copy and no formatting of its own: sentences come from the
 * `usage` dictionary and figures from `format.ts`, both resolved against the
 * active locale. A locale switch therefore costs one re-render and re-reads
 * nothing, because the Host's report is language-neutral — it carries counts
 * and a day key, never a rendered string.
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
    /**
     * Active locale id, read at call time.
     *
     * The dictionary seat covers copy, but not figures: number, currency and date
     * formatting are properties of the reader's language and have no key to hang
     * off. The renderer re-derives the dictionary function from the locale
     * revision, so a locale switch already re-renders this panel — reading the id
     * during render is enough, and needs no subscription of its own.
     */
    locale: () => string;
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
export declare function UsagePanel({ panelId, locale, report, t, usePanelInfo }: UsagePanelProps): ReactNode;
