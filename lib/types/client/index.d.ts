/**
 * Usage statistics, browser half: the sidebar's Usage entry, the full-width
 * panel it opens, and the stylesheet both need.
 *
 * A global panel rather than a settings page: a year of days needs the main
 * column's width, and what a profile has spent is not a preference.
 *
 * The panel talks to its own Host half over one Fetch route the plugin
 * registers, so this package installs without touching the product's Remote
 * assembly.
 *
 * @module dsh-local-usage/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import { type UsageInsightsLocaleKey } from './locales.ts';
export type { UsagePanelInjected, UsagePanelProps } from './UsagePanel.tsx';
export type { UsageInsightsLocaleKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Usage statistics panel copy. */
        'usage': UsageInsightsLocaleKey;
    }
}
/** Dictionary namespace owned by this panel. */
export declare const NS = "usage";
/** The id shared by the sidebar entry and the main panel it opens. */
export declare const PANEL_ID: MainPanelId;
/** Host route this panel reads its report from. */
export declare const REPORT_PATH = "/api/dsh-local-usage/report";
/** Services required by the sidebar and main-slot registrations. */
export declare const inject: string[];
/**
 * Contribute the Usage entry to the sidebar with the panel it opens.
 * @param ctx - Client plugin context.
 */
export declare function apply(ctx: ClientContext): void;
