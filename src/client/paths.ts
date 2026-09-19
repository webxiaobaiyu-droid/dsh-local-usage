/**
 * Turning a working directory into something a reader recognises.
 *
 * Pure and string-in only, so the shortening rules are testable without a
 * browser. Nothing here is localized: a path is a path in every language, and
 * the only translatable part — the label for a row that has no path at all — is
 * the caller's dictionary lookup, not this module's business.
 *
 * @module dsh-local-usage/client/paths
 */

import { UNKNOWN_PROJECT } from '../types.ts'

/** Both separators, because the report describes directories on either kind of host. */
const SEPARATORS = /[/\\]+/

/**
 * Last segment of an absolute working directory.
 *
 * A working directory is long and mostly boilerplate — on a real profile it
 * reads `/Users/someone/work/clients/acme-api` — and the segment that
 * distinguishes it is the last one. The full path stays available for a title
 * attribute, so nothing is lost, only deferred.
 * @param path - the directory as the report stated it.
 * @returns the last segment, or `undefined` when the row is the no-directory bucket.
 */
export function projectName(path: string): string | undefined {
  // The bucket is not a path, so it has no segment to take; the caller renders
  // a dictionary label instead of a name.
  if (path === UNKNOWN_PROJECT) return undefined
  const segments = path.split(SEPARATORS).filter(segment => segment.length > 0)
  // Root, or a path made of nothing but separators: there is no last segment,
  // and the path itself is the most honest thing to show.
  return segments.at(-1) ?? path
}
