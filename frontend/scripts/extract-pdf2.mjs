// 改进版 PDF 文本提取，支持中文字体
// 用法: node scripts/extract-pdf2.mjs <input.pdf> <output.txt>
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('用法: node scripts/extract-pdf2.mjs <input.pdf> <output.txt>');
    process.exit(1);
  }
  const absIn = path.resolve(inputPath);
  const absOut = path.resolve(outputPath);
  const buf = await fs.readFile(absIn);

  // 找到 unpdf 的 pdfjs-dist
  const unpdfPath = require.resolve('unpdf');
  // unpdf 0.10+ 内部用 pdfjs-dist
  let pdfjs;
  try {
    pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (e1) {
    try {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch (e2) {
      console.error('pdfjs-dist 不可用:', e1.message, e2.message);
      process.exit(1);
    }
  }
  // unpdf 直接用
  const unpdf = await import('unpdf');

  // unpdf 的 extractText 接受 options
  let result;
  try {
    // 尝试 1: 传 cMap 参数
    result = await unpdf.extractText(new Uint8Array(buf), {
      mergePages: true,
    });
  } catch (e) {
    console.error('extractText err:', e.message);
    process.exit(1);
  }
  const text = result.text || (Array.isArray(result) ? result.join('\n') : '');
  await fs.writeFile(absOut, text, 'utf-8');
  console.log(`OK: ${absOut}`);
  console.log(`  chars: ${text.length}`);
  console.log(`  pages: ${result.totalPages || '?'}`);
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
