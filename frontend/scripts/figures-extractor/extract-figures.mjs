/**
 * extract-figures.mjs
 *
 * 原型: 从 CSP 真题 PDF 提取矢量图形 (无向图、流程图、表格等)。
 *
 * 用法:
 *   node scripts/figures-extractor/extract-figures.mjs <pdf> <outDir> [prefix]
 *
 *   node scripts/figures-extractor/extract-figures.mjs \
 *     public/csp-j-2021-original.pdf \
 *     public/figures/csp-j-2021 \
 *     cspj2021
 *
 * 工作原理:
 *   这个 PDF 里的图 (a-b-c-d-e 五点图、矩形图、流程图等) 都是
 *   PDF 矢量绘制 (line / circle / text), 不是内嵌位图, 所以
 *   unpdf.extractImages() 返回 0。我们改用 pdfjs-dist 渲染整页
 *   到 @napi-rs/canvas, 然后 sharp 转 PNG, 整页输出。
 *
 *   下游的 link-figures-to-questions.mjs 脚本会根据题目的页码
 *   (来自 PDF 原文 "第N页") 把页面图和题目 id 关联, 注入到
 *   question.image 字段。
 *
 * 输出:
 *   <outDir>/<prefix>-p1.png  - 第 1 页整图
 *   <outDir>/<prefix>-p2.png  - 第 2 页整图
 *   ...
 *   <outDir>/pages.json       - 每页的尺寸 + 文件名 (供关联脚本读取)
 *
 * Why @napi-rs/canvas:
 *   原生 canvas 包在 Windows 上需要 node-gyp + Python + VS 工具链,
 *   经常装不起来。@napi-rs/canvas 是 Rust 实现的预编译 .node,
 *   跨平台直接 require, 项目里已经装好 (@napi-rs/canvas ^0.1.88)。
 */

import { promises as fs } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import napiCanvas from '@napi-rs/canvas';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { createCanvas, DOMMatrix, Path2D, CanvasRenderingContext2D } = napiCanvas;

// 在 require pdfjs 之前先把 DOMMatrix/Path2D 挂到 globalThis,
// 这样 pdfjs-dist 内部的 polyfill (checkDOMMatrix / checkPath2D)
// 会直接跳过 require("canvas"), 避免我们这个 canvas native binary
// 缺失导致整页渲染挂掉 (例如 2017J 第 3 页起就失败).
if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = DOMMatrix;
if (typeof globalThis.Path2D === 'undefined') globalThis.Path2D = Path2D;
if (typeof globalThis.CanvasRenderingContext2D === 'undefined') {
  globalThis.CanvasRenderingContext2D = CanvasRenderingContext2D;
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('用法: node extract-figures.mjs <pdf> <outDir> [prefix]');
    process.exit(1);
  }
  return {
    pdfPath: path.resolve(args[0]),
    outDir: path.resolve(args[1]),
    prefix: args[2] || path.basename(args[0], '.pdf'),
    // 渲染缩放, 2.0 = 144 DPI, 图清晰但文件不大
    scale: Number(process.env.FIGURE_SCALE || 2.0),
  };
}

// 动态 import pdfjs (legacy build, 支持 Node + CommonJS 风格的工厂)
async function loadPdfjs() {
  // pdfjs-dist 3.x legacy build 是 .js (UMD), 通过 createRequire 加载
  return require('pdfjs-dist/legacy/build/pdf.js');
}

/**
 * 把 pdfjs 的 PageProxy 渲染到 @napi-rs/canvas, 再用 sharp 转 PNG Buffer。
 * 之所以双层: pdfjs 只接受实现了特定接口的 canvas factory,
 * 我们写一个最薄的适配器。
 */
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset({ canvas }, width, height) {
    canvas.width = width;
    canvas.height = height;
  }
  destroy({ canvas: _canvas }) {
    // napi-rs canvas 由 GC 回收, 不需要显式 destroy
  }
}

async function renderPageToPng(page, scale, factory) {
  const viewport = page.getViewport({ scale });

  // 把 canvas 蒙皮成 pdfjs 期望的 IRenderableCanvas:
  //   { canvas: { width, height }, context }
  const { canvas, context } = factory.create(viewport.width, viewport.height);

  await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise;

  // napi-rs canvas 直接暴露 toBuffer, 但 pdfjs 内部是 .toDataURL('image/png')?
  // 我们直接调 sharp 来转 PNG, 跨过编码细节。
  const pngBuffer = await sharp(canvas.toBuffer('image/png')).png().toBuffer();
  return { pngBuffer, width: viewport.width, height: viewport.height };
}

async function main() {
  const { pdfPath, outDir, prefix, scale } = parseArgs();

  console.log(`[extract-figures] PDF : ${pdfPath}`);
  console.log(`[extract-figures] Out : ${outDir}`);
  console.log(`[extract-figures] Pref: ${prefix}`);
  console.log(`[extract-figures] Scale: ${scale}x`);

  const pdfjs = await loadPdfjs();
  // Node 环境必须设置 workerSrc=null (用主线程) + standardFontDataUrl
  // 不然 pdfjs 会去 fetch worker / 字体, 在 Node 脚本里会卡住。
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

  // 字体目录 (提供 LiberationSans 等替代字体, 避免 fetch 网络字体)
  const fontDir = path.dirname(
    require.resolve('pdfjs-dist/standard_fonts/FoxitSerif.pfb'),
  );
  const standardFontDataUrl = `file://${fontDir.replace(/\\/g, '/')}/`;

  const data = new Uint8Array(await fs.readFile(pdfPath));
  // 注意: canvasFactory 必须在 getDocument 阶段就传进去.
  // page.render 接受 canvasFactory 参数但会被忽略 (它从 transport 拿).
  // 内部所有子 canvas (annotationCanvas, inlineImage cache, patternCanvas)
  // 都走这个 factory, 走默认 NodeCanvasFactory 就会撞 canvas native binding 缺失.
  const factory = new NodeCanvasFactory();
  const loadingTask = pdfjs.getDocument({
    data,
    standardFontDataUrl,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    canvasFactory: factory,
  });
  const doc = await loadingTask.promise;
  console.log(`[extract-figures] 总页数: ${doc.numPages}`);

  await fs.mkdir(outDir, { recursive: true });

  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { pngBuffer, width, height } = await renderPageToPng(page, scale, factory);
    const filename = `${prefix}-p${p}.png`;
    const outPath = path.join(outDir, filename);
    await fs.writeFile(outPath, pngBuffer);
    pages.push({
      page: p,
      filename,
      publicPath: `/figures/${path.basename(outDir)}/${filename}`,
      width,
      height,
    });
    console.log(
      `  [p${p}] ${width}x${height} (${pngBuffer.length} bytes) -> ${filename}`,
    );
    page.cleanup();
  }

  const indexPath = path.join(outDir, 'pages.json');
  await fs.writeFile(indexPath, JSON.stringify(pages, null, 2));
  console.log(`\n[extract-figures] 共渲染 ${pages.length} 页`);
  console.log(`[extract-figures] 索引: ${indexPath}`);
}

main().catch((err) => {
  console.error('[extract-figures] 失败:', err);
  process.exit(1);
});
