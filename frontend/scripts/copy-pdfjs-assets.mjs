#!/usr/bin/env node
/**
 * 把 pdfjs-dist 的 UMD 产物拷进 public/，供运行时 <script> 加载。
 *
 * 背景（别删这段，删了下次有人一定会重蹈覆辙）：
 * pdfjs 若经 webpack 静态 import 进客户端 bundle，webpack 会顺着
 *   canvas/index.js -> ./lib/canvas -> ./lib/bindings -> ../build/Release/canvas.node
 * 一直解析到原生模块，构建直接报 `Module not found: Can't resolve '../build/Release/canvas.node'`，
 * 且 /textbooks 整页 500。试过 5 种 webpack 手段全部无效（alias / fallback /
 * externals / IgnorePlugin / aliasFields:'browser'），根因是 pdfjs 的
 * `require("canvas")` 被 isNodeJS 守卫但 webpack 仍做静态解析。
 *
 * 所以：走运行时 <script> + globalThis.pdfjsLib，让 webpack 完全看不见它。
 * 代价是这两个文件必须是 public/ 里的真实文件——本脚本就是保证它们存在且版本对齐的。
 *
 * 幂等：内容一致就跳过，不刷新 mtime（避免无谓的 docker build 缓存失效）。
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..');
const publicDir = join(frontendRoot, 'public');

/** 需要同步的文件：源（相对 pdfjs-dist 包根） -> 目标文件名 */
const ASSETS = [
  ['build/pdf.min.js', 'pdf.min.js'],
  ['build/pdf.worker.min.js', 'pdf.worker.min.js'],
];

function md5(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

let pdfjsRoot;
try {
  // pdfjs-dist 在 devDependencies，用 require.resolve 拿到包内真实路径，
  // 这样 pnpm 的符号链接布局（node_modules 未提升）也不影响。
  pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
} catch {
  console.error('[pdfjs] 找不到 pdfjs-dist，跳过资源同步（不阻断构建）');
  process.exit(0);
}

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

let copied = 0;
for (const [from, to] of ASSETS) {
  const src = join(pdfjsRoot, from);
  const dst = join(publicDir, to);

  if (!existsSync(src)) {
    console.error(`[pdfjs] 源文件不存在：${src}`);
    process.exit(1);
  }

  if (existsSync(dst) && md5(src) === md5(dst)) {
    console.log(`[pdfjs] 已是最新，跳过：${to} (${statSync(dst).size} B)`);
    continue;
  }

  copyFileSync(src, dst);
  copied += 1;
  console.log(`[pdfjs] 已写入：${to} (${statSync(dst).size} B)`);
}

console.log(`[pdfjs] 完成，本次复制 ${copied} 个文件`);
