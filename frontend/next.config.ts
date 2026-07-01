import type { NextConfig } from 'next';
import webpack from 'webpack';

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['mathml2omml', 'pptxgenjs'],
  typescript: { ignoreBuildErrors: true },
  // better-sqlite3 has a native .node binding; keep it external so Next.js
  // requires it at runtime (where we control the install location) and
  // explicitly include it in the standalone output tracing.
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/better-sqlite3/**/*'],
  },
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },
  // We pass `--webpack` to `next build` (see Dockerfile) instead of
  // letting Next.js 16 default to Turbopack. Turbopack's output tracing
  // currently drops dynamic client-only routes from `app/admin/**` when
  // combined with `output: 'standalone'`, which surfaces in the running
  // container as a 404 on `/admin/*` even though the page compiles.
  //
  // The empty `turbopack: {}` entry below is just here to silence
  // Next.js 16's "no turbopack config" warning, since the build is
  // explicitly forced to webpack via the CLI flag.
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/.git/**',
          '**/.next/**',
          '**/e2e/**',
          '**/tests/**',
          '**/eval/**',
          '**/scripts/**',
          '**/openclaw/**',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/playwright-report/**',
          '**/test-results/**',
          'D:/DumpStack.log.tmp',
          'D:/pagefile.sys',
          'D:/System Volume Information/**',
        ],
      };
    }

    // Test files (Vitest / Playwright specs) and the `node:` URI scheme
    // imports (e.g. `import fs from 'node:fs'` used by `pptxgenjs` for
    // Node-only code paths) cannot be processed by webpack 5 — it doesn't
    // know how to handle the `node:` scheme and throws
    // `UnhandledSchemeError: Reading from 'node:fs' is not handled by plugins`.
    //
    // We register a tiny custom plugin that hooks `beforeResolve` and
    // rewrites any `node:*` import to a relative path pointing at a
    // generated empty module. This runs *before* enhanced-resolve is
    // invoked, so the `node:` scheme is never seen by the resolver.
    //
    // We only do this for the **client** build. The server build legitimately
    // needs `node:fs` etc., so we leave those imports alone there.
    if (!isServer) {
      // Path to a virtual empty module we ship with the project. Any
      // `node:*` request will be rewritten to import this file, which
      // exports an empty object — so calls like `fs.readFile(...)` simply
      // become `undefined(...)` and fail silently (or, in the case of
      // pptxgenjs, never execute because the browser code path is taken).
      const emptyModulePath = require.resolve('./lib/empty-module.cjs');
      const NodeSchemeShim = class NodeSchemeShimPlugin {
        apply(compiler: webpack.Compiler): void {
          compiler.hooks.normalModuleFactory.tap(
            'NodeSchemeShimPlugin',
            (factory) => {
              factory.hooks.beforeResolve.tap(
                { name: 'NodeSchemeShimPlugin', stage: -1000 },
                (resolveData) => {
                  if (
                    typeof resolveData.request === 'string' &&
                    /^node:/.test(resolveData.request)
                  ) {
                    // Rewrite to a real on-disk module. enhanced-resolve
                    // never sees the `node:` scheme.
                    resolveData.request = emptyModulePath;
                  }
                  return undefined;
                },
              );
            },
          );
        }
      };

      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /\.(test|spec)\.(ts|tsx|mjs|js)$/,
        }),
      );
      config.plugins.push(new NodeSchemeShim());
    }

    // The "node:fs" / "node:path" style imports must be normalised before
    // webpack reaches the resolve-fallback stage, otherwise Next.js throws
    // `UnhandledSchemeError: Reading from 'node:fs' is not handled by plugins`.
    //
    // `pptxgenjs` (a client-only PowerPoint exporter imported from
    // `use-export-pptx.ts` which is a `'use client'` component) does things
    // like `import fs from 'node:fs'`. Its package.json declares
    // `browser: { "node:fs": false, "node:https": false }`, but webpack 5's
    // `browserField` does NOT know how to map the `node:` URI scheme. We have
    // to add explicit aliases for every node: builtin that may appear in any
    // transitive client dependency. Aliasing to `false` is enhanced-resolve's
    // signal to substitute the import with an empty module.
    //
    // We only do this for the **client** build. The server build legitimately
    // needs `node:fs` etc., so we leave those aliases alone there.
    if (!isServer) {
      const nodeBuiltins = [
        'fs', 'fs/promises', 'path', 'crypto', 'buffer', 'util', 'stream',
        'os', 'url', 'querystring', 'events', 'async_hooks', 'dns', 'net',
        'http', 'https', 'child_process', 'cluster', 'dgram', 'perf_hooks',
        'process', 'timers', 'tls', 'tty', 'worker_threads', 'zlib',
        'stream/promises', 'stream/web', 'stream/consumers',
      ];
      const nodeAlias: Record<string, false> = {};
      for (const mod of nodeBuiltins) {
        nodeAlias[`node:${mod}`] = false as const;
      }
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        ...nodeAlias,
      };

      // The client bundle should never need node:* builtins. After the
      // nodeAlias mapping above, the bare names are also safe to fallback
      // (in case a package imports `fs` directly without the `node:` prefix).
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
        buffer: false,
        util: false,
        stream: false,
        os: false,
        url: false,
        querystring: false,
        events: false,
        async_hooks: false,
        dns: false,
        net: false,
        http: false,
        https: false,
        child_process: false,
        zlib: false,
        perf_hooks: false,
        process: false,
      };
    }

    return config;
  },
  async headers() {
    const extraAncestors = process.env.ALLOWED_FRAME_ANCESTORS?.trim();
    const frameAncestors = extraAncestors ? `'self' ${extraAncestors}` : "'self'";

    return [
      {
        source: '/(.*)',
        headers: [
          // X-Frame-Options only supports SAMEORIGIN (no allow-list),
          // so we omit it when custom ancestors are configured.
          ...(!extraAncestors ? [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] : []),
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestors}`,
          },
          // Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy enable
          // SharedArrayBuffer in the browser. ONNX Runtime Web 1.27.x only
          // ships the *-threaded-* WASM variant, which REQUIRES SAB to
          // initialize — without these headers, DBNet inference throws
          // "ort-wasm-threaded.wasm was not compiled with multi-threading
          // support. It requires SharedArrayBuffer and Atomics" and we
          // fall back to the inaccurate edge-based detector.
          //
          // COEP `credentialless` is used instead of `require-corp` so that
          // cross-origin subresources (the ORT WASM from a CDN, the
          // OpenCV.js WASM, the model file, any future assets) still load
          // without each upstream having to set Cross-Origin-Resource-Policy.
          // Modern browsers (Chrome 96+, Firefox 119+, Safari 17+) support
          // `credentialless`; older browsers fall back to requiring CORP,
          // which is more restrictive but still functional for same-origin
          // assets like our /models/dbnet.onnx and the bundled OpenCV.js.
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
