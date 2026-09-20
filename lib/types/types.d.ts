/**
 * Wire vocabulary of the Usage Insights Remote API: the exact JSON the
 * `usageInsights` namespace answers with. Every field is a plain JSON value, so
 * the Host fold, the generated codec, and the browser table all describe the
 * same shape.
 *
 * @module dsh-local-usage/types
 */
/**
 * Project label used when a session header records no working directory.
 *
 * Not a stand-in for a missing value but a bucket of its own: those sessions
 * did spend, and dropping them would make the project rows fail to add up to
 * the total. It cannot collide with a real entry, because a working directory
 * is absolute and this is not a path.
 *
 * Declared here rather than beside the fold because both halves read it: the
 * browser half needs it to know that a row is a bucket rather than a
 * directory, and it cannot import the fold, which is a host-only module.
 */
export declare const UNKNOWN_PROJECT = "unknown";
/** Disjoint provider-reported token buckets; `uncachedInputTokens` excludes cache traffic. */
export interface UsageTokens {
    /** Prompt tokens the provider billed at the full input rate. */
    readonly uncachedInputTokens: number;
    /** Tokens the model produced. */
    readonly outputTokens: number;
    /** Prompt tokens served from the provider's cache. */
    readonly cacheReadTokens: number;
    /** Prompt tokens written into the provider's cache. */
    readonly cacheWriteTokens: number;
}
/** Tokens plus the derived money figure for one bucket row. */
export interface UsageCosted extends UsageTokens {
    /** Price of these tokens in {@link UsageInsightsReport.currency}. */
    readonly cost: number;
    /** Billed request settlements counted into this row. */
    readonly calls: number;
}
/** One local calendar day of usage. */
export interface UsageDayRow extends UsageCosted {
    /** Local calendar day as `YYYY-MM-DD`. */
    readonly day: string;
    /** Distinct sessions that recorded usage on this day. */
    readonly sessions: number;
}
/** Usage attributed to one `provider/model` route. */
export interface UsageModelRow extends UsageCosted {
    /** `provider/model`, or `unknown` when the log carries no route attribution. */
    readonly route: string;
    /** Whether a configured price rule matched this route. */
    readonly priced: boolean;
}
/**
 * Usage attributed to one working directory.
 *
 * A directory is what a reader means by "project": a session is created in one,
 * it is what the harness itself groups session logs by on disk, and it is the
 * only axis on which spend answers a question someone actually asks — which
 * project did this day's tokens go to.
 */
export interface UsageProjectRow extends UsageCosted {
    /**
     * Absolute working directory the contributing sessions were created in, or
     * `unknown` when their headers carried none.
     *
     * Only the path is sent: a name a reader recognises is the last segment of
     * it, and shortening a path is presentation rather than data.
     */
    readonly path: string;
    /** Distinct sessions that contributed usage from this directory. */
    readonly sessions: number;
}
/** Usage attributed to one session. */
export interface UsageSessionRow extends UsageCosted {
    /** Durable session id. */
    readonly sessionId: string;
    /** Folded session title when one is known. */
    readonly title?: string;
    /** Session working directory when the header carries one. */
    readonly cwd?: string;
    /** Session creation time in Unix epoch milliseconds. */
    readonly createdAt: number;
    /** Latest usage sample time in Unix epoch milliseconds, or `createdAt` when the session recorded none. */
    readonly updatedAt: number;
}
/** One configured rate card, in currency units per one million tokens. */
export interface UsagePriceRow {
    /** Case-insensitive substring matched against `provider/model`; empty for the fallback card. */
    readonly match: string;
    /** Cache-miss prompt tokens. */
    readonly input: number;
    /** Cache-hit prompt tokens. */
    readonly cacheRead: number;
    /** Cache-write prompt tokens. */
    readonly cacheWrite: number;
    /** Generated tokens. */
    readonly output: number;
}
/** One request to assemble a report. */
export interface UsageInsightsRequest {
    /** Discard the per-session fold cache and re-read every log. */
    refresh?: boolean;
    /** Inclusive lower bound on a turn's settlement time, in Unix epoch milliseconds. */
    from?: number;
    /** Inclusive upper bound on a turn's settlement time, in Unix epoch milliseconds. */
    to?: number;
}
/** One grouped reliability signal: a stable code and how often the window recorded it. */
export interface UsageSignalRow {
    /**
     * Machine code as the producer issued it — a provider-neutral `LlmFailure`
     * code such as `RATE_LIMIT`, or a tool error code such as `FS_STALE_VERSION`.
     * The panel supplies the sentence, so an unfamiliar code still reads as itself
     * rather than as "other".
     */
    readonly code: string;
    /** How many times the window recorded that code. */
    readonly count: number;
}
/**
 * How the window actually went, next to what it cost.
 *
 * Cost answers what was spent; this answers what it was spent fighting. Every
 * figure is folded from the same logs the samples come from, and each one is a
 * count of durable events rather than an inference: an attempt the provider had
 * to be asked for twice, a tool call whose result carried an error, a context
 * compaction that ended in an error and so left its context uncompacted.
 */
