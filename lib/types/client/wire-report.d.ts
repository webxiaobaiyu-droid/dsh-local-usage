/**
 * Normalize a report as it arrives from the Host.
 *
 * The browser bundle is served from disk and swapped live, while the Host half
 * only changes on a restart. That window is real: a freshly built Client can
 * read a report an older Host produced, and a missing field must then cost the
 * reader a subsection — never the whole panel, because a render-time throw
 * blanks the main column.
 *
 * Defaults live here rather than at each call site so the components can stay
 * total over the declared report shape.
 *
 * @module dsh-local-usage/client/wire-report
 */
import type { UsageInsightsReport } from '../types.ts';
/** Fields this panel can render without, either because they are optional in
 * meaning or because a Host of another build may not send them yet. */
export type WireReport = Pick<UsageInsightsReport, 'generatedAt' | 'currency' | 'totals'> & Partial<UsageInsightsReport>;
/**
 * Fill every field the panel reads with a safe default.
 * @param value - the report as received.
 * @returns a report whose declared fields are all present.
 */
export declare function normalizeReport(value: WireReport): UsageInsightsReport;
