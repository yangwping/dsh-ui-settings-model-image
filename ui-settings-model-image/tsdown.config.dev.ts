/**
 * Standalone dev build for this out-of-repo plugin package. Replicates the
 * repo preset's two artifact contracts (packages/client/tsdown.client.ts)
 * without its repository-layout workspace manifest:
 * - lib/index.js   — the Node loader entry (ESM, from the tsc emit);
 * - lib/client.js  — the browser closure-factory bundle the module loader
 *                    registers via window.__ModuleLoader__.load({id, factory}),
 *                    with the platform module table as its only externals.
 */

const ID = '@deepseek-ai/dsh-client-ui-settings-model-image'

/** The shell's seed-table specifiers (packages/client/web/src/platform.ts). */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

const escape = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NODE_ENV = process.env.NODE_ENV ?? 'production'

export default [
  {
    name: ID,
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    tsconfig: './tsconfig.build.json',
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    tsconfig: './tsconfig.build.json',
    deps: {
      neverBundle: PLATFORM_MODULES.map(name => new RegExp(`^${escape(name)}(/|$)`)),
    },
    inputOptions: {
      resolve: {
        conditionNames: [
          NODE_ENV === 'development' ? 'development' : 'production',
          'browser', 'import', 'module', 'default',
        ],
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
      'import.meta.env.MODE': JSON.stringify(NODE_ENV),
      'import.meta.env': JSON.stringify({ MODE: NODE_ENV }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
