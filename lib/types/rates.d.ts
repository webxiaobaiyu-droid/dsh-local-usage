/**
 * Durable price edits, kept per model.
 *
 * The cards a profile is configured with match a model's name as a substring of
 * the route: convenient, and quietly wrong the moment a route they were never
 * written for happens to contain that name. An edit is the correction — one
 * model, two complete sets of prices, and a switch saying whether the peak set
 * applies — and this module owns where it lives.
 *
 * Edits are keyed by model rather than by route, which is what makes one edit
 * reach every vendor route of the same model. Consumption is not stored here and
 * is not affected by an edit: the fold still reports each route separately.
 *
 * It is a small JSON file under the harness home rather than a storage form: this
 * plugin mounts bare on deployments that have no storage backend, and a price
 * table the reader typed is worth persisting without making the whole panel
 * depend on a service that may not be there. The file is written through a
 * temporary sibling and renamed, so a crash mid-write cannot leave a truncated
 * table behind.
 *
 * @module dsh-local-usage/rates
 */
import type { UsageModelEdit, UsagePricingUpdate, UsageRate } from './types.ts';
/**
 * The harness home the price file is written under.
 * @param env - process environment, read for `DSH_HOME`.
 * @param home - the user's home directory when `DSH_HOME` is unset.
 * @returns the absolute harness home.
 */
export declare function resolveDshHome(env?: NodeJS.ProcessEnv, home?: string): string;
/**
 * Where one harness home keeps this plugin's price file.
 * @param dshHome - absolute harness home.
 * @returns the absolute path of the file.
 */
export declare function pricingFilePath(dshHome: string): string;
/**
 * Read one set of prices out of an untrusted value.
 * @param value - a candidate bucket map.
 * @returns the prices, or `undefined` when any bucket is not a sane non-negative price.
 */
export declare function readRate(value: unknown): UsageRate | undefined;
/**
 * Read one model edit out of an untrusted value.
 * @param value - a candidate edit.
 * @returns the edit, or `undefined` when either set of prices is not sane.
 */
export declare function readModelEdit(value: unknown): UsageModelEdit | undefined;
/** The persisted price edits, kept in memory and mirrored to disk. */
export interface RateStore {
    /** Every edit in effect, keyed by model `match`. */
    read(): ReadonlyMap<string, UsageModelEdit>;
    /**
     * Apply one validated update and persist the result.
     * @param update - models to write; `null` clears that model's edit.
     * @returns the table in effect after the write.
     */
    write(update: UsagePricingUpdate): Promise<Record<string, UsageModelEdit>>;
}
/**
 * Create the store for one file, hydrating it from disk immediately.
 *
 * Hydration is synchronous on purpose: the report path is the hot one, this runs
 * once at activation, and the document is a handful of lines. A read that fails
 * is not an error the plugin can act on — an absent or unreadable table is simply
 * no edits, and the next write replaces the file.
 *
 * @param path - absolute path of the price file.
 * @returns the store.
 */
export declare function createRateStore(path: string): RateStore;
