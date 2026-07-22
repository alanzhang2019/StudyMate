import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('[postcss.config] LOADED from', fileURLToPath(import.meta.url));

// We use a custom shim instead of `@tailwindcss/postcss` because the
// stock plugin's native Scanner (`@tailwindcss/oxide` 4.2.1) is broken
// on Windows in this environment: `Scanner.scan()` returns 0 files for
// every pattern (verified with absolute paths to existing files), so
// no utility classes are emitted and the page renders as block flow
// (no flex / mx-auto / min-h-screen etc.). The shim uses the per-content
// API (`Scanner.getCandidatesWithPositions`) on files it walks itself,
// then feeds the candidates to `@tailwindcss/node`'s `build()`.
//
// Next.js's PostCSS loader (`next/dist/build/webpack/config/blocks/css/plugins.js`)
// only accepts string plugin names (resolved via `require.resolve`)
// or `[name, options]` tuples — it cannot accept a plugin instance
// directly. So we install the shim as a real node module at
// `frontend/node_modules/tailwindcss-v4-shim/` and reference it by
// name here.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = {
  plugins: {
    'tailwindcss-v4-shim': {
      base: __dirname,
      sourceDirs: ['app', 'components', 'lib', 'src', 'pages'],
      extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mdx', 'html', 'htm'],
      verbose: true,
    },
  },
};

console.log('[postcss.config] exporting config with plugins:', Object.keys(config.plugins));

export default config;
