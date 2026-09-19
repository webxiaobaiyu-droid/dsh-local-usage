/**
 * Build for both halves of the plugin.
 *
 * The Harness module system fetches plugin code as a self-registering factory
 * instead of loading it through the page's bundler, so the browser half has to
 * be wrapped in that contract by hand — the product's own preset that does this
 * lives inside the harness repository and is not published. Everything the page
 * already provides stays an external `require` resolved from the loader's module
 * table; only this plugin's own code is bundled.
 *
 * `@deepseek-ai/*` runtime imports must stay external: inlining one would ship a
 * second copy of a service the rest of the page shares.
 */
import { defineConfig } from 'tsdown'

/** Package name; also the id the browser factory registers under. */
const ID = 'dsh-local-usage'

/**
 * Modules the loader's table already answers. A different specifier here would
 * be a guaranteed runtime throw, and React must never be bundled twice.
 */
const LOADER_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

export default defineConfig([
  {
    // Host half: loaded by the Cordis loader inside the dsh process.
    name: ID,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    // Types ship from lib/types, emitted by the tsc declaration passes in
    // `build`, so both halves have one declaration pipeline.
    dts: false,
    clean: false,
    // Peer dependencies stay imports: the host's own instances are the ones
    // that carry service identity.
    external: [/^@deepseek-ai\//],
  },
  {
    // Browser half: one file, self-registering, resolved through the table.
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    // Types ship from lib/types, emitted by the tsc declaration passes in
    // `build`; dts here would wrap the banner/footer below into the declaration
    // file and break parsing, which is why the harness's client preset disables
    // it too.
    dts: false,
    clean: false,
    sourcemap: true,
    external: LOADER_MODULES,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
])
