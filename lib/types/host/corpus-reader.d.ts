/**
 * The corpus reader: every readable session log, folded once into the caches the
 * report and the call log share.
 *
 * Reading a log is the expensive half of this plugin; folding it is not. This
 * module owns the two read paths and the durable-cache lookup around them, while
 * the entry owns activation and the HTTP surface. The progress object is passed
 * in rather than owned here, because one read at a time is an invariant of the
 * service that queues these calls.
 *
 * @module dsh-local-usage/host/corpus-reader
 */
import type { Context } from '@deepseek-ai/cordis';
import type { FoldCache } from '../fold-cache.ts';
import type { ProgressTracker } from '../progress.ts';
import type { CachedSession, Contributor } from './session-fold.ts';
/** What one corpus read found: the folds, and what it cost to obtain them. */
export interface CorpusRead {
    /** Every session in the requested window, with the fold it contributed from. */
    readonly contributors: readonly Contributor[];
    /** Sessions whose logs could not be read. */
    readonly unreadable: number;
    /**
     * Sessions counted from the fold cache because the backend no longer lists
     * them — their logs are gone, but their spend is not.
     */
    readonly restoredIds: readonly string[];
    /** Whether every fold came from the caches rather than a fresh read. */
    readonly cached: boolean;
}
/**
 * Read every readable session log into folds, reusing whatever the caches answer.
 *
 * Two read paths, one fold. Sessions whose log carries no inherited prefix go
 * through the engine's batch projection, which hands the fold the events as the
 * reader already holds them. Everything else — a seeded log, whose prefix length
 * only the exact read reports, and every session when the mounted engine has no
 * batch projection at all — takes the per-session read.
 *
 * A session neither path has to touch is the point of the durable cache: when the
 * stored log still carries the revision a previous process folded, that fold is
 * reused and the log is never opened.
 *
 * Shared by the report and the call log. They ask different questions of the
 * same folds, so reading once here is what keeps a page of calls from paying for
 * a second pass over the corpus.
 *
 * @param ctx - host context carrying the session query engine.
 * @param cache - the in-memory fold cache, keyed by session id.
 * @param folds - the durable fold cache, keyed by session id and log revision.
 * @param progress - publishes how far this read has got.
 * @param request - the window the durable cache must still reach, and whether to discard it.
 * @returns the contributors, the unreadable count and whether the read was cached.
 */
export declare function readCorpus(ctx: Context, cache: Map<string, CachedSession>, folds: FoldCache, progress: ProgressTracker, request: {
    refresh: boolean;
    from: number | undefined;
    to: number | undefined;
}, generations: ReadonlyMap<string, number>): Promise<CorpusRead>;
