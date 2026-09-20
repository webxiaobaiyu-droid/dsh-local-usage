#!/usr/bin/env node
/**
 * Link the DeepSeek Harness host packages this plugin is built against.
 *
 * The plugin's TypeScript and its tests import `@deepseek-ai/*` runtime and type
 * surfaces that the harness owns: the Cordis context, the session query engine,
 * the LLM stream helpers, and the browser halves' slot and primitive contracts.
 * Those packages are workspace packages of the harness, not published artifacts —
 * the rc releases on npm depend on `@deepseek-ai/dsh-type-meta`, which is not on
 * the registry — so a checkout of the harness is the only way to obtain them.
 *
 * This script points this repo's `node_modules/@deepseek-ai/*` at that checkout.
 * It is a development-only step: nothing it creates is committed, and the shipped
 * `lib/` artifact resolves the same packages from the host process at runtime.
 *
 * Usage:
 *   pnpm run link:host -- --src /path/to/deepseek-harness
 *   DSH_SRC=/path/to/deepseek-harness pnpm run link:host
 *
 * Re-run after every `pnpm install`, which prunes the links as extraneous.
 *
 * @module dsh-local-usage/scripts/link-host-packages
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Root of this repository, from this file's own location. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Every host package this plugin imports, keyed by the specifier's package name
 * and valued by the package's directory inside the harness checkout.
 *
 * Keep this list in step with the `@deepseek-ai/*` imports under `src/` and
 * `tests/`; a missing entry shows up as a resolution error from tsc or vitest.
 *
 * @type {Readonly<Record<string, string>>}
 */
const HOST_PACKAGES = {
  'cordis': 'vendor/cordis',
  'dsh-compaction': 'packages/compaction/compaction',
  'dsh-session': 'packages/core/session',
  'dsh-session-query': 'packages/session-query/session-query',
  'dsh-session-title': 'packages/session/session-title',
  'dsh-llm': 'packages/llm/llm',
  'dsh-llm-retry': 'packages/llm/llm-retry',
  'dsh-client-locale': 'packages/client/locale',
  'dsh-client-ui-primitives': 'packages/client/ui-primitives',
  'dsh-client-ui-slots': 'packages/client/ui-slots',
  'dsh-client-ui-layout': 'packages/client/ui-layout',
  'dsh-client-ui-sidebar': 'packages/client/ui-sidebar',
  'dsh-client-ui-renderer': 'packages/client/ui-renderer',
}

/**
 * Read `--src <path>` from argv, or `$DSH_SRC`.
 *
 * @returns {string | undefined} the requested checkout, as given.
 */
function sourceRootFromEnv() {
  const argv = process.argv.slice(2)
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--src') {
      const value = argv[index + 1]
      if (value === undefined) throw new Error('--src needs a path')
      return value
    }
  }
  return process.env.DSH_SRC
}

/**
 * Reject anything that is not a harness checkout before writing links into this
 * repo: two files that every harness checkout has and no other tree does.
 *
 * @param {string} root - candidate checkout.
 */
function assertCheckout(root) {
  const markers = ['tsconfig.base.json', join('packages', 'llm', 'llm', 'package.json')]
  const missing = markers.filter(marker => !existsSync(join(root, marker)))
  if (missing.length > 0) {
    throw new Error(`${root} is not a DeepSeek Harness checkout (missing ${missing.join(', ')})`)
  }
}

/**
 * The checkout's own version, printed so the type basis in use is stated.
 *
 * @param {string} root - verified checkout.
 * @returns {string} `name@version` of the checkout root manifest.
 */
function checkoutVersion(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  return `${manifest.name ?? 'unknown'}@${manifest.version ?? 'unknown'}`
}

function main() {
  const requested = sourceRootFromEnv()
  if (requested === undefined) {
    throw new Error(
      'no harness checkout given: pass `--src /path/to/deepseek-harness` or set $DSH_SRC',
    )
  }
  const root = resolve(requested)
  assertCheckout(root)

  const absent = Object.entries(HOST_PACKAGES)
    .filter(([, relative]) => !existsSync(join(root, relative, 'package.json')))
    .map(([name, relative]) => `${name} (${relative})`)
  if (absent.length > 0) {
    throw new Error(`checkout is missing expected packages: ${absent.join(', ')}`)
  }

  const scope = join(REPO_ROOT, 'node_modules', '@deepseek-ai')
  mkdirSync(scope, { recursive: true })

  for (const [name, relative] of Object.entries(HOST_PACKAGES)) {
    const target = join(root, relative)
    const link = join(scope, name)
    // Replace whatever is there: a stale link, a pruned directory, or a partial install.
    if (lstatSync(link, { throwIfNoEntry: false }) !== undefined) {
      rmSync(link, { recursive: true, force: true })
    }
    symlinkSync(target, link, 'dir')
    console.log(`linked @deepseek-ai/${name} -> ${target}`)
  }

  console.log(
    `\n${Object.keys(HOST_PACKAGES).length} host packages linked from ${checkoutVersion(root)}`
      + `\n${root}\n\nRe-run after any \`pnpm install\`; that prunes these links.`,
  )
}

try {
  main()
} catch (error) {
  console.error(`link-host-packages: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
