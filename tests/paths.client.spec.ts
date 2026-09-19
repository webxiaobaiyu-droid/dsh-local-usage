/**
 * Shortening a working directory for a reader.
 *
 * A working directory is long and mostly boilerplate, so the project table
 * shows its last segment and keeps the full path in a title attribute. These
 * checks pin the shortening rules, including the one row that is not a path at
 * all and therefore has no name to show.
 *
 * @module dsh-local-usage/tests/paths
 */

import { describe, expect, it } from 'vitest'
import { projectName } from '../src/client/paths.ts'
import { UNKNOWN_PROJECT } from '../src/types.ts'

describe('projectName', () => {
  it('takes the last segment of a working directory', () => {
    expect(projectName('/Users/someone/work/clients/acme-api')).toBe('acme-api')
  })

  it('reads a Windows directory the same way', () => {
    expect(projectName('C:\\Users\\someone\\work\\acme-api')).toBe('acme-api')
  })

  it('ignores a trailing separator', () => {
    expect(projectName('/Users/someone/work/acme-api/')).toBe('acme-api')
  })

  it('reads a single-segment path as its own name', () => {
    expect(projectName('acme-api')).toBe('acme-api')
  })

  it('has no name for the bucket of sessions that recorded no directory', () => {
    // The caller renders a dictionary label instead; a bucket is not a path, so
    // inventing a segment for it would put a fabricated project on the page.
    expect(projectName(UNKNOWN_PROJECT)).toBeUndefined()
  })

  it('falls back to the path itself when there is no segment to take', () => {
    expect(projectName('/')).toBe('/')
  })
})
