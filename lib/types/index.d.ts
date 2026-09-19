/**
 * Usage statistics Host half: the session fold and the HTTP route that serves it.
 *
 * This plugin is self-contained on purpose. A Typert Remote namespace would be
 * tidier, but it only reaches the browser when the product's own Remote
 * assembly mounts it, and that list lives inside the harness repository — which
 * would make this package impossible to install on its own. A registered Fetch
 * route costs a little plumbing and buys a plugin any deployment can load by
 * path.
 *
 * Reading a log is the expensive half and folding it is not, so the cache keeps
 * each session's extracted samples rather than a finished report, and every
 * request re-prices them against the current configuration.
 *
 * @module dsh-local-usage
 */
import type { Context } from '@deepseek-ai/cordis';
export type * from './types.ts';
/** Exact route the browser half calls; it sits behind the carrier's trust fence. */
export declare const REPORT_PATH = "/api/dsh-local-usage/report";
/** Plugin name the loader row addresses. */
export declare const name = "dsh-local-usage";
/** Services this plugin cannot work without: the carrier's route registry and the session reads. */
export declare const inject: string[];
/** Rate card for one route family, in currency units per one million tokens. */
export interface UsageInsightsPriceConfig {
    /** Cache-miss prompt tokens. */
    input: number;
    /** Cache-hit prompt tokens. */
    cacheRead: number;
    /** Cache-write prompt tokens; providers without a separate write charge repeat `input`. */
    cacheWrite: number;
    /** Generated tokens. */
    output: number;
}
/** One configured rate card and the route substring it claims. */
export interface UsageInsightsModelConfig extends UsageInsightsPriceConfig {
    /** Case-insensitive substring matched against `provider/model`; the first match wins. */
    match: string;
}
/** Plugin configuration; every field has a default, so the plugin mounts bare. */
export interface UsageInsightsConfig {
    /** Currency every cost figure is expressed in; the plugin performs no conversion. */
    currency: string;
    /** Configured rate cards, matched in order. */
    models: UsageInsightsModelConfig[];
    /** Rate used by a route no card matches. */
    fallback: UsageInsightsPriceConfig;
    /** Peak windows as `HH:MM-HH:MM` in Beijing time. */
    peakWindows: string[];
    /** When true, Saturday and Sunday are never peak. */
    peakWeekdaysOnly: boolean;
    /** Factor applied to every rate inside a peak window. */
    peakMultiplier: number;
}
/**
 * Shipped defaults: DeepSeek's published off-peak CNY prices. A route served
 * through an aggregator or a reseller has to be priced by the operator, and the
 * panel names every route that fell back to the default rather than implying a
 * figure it cannot support.
 */
export declare const DEFAULT_CONFIG: UsageInsightsConfig;
/**
 * Register the report route.
 * @param ctx - Host context carrying the carrier and the session query engine.
 * @param config - plugin configuration; omitted fields keep their defaults.
 */
export declare function apply(ctx: Context, config?: UsageInsightsConfig): void;
export default apply;
