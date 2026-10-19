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
/** Exact route the browser half writes the per-route rate table to. */
export declare const PRICING_PATH = "/api/dsh-local-usage/pricing";
/**
 * Exact route the browser half polls while a report is being assembled.
 *
 * A separate route rather than a streamed report: the report is one JSON
 * document the browser parses whole, and a carrier that buffered a streamed body
 * would lose exactly the progress it was streaming.
 */
export declare const PROGRESS_PATH = "/api/dsh-local-usage/progress";
/** Plugin name the loader row addresses. */
export declare const name = "dsh-local-usage";
/** Services this plugin cannot work without: the carrier's route registry and the session reads. */
export declare const inject: string[];
/** One set of prices, in currency units per one million tokens. */
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
/**
 * One model's prices, with the prices it charges inside a peak window.
 *
 * The four numbers are the price outside a peak window — and the only price of a
 * model that does not state a `peak` block, which is how a flat-priced model is
 * written. Costing the same all day means leaving `peak` out, not setting a
 * multiplier to one.
 */
export interface UsageInsightsModelConfig extends UsageInsightsPriceConfig {
    /** Case-insensitive substring matched against `provider/model`; the first match wins. */
    match: string;
    /** Prices inside a configured peak window; absent means the model is flat-priced. */
    peak?: UsageInsightsPriceConfig;
}
/** The card that prices a route no model claims; it may price peak separately too. */
export type UsageInsightsFallbackConfig = UsageInsightsPriceConfig & {
    /** Prices inside a configured peak window; absent means the fallback is flat-priced. */
    readonly peak?: UsageInsightsPriceConfig;
};
/** Plugin configuration; every field has a default, so the plugin mounts bare. */
export interface UsageInsightsConfig {
    /** Currency every cost figure is expressed in; the plugin performs no conversion. */
    currency: string;
    /** Configured rate cards, matched in order. */
    models: UsageInsightsModelConfig[];
    /** Card used by a route no model matches. */
    fallback: UsageInsightsFallbackConfig;
    /** Peak windows as `HH:MM-HH:MM` in Beijing time. */
    peakWindows: string[];
    /** When true, Saturday and Sunday are never peak. */
    peakWeekdaysOnly: boolean;
    /**
     * Whether to fold the corpus in the background once the process is up.
     *
     * The first read after an install decodes every session log there is, and the
     * reader pays for it while looking at a loading frame. Doing that read at
     * activation moves the cost to a moment nobody is waiting on, so the first
     * request the panel makes is a re-price over folds already in hand. A
     * deployment with a very large corpus, or one that would rather read nothing
     * until it is asked, can turn it off and pay the read on first open instead.
     */
    warmup: boolean;
    /** How long after activation the background fold starts, in milliseconds. */
    warmupDelayMs: number;
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
 *
 * Deliberately a named export with no default: the Loader takes a module's
 * default export when it has one, and a default that is the bare `apply`
 * function is a plugin *without* this module's `name` and `inject` — the fiber
 * then activates with an empty inject list and the first service read throws
 * "cannot get property … without inject".
 *
 * @param ctx - Host context carrying the carrier and the session query engine.
 * @param config - plugin configuration; omitted fields keep their defaults.
 */
export declare function apply(ctx: Context, config?: UsageInsightsConfig): void;
