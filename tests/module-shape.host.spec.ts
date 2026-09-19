/**
 * The shape each half must expose to be mountable.
 *
 * A plugin module is mounted by its *default* export when it has one, and a
 * default that is the bare `apply` function arrives without the module's `name`
 * and `inject`: the fiber then activates with an empty inject list and the first
 * service read throws `cannot get property "…" without inject`, which leaves the
 * entry unactivated and the panel without its route. Both halves therefore ship
 * named exports only.
 *
 * @module dsh-local-usage/tests/module-shape
 */

import { describe, expect, it } from 'vitest'
import * as client from '../src/client/index.ts'
import * as host from '../src/index.ts'

describe('host half module shape', () => {
  it('exposes no default export', () => {
    expect(Object.keys(host)).not.toContain('default')
  })

  it('names the plugin and the services it cannot work without', () => {
    expect(host.name).toBe('dsh-local-usage')
    expect(host.inject).toEqual(['connection', 'sessionQuery'])
  })

  it('carries apply as a named export', () => {
    expect(typeof host.apply).toBe('function')
  })
})

describe('browser half module shape', () => {
  it('exposes no default export', () => {
    expect(Object.keys(client)).not.toContain('default')
  })

  it('declares the services it cannot work without', () => {
    // The browser half carries no `name`: the module-loader factory already
    // registers it under this package's id.
    expect(client.inject).toEqual(['slots', 'locale'])
  })

  it('carries apply as a named export', () => {
    expect(typeof client.apply).toBe('function')
  })
})
