import type { NextConfig } from 'next';

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
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/.git/**',
          '**/.next/**',
          'D:/DumpStack.log.tmp',
          'D:/pagefile.sys',
          'D:/System Volume Information/**',
        ],
      };
    }

    if (!isServer) {
      // The client bundle should never need node:* builtins. Map them to
      // "false" so webpack treats them as empty modules; this silences
      // the UnhandledSchemeError for transitive imports from server-only
      // files. The actual server code path that uses these modules runs
      // in route handlers / server components, never in the browser.
      const nodeBuiltins = [
        'fs', 'fs/promises', 'path', 'crypto', 'buffer', 'util', 'stream',
        'os', 'url', 'querystring', 'events', 'async_hooks', 'dns', 'net',
        'http', 'https', 'child_process', 'cluster', 'dgram', 'perf_hooks',
        'process', 'timers', 'tls', 'tty', 'worker_threads', 'zlib',
        'stream/promises', 'stream/web', 'stream/consumers',
      ];
      const alias: Record<string, string> = {};
      for (const mod of nodeBuiltins) {
        alias[`node:${mod}`] = mod;
      }
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        ...alias,
      };
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
        ],
      },
    ];
  },
};

export default nextConfig;
