/**
 * Wire vocabulary of the Usage Insights Remote API: the exact JSON the
 * `usageInsights` namespace answers with. Every field is a plain JSON value, so
 * the Host fold, the generated codec, and the browser table all describe the
 * same shape.
 *
 * @module dsh-local-usage/types
 */

/** Disjoint provider-reported token buckets; `uncachedInputTokens` excludes cache traffic. */
export interface UsageTokens {
  /** Prompt tokens the provider billed at the full input rate. */
  readonly uncachedInputTokens: number
  /** Tokens the model produced. */
  readonly outputTokens: number
  /** Prompt tokens served from the provider's cache. */
  readonly cacheReadTokens: number
  /** Prompt tokens written into the provider's cache. */
  readonly cacheWriteTokens: number
}

/** Tokens plus the derived money figure for one bucket row. */
export interface UsageCosted extends UsageTokens {
  /** Price of these tokens in {@link UsageInsightsReport.currency}. */
  readonly cost: number
  /** Billed request settlements counted into this row. */
  readonly calls: number
}

/** One local calendar day of usage. */
export interface UsageDayRow extends UsageCosted {
  /** Local calendar day as `YYYY-MM-DD`. */
  readonly day: string
  /** Distinct sessions that recorded usage on this day. */
  readonly sessions: number
}

/** Usage attributed to one `provider/model` route. */
export interface UsageModelRow extends UsageCosted {
  /** `provider/model`, or `unknown` when the log carries no route attribution. */
  readonly route: string
  /** Whether a configured price rule matched this route. */
  readonly priced: boolean
}

/** Usage attributed to one session. */
export interface UsageSessionRow extends UsageCosted {
  /** Durable session id. */
  readonly sessionId: string
  /** Folded session title when one is known. */
  readonly title?: string
  /** Session working directory when the header carries one. */
  readonly cwd?: string
  /** Session creation time in Unix epoch milliseconds. */
  readonly createdAt: number
  /** Latest usage sample time in Unix epoch milliseconds, or `createdAt` when the session recorded none. */
  readonly updatedAt: number
}

/** One configured rate card, in currency units per one million tokens. */
export interface UsagePriceRow {
  /** Case-insensitive substring matched against `provider/model`; empty for the fallback card. */
  readonly match: string
  /** Cache-miss prompt tokens. */
  readonly input: number
  /** Cache-hit prompt tokens. */
  readonly cacheRead: number
  /** Cache-write prompt tokens. */
  readonly cacheWrite: number
  /** Generated tokens. */
  readonly output: number
}

/** One request to assemble a report. */
export interface UsageInsightsRequest {
  /** Discard the per-session fold cache and re-read every log. */
  refresh?: boolean
  /** Inclusive lower bound on a turn's settlement time, in Unix epoch milliseconds. */
  from?: number
  /** Inclusive upper bound on a turn's settlement time, in Unix epoch milliseconds. */
  to?: number
}

/** One complete aggregate over every readable session log. */
export interface UsageInsightsReport {
  /** Host clock at the moment this report was assembled. */
  readonly generatedAt: number
  /** Currency the cost figures are expressed in. */
  readonly currency: string
  /** Every scanned session rolled up. */
  readonly totals: UsageCosted & {
    /** Distinct sessions that contributed usage. */
    readonly sessions: number
  }
  /** Per-day rows in ascending day order, gaps omitted. */
  readonly days: readonly UsageDayRow[]
  /** Per-route rows ordered by descending cost. */
  readonly models: readonly UsageModelRow[]
  /** Per-session rows ordered by descending cost. */
  readonly sessions: readonly UsageSessionRow[]
  /** Session logs this call folded successfully. */
  readonly scannedSessions: number
  /** Session logs that could not be read; their usage is missing from every total. */
  readonly unreadableSessions: number
  /** Routes that matched no price rule and fell back to the default rate. */
  readonly unpricedRoutes: readonly string[]
  /** Token count priced at the fallback rate rather than a matched rule. */
  readonly unpricedTokens: number
  /** Whether this report was served from the Host's in-memory fold cache. */
  readonly cached: boolean
  /** Factor the configured rate card applies inside a peak window; `1` disables peak pricing. */
  readonly peakMultiplier: number
  /** Rate cards matched against the routed model, in match order. */
  readonly prices: readonly UsagePriceRow[]
  /** Rate applied to a route no card matches. */
  readonly fallbackPrice: UsagePriceRow
  /** Peak windows in Beijing time as `HH:MM-HH:MM`; empty means every hour is off-peak. */
  readonly peakWindows: readonly string[]
  /** Whether weekends are always billed off-peak. */
  readonly peakWeekdaysOnly: boolean
}
