import type { NextConfig } from 'next';
import path from 'path';
import webpack from 'webpack';

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['mathml2omml', 'pptxgenjs'],
  // Pin the workspace root to the frontend directory. The repo has a
  // stray `package-lock.json` at the parent (`D:\AItrade\ai-math-mistake-machine`)
  // which makes Next.js infer the parent as the workspace root; that, in
  // turn, makes Tailwind v4 (which uses `outputFileTracingRoot` to scope
  // its source scan) look for `app/` / `components/` in the parent —
  // where they don't exist — and emit a CSS file with zero utility
  // classes. Symptoms: every Tailwind class is silently dropped, layouts
  // collapse, and Chinese text wraps to one character per line because
  // `flex` / `mx-auto` / `max-w-6xl` / `min-h-screen` etc. don't apply.
  outputFileTracingRoot: path.join(__dirname),
  typescript: { ignoreBuildErrors: true },
  // better-sqlite3 has a native .node binding; keep it external so Next.js
  // requires it at runtime (where we control the install location) and
  // explicitly include it in the standalone output tracing.
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/better-sqlite3/**/*'],
  },
  experimental: {
    // 1 GB max import ZIP (see MAX_UPLOAD_MB in
    // /api/admin/classroom/import/route.ts). We bump to 2 GB
    // to leave headroom for multipart boundary bytes +
    // base64-vs-binary overhead so the Next.js internal proxy
    // buffer does not silently truncate valid uploads at
    // exactly 1 GB.
    proxyClientMaxBodySize: '2gb',
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
      // HTML 文档强制「用前必验证」——修复「浏览器返回后整页无样式」。
      //
      // 根因：ISR / 静态页面（export const force-static + revalidate）由
      // Next.js 自动附加 `Cache-Control: s-maxage=3600,
      // stale-while-revalidate=...`。s-maxage 只对 CDN 等共享缓存生效，
      // 浏览器侧既没有 max-age 也没有 Last-Modified，旧 HTML 于是被
      // 浏览器磁盘缓存长期复用（stale-while-revalidate 语义下甚至直接
      // 展示缓存副本、后台才验证）。而每次部署都是「新镜像 +
      // force-recreate」，/_next/static 下全部 chunk 文件名随新构建
      // 更换、旧文件在新容器里不存在——命中旧 HTML 的返回导航
      // （history.back / 链接跳转后返回）会拿到一串 404 的 CSS/JS，
      // 表现为整页无样式，必须手动刷新才能恢复。
      //
      // max-age=0, must-revalidate：浏览器可保留本地副本，但每次使用前
      // 必须带 If-None-Match 回源验证。同一构建走 304（便宜），部署后
      // ETag 变化直接返回 200 + 新 HTML，旧 HTML 再无静默展示窗口。
      //
      // 排除：
      //   /_next/*            —— immutable 静态资源，保留原生长缓存
      //   /api/*              —— 可能含用户私有数据，不套文档缓存策略
      //   RSC / prefetch 请求 —— App Router 自己的缓存协议（router cache
      //                          + staleTimes），不依赖 HTTP 缓存头
      {
        source: '/:path((?!_next|api).*)',
        missing: [
          { type: 'header', key: 'rsc' },
          { type: 'header', key: 'next-router-prefetch' },
          { type: 'header', key: 'next-router-segment-prefetch' },
        ],
        headers: [
          { key: 'Cache-Control', value: 'max-age=0, must-revalidate' },
        ],
      },
      // 课程资源永久不缓存。
      //
      // 原因: 运营会通过 1Panel 文件管理器或 docker cp 直接替换
      // /home/ubuntu/studymate/frontend/public/ 下的 PDF / 图片, 但
      // 浏览器对 PDF 的本地缓存非常激进 (新窗口打开的 PDF 走独立
      // context, Ctrl+Shift+R 强刷也不清). 加上 `Cache-Control:
      // no-cache, must-revalidate` 之后, 浏览器每次都带
      // If-Modified-Since / If-None-Match 头验证, 服务器
      // Last-Modified 变了就回 200 + 新内容.
      //
      // `no-cache` 而不是 `no-store` 的好处: 浏览器保留本地副本,
      // 没改时走 304 Not Modified 不重新下载整个 1.8 MB PDF.
      // 每次访问的开销 = 1 个 HEAD 验证, 可忽略.
      {
        source: '/csp-j-2024-original.pdf',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        source: '/csp-j-2025-original.pdf',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        source: '/csp-j-2026-original.pdf',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        source: '/csp-difficulty-map.png',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        source: '/csp-difficulty-map-v2.png',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
      {
        source: '/:path(csp-*.{pdf,png,jpg,jpeg,svg,webp})',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
        ],
      },
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
      // 学生作品 HTML 单独定制策略 —— 必须放在 `/(.*)` 之后。
      //
      // Next 对 headers() 是按匹配顺序写同名响应头的，后写的才生效；
      // 放在前面的话会被上面的通用策略（frame-ancestors / COOP / COEP）覆盖掉，
      // 这正是之前「在路由里写 sandbox 却完全没生效」的原因。
      //
      // 内容取舍：
      //   1. 不加 sandbox —— CSP sandbox 会让文档落到 opaque origin，
      //      getUserMedia / localStorage / IndexedDB 全部失效，学生作品里
      //      的麦克风、跟读打分、进度存档会一起坏掉。作品由老师审核通过后
      //      才对外可见，风险可控（真正要隔离应改走独立域名，见部署备注）。
      //   2. Permissions-Policy 显式放行麦克风/摄像头等能力。
      //   3. COOP / COEP 放开：作品是独立打开的页面，不需要 SharedArrayBuffer，
      //      留着 credentialless 反而会干扰外部资源加载。
      {
        source: '/api/camp/works/:id/html',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:",
              "script-src 'unsafe-inline' 'unsafe-eval' data: blob: https: http:",
              "style-src 'unsafe-inline' data: blob: https: http:",
              "img-src * data: blob:",
              "media-src * data: blob:",
              "font-src * data:",
              "connect-src * data: blob:",
              "frame-src *",
              "frame-ancestors 'self'",
            ].join('; '),
          },
          {
            key: 'Permissions-Policy',
            value:
              'microphone=*, camera=*, display-capture=*, geolocation=*, midi=*, clipboard-read=*, clipboard-write=*, speaker-selection=*',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
