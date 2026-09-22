/**
 * Vite setup for the panel capture harness.
 *
 * Plain object rather than `defineConfig` imported from `vite`: the plugin does
 * not depend on Vite directly (Vitest brings it into the store), so the config
 * must not need a bare `vite` specifier to resolve from this directory.
 *
 * `DSH_SRC` points at the Harness checkout whose theme tokens the panel's
 * stylesheet reads; it defaults to the checkout this plugin was developed
 * against.
 */

import { fileURLToPath } from 'node:url'

const DSH_SRC = process.env.DSH_SRC ?? '/Users/openSource/deepseek-harness'
const here = fileURLToPath(new URL('.', import.meta.url))

export default {
  root: here,
  resolve: {
    alias: {
      '@dsh-theme': `${DSH_SRC}/packages/client/ui-theme/src/styles`,
    },
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PANEL_PORT ?? 5199),
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url)), DSH_SRC] },
  },
}
