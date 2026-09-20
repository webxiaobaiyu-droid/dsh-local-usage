/**
 * How a reliability statement is read: which codes are worth naming, and how a
 * code the dictionary has never heard of is still written.
 *
 * The panel's rule is that the host ships figures and the dictionary ships
 * sentences. A reliability code is both at once — `RATE_LIMIT` is a figure in the
 * sense that it comes from the log, and a sentence in the sense that a reader
 * needs words for it — so the dictionary carries an entry per known code and this
 * module decides what happens to the rest. An unfamiliar code is written as
 * itself rather than folded into "other": a provider or a tool that invented a
 * new way to fail is exactly the thing a reader wants to see named.
 *
 * @module dsh-local-usage/client/reliability
 */
import type { UsageReliability, UsageSignalRow } from '../types.ts';
import type { UsageInsightsLocaleKey } from './locales.ts';
/** How many grouped codes a row names before it stops listing them. */
export declare const SIGNAL_LIMIT = 4;
/** Translate function as the locale service binds it. */
export type CauseTranslate = (key: UsageInsightsLocaleKey) => string;
/**
 * The words for one retry cause code.
 * @param code - the code the log carried.
 * @param t - panel translate function.
 * @returns the dictionary sentence, or the code itself when none is defined.
 */
export declare function causeText(code: string, t: CauseTranslate): string;
/**
 * The most frequent codes of one grouped list, largest first.
 * @param rows - the report's grouped codes, already ordered by the host.
 * @param limit - how many to name; the rest are counted by {@link signalOverflow}.
 * @returns the rows a row should name.
 */
export declare function topSignals(rows: readonly UsageSignalRow[], limit?: number): readonly UsageSignalRow[];
/**
 * How many codes a row did not name.
 * @param rows - the report's grouped codes.
 * @param limit - how many were named.
 * @returns the count left over, zero when everything was named.
 */
export declare function signalOverflow(rows: readonly UsageSignalRow[], limit?: number): number;
/**
 * Whether a window recorded any tool call at all.
 *
 * The error rate is stated against the calls it came from, so a window with no
 * calls states no rate rather than a division by zero.
 * @param reliability - the window's counters.
 * @returns whether the tool figures can be read as a share.
 */
export declare function hasToolCalls(reliability: UsageReliability): boolean;
/**
 * Whether a window attempted any compaction.
 * @param reliability - the window's counters.
 * @returns whether the compaction figures can be read as a share.
 */
export declare function hasCompactions(reliability: UsageReliability): boolean;
