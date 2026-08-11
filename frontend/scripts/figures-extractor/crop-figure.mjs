/**
 * crop-figure.mjs
 *
 * 原型: 从整页 PDF 图里裁出单个题目图, 按 (left, top, right, bottom) 矩形
 * (单位: 像素, 整页图的左上角为原点)。
 *
 * 用法:
 *   node scripts/figures-extractor/crop-figure.mjs \
 *     <input.png> <output.png> <left> <top> <right> <bottom> [--pad=10]
 *
 * 示例: 从 cspj2021-p4.png 裁出第 14 题的菱形图:
 *   node scripts/figures-extractor/crop-figure.mjs \
 *     public/figures/csp-j-2021/cspj2021-p4.png \
 *     public/figures/csp-j-2021/cspj2021-q14-figure.png \
 *     540 300 780 540
 *
 *   (整页 1190x1684, 14 题图大致在 (540,300)-(780,540))
 *
 * 下游用法:
 *   把裁出来的图放回 pages.json 关联的题目, 然后 build-*.mjs 注入
 *   question.image 字段。
 *
 * Why this is a separate script:
 *   整页图用来核对 PDF 全文是 OK 的, 单题图用来在题目里显示。
 *   分两步: 先 100% 还原整页 (便于核对), 再按需裁出单题。
 *   坐标可以用任何看图工具测量 (Windows 照片 / Photoshop / VSCode 插件)。
 */

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 6) {
    console.error(
      '用法: node crop-figure.mjs <input.png> <output.png> <left> <top> <right> <bottom> [--pad=10]',
    );
    process.exit(1);
  }
  const padIdx = args.findIndex((a) => a.startsWith('--pad='));
  const pad = padIdx >= 0 ? Number(args[padIdx].slice('--pad='.length)) : 10;
  const cleanArgs = padIdx >= 0 ? args.filter((_, i) => i !== padIdx) : args;
  return {
    input: path.resolve(cleanArgs[0]),
    output: path.resolve(cleanArgs[1]),
    left: Number(cleanArgs[2]),
    top: Number(cleanArgs[3]),
    right: Number(cleanArgs[4]),
    bottom: Number(cleanArgs[5]),
    pad,
  };
}

async function main() {
  const { input, output, left, top, right, bottom, pad } = parseArgs();

  const img = sharp(input);
  const meta = await img.metadata();
  console.log(`[crop-figure] 输入: ${input}`);
  console.log(`[crop-figure] 尺寸: ${meta.width}x${meta.height}`);

  // 边界保护 + pad
  const W = meta.width;
  const H = meta.height;
  const x = Math.max(0, left - pad);
  const y = Math.max(0, top - pad);
  const w = Math.min(W - x, right - left + pad * 2);
  const h = Math.min(H - y, bottom - top + pad * 2);

  if (w <= 0 || h <= 0) {
    console.error(`[crop-figure] 区域非法: x=${x} y=${y} w=${w} h=${h}`);
    process.exit(1);
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(input)
    .extract({ left: x, top: y, width: w, height: h })
    .png()
    .toFile(output);
  console.log(
    `[crop-figure] 裁剪: (${left},${top})-(${right},${bottom}) + pad=${pad}`,
  );
  console.log(`[crop-figure] 输出: ${output}  (${w}x${h})`);
}

main().catch((err) => {
  console.error('[crop-figure] 失败:', err);
  process.exit(1);
});
