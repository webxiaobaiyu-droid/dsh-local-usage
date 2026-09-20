/**
 * Pure folds turning durable session events into a priced usage report.
 *
 * The extractor mirrors the harness's own `tokenUsage` projection so its totals
 * agree with the persisted projection, then adds the two things that projection
 * deliberately omits: a calendar day and a money figure.
 *
 * Every sample is priced at its own instant, so a peak window boundary inside a
 * day prices the samples on each side correctly instead of averaging them.
 *
 * @module dsh-local-usage/aggregate
 */
import type { SessionEvent } from '@deepseek-ai/dsh-session/types';
import type { PeakWindow, PriceRate, PriceRule } from './pricing.ts';
import type { UsageInsightsReport, UsageTokens } from './types.ts';
/** Route label used when the log attributes a settlement to no `provider/model`. */
export declare const UNKNOWN_ROUTE = "unknown";
/** One billed turn's exact tokens, its instant, and the route it was billed on. */
export interface UsageSample {
    /** Turn settlement time in Unix epoch milliseconds. */
    readonly time: number;
    /** `provider/model`, or {@link UNKNOWN_ROUTE} when the log names none. */
    readonly route: string;
    /** Exact provider-reported buckets for the turn. */
    readonly tokens: UsageTokens;
}
/** One session's inputs to a report, plus what the window keeps of it. */
export interface SessionUsageInput {
    readonly sessionId: string;
    readonly title?: string;
    readonly cwd?: string;
    readonly createdAt: number;
    readonly samples: readonly UsageSample[];
    /** The window's share of this session's reliability counters; empty when it recorded none. */
    readonly reliability?: readonly ReliabilityDay[];
}
/** The rate card and peak schedule every sample is priced with. */
export interface PricingOptions {
    /** Currency the resulting cost figures are expressed in. */
    readonly currency: string;
    /** Configured rules in match order. */
    readonly rules: readonly PriceRule[];
    /** Rate used by a route no rule matches. */
    readonly fallback: PriceRate;
    /** Parsed peak windows in Beijing time. */
    readonly peakWindows: readonly PeakWindow[];
    /** When true, Saturday and Sunday are never peak. */
    readonly peakWeekdaysOnly: boolean;
    /** Factor applied to every rate inside a peak window. */
    readonly peakMultiplier: number;
}
/** Report-level facts the Host supplies around a fold. */
export interface ReportMeta {
    /** Host clock at assembly time. */
    readonly generatedAt: number;
    /** Session logs that could not be read. */
    readonly unreadableSessions: number;
    /** Whether the samples came from the Host's in-memory fold cache. */
    readonly cached: boolean;
}
/**
 * Local calendar day of one instant, as `YYYY-MM-DD`.
 * @param time - Unix epoch milliseconds.
 * @returns the host-local day key the calendar heatmap buckets on.
 */
export declare function localDayKey(time: number): string;
/**
 * Extract one sample per billed usage settlement.
 *
 * The fold mirrors the harness's own `tokenUsage` projection, which is what
 * makes its totals comparable with the persisted projection: a settlement
 * replaces the earlier sample of the same `(turn, step)` slot, `llm/retry-started`
 * closes that slot so a retried attempt is billed separately, and an identical
 * repeat changes nothing. Unlike the projection this fold also keeps each
 * settlement's own instant and billed route, which is what a calendar and a
 * per-model price need.
 *
 * The route comes from the settling assistant message's own `source`, falling
 * back to the newest `request/header` when a message carries none — an attempt
 * that committed no surface message has no source of its own.
 *
 * @param events - one session's durable log, in seq order.
 * @returns one sample per billable settlement, ascending by time.
 */
export declare function samplesOf(events: readonly SessionEvent[]): UsageSample[];
/**
 * One local day of reliability counters, as the per-session cache keeps them.
 *
 * Counters are folded per local day rather than per event so a window can be
 * re-cut from the cache the way samples are, without holding one object per tool
 * call: every window the panel asks for is bounded by local days, which is what
 * makes the day the honest resolution. Codes are kept as the producer issued
 * them — grouping by cause is the whole point, and inventing our own taxonomy
 * would put a translation between the reader and the provider's own vocabulary.
 */
export interface ReliabilityDay {
    /** Local calendar day as `YYYY-MM-DD`. */
    readonly day: string;
    retries: number;
    readonly retryCauses: Map<string, number>;
    toolCalls: number;
    toolErrors: number;
    readonly toolErrorCodes: Map<string, number>;
    compactions: number;
    compactionFailures: number;
}
/**
 * Fold one session's reliability counters, one bucket per local day.
 *
 * Every figure is a count of a durable event, never an inference from content:
 * `llm/retry` for an attempt the provider had to be asked for again,
 * `tool/result` carrying an `error` for a tool that failed,
 * `compaction/start` and a `compaction/end` carrying an `error` for context that
 * could not be compacted. An unknown failure shape still counts — it lands under
 * the code its producer issued, or under `UNKNOWN_CAUSE` when it issued none.
 *
 * @param events - one session's durable log, in seq order.
 * @returns one bucket per day that recorded a signal, ascending by day.
 */
export declare function reliabilityOf(events: readonly SessionEvent[]): ReliabilityDay[];
/** Code used for a signal whose producer issued none. */
export declare const UNKNOWN_CAUSE = "UNKNOWN";
/**
 * The days of a fold that one request's window keeps.
 *
 * A day is kept when its local midnight lies inside the window, which makes the
 * cut exact for the day-bounded windows the panel asks for and deliberately
 * coarse — never silently partial — for any other.
 *
 * @param days - one session's reliability fold.
 * @param from - inclusive lower bound, or `undefined` for unbounded.
 * @param to - inclusive upper bound, or `undefined` for unbounded.
 * @returns the days inside the window.
 */
export declare function reliabilityWithin(days: readonly ReliabilityDay[], from: number | undefined, to: number | undefined): ReliabilityDay[];
/**
 * Fold every session's samples into one priced report.
 * The window is whatever the caller asked for, and every dimension is folded
 * over that same window, so narrowing it to one day yields that day's totals,
 * that day's routes and that day's projects from the samples the Host already
 * holds. That is what makes a day drill-down a re-fold rather than a re-read.
 *
 * @param inputs - per-session inputs, in any order.
 * @param options - rate card and peak schedule.
 * @param meta - host-supplied report facts.
 * @returns the complete report, day rows ascending and ranking rows by cost.
 */
export declare function buildReport(inputs: readonly SessionUsageInput[], options: PricingOptions, meta: ReportMeta): UsageInsightsReport;