export interface UsageReliability {
    /** Provider attempts the window had to ask for again. */
    readonly retries: number;
    /** Retry causes, most frequent first. */
    readonly retryCauses: readonly UsageSignalRow[];
    /** Tool calls the window recorded, successful or not. */
    readonly toolCalls: number;
    /** Tool calls whose result carried an error. */
    readonly toolErrors: number;
    /** Tool error codes, most frequent first. */
    readonly toolErrorCodes: readonly UsageSignalRow[];
    /** Context compactions the window attempted. */
    readonly compactions: number;
    /** Those compactions that ended in an error; each one leaves its context uncompacted. */
    readonly compactionFailures: number;
}
/** A reliability fold over one window that recorded nothing at all. */
export declare const NO_RELIABILITY: UsageReliability;
/** Whether a window recorded anything worth stating. */
export declare function reliabilityIsEmpty(reliability: UsageReliability): boolean;
/** One complete aggregate over every readable session log. */
export interface UsageInsightsReport {
    /** Host clock at the moment this report was assembled. */
    readonly generatedAt: number;
    /** Currency the cost figures are expressed in. */
    readonly currency: string;
    /** Every scanned session rolled up. */
    readonly totals: UsageCosted & {
        /** Distinct sessions that contributed usage. */
        readonly sessions: number;
    };
    /** Per-day rows in ascending day order, gaps omitted. */
    readonly days: readonly UsageDayRow[];
    /** Per-route rows ordered by descending cost. */
    readonly models: readonly UsageModelRow[];
    /** Per-working-directory rows over the requested window, ordered by descending cost. */
    readonly projects: readonly UsageProjectRow[];
    /** Per-session rows ordered by descending cost. */
    readonly sessions: readonly UsageSessionRow[];
    /** Session logs this call folded successfully. */
    readonly scannedSessions: number;
    /** Session logs that could not be read; their usage is missing from every total. */
    readonly unreadableSessions: number;
    /** What the window spent its attempts on: retries, tool errors, failed compactions. */
    readonly reliability: UsageReliability;
    /** Routes that matched no price rule and fell back to the default rate. */
    readonly unpricedRoutes: readonly string[];
    /** Token count priced at the fallback rate rather than a matched rule. */
    readonly unpricedTokens: number;
    /** Whether this report was served from the Host's in-memory fold cache. */
    readonly cached: boolean;
    /** Factor the configured rate card applies inside a peak window; `1` disables peak pricing. */
    readonly peakMultiplier: number;
    /** Rate cards matched against the routed model, in match order. */
    readonly prices: readonly UsagePriceRow[];
    /** Rate applied to a route no card matches. */
    readonly fallbackPrice: UsagePriceRow;
    /** Peak windows in Beijing time as `HH:MM-HH:MM`; empty means every hour is off-peak. */
    readonly peakWindows: readonly string[];
    /** Whether weekends are always billed off-peak. */
    readonly peakWeekdaysOnly: boolean;
}
