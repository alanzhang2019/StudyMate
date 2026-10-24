// 使用 pdf -> png -> tesseract OCR 提取中文 PDF 文本
// 用法: node scripts/ocr-pdf.mjs <input.pdf> <output.txt>
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename, extname, resolve } from 'path';
import { createRequire } from 'module';

const execFileP = promisify(execFile);
const require = createRequire(import.meta.url);

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('用法: node scripts/ocr-pdf.mjs <input.pdf> <output.txt>');
  process.exit(1);
}

// 用 pdfjs-dist 渲染页面到 png
async function renderPdfToPngs(pdfPath, outDir) {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const dataBuffer = await readFile(pdfPath);
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(dataBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const pngs = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });  // 2x 提升 OCR
    // 尝试 canvas
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const buf = canvas.toBuffer('image/png');
    const pngPath = join(outDir, `page-${String(i).padStart(3, '0')}.png`);
    await writeFile(pngPath, buf);
    pngs.push(pngPath);
  }
  return pngs;
}

async function ocrImage(imagePath, lang = 'chi_sim') {
  const { stdout } = await execFileP('tesseract', [imagePath, 'stdout', '-l', lang, '--psm', '6'], { maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}

const workDir = join(tmpdir(), `ocr-${Date.now()}`);
await mkdir(workDir, { recursive: true });

console.log('Rendering PDF pages...');
const pngs = await renderPdfToPngs(resolve(inputPath), workDir);
console.log(`Rendered ${pngs.length} pages`);

let allText = '';
for (let i = 0; i < pngs.length; i++) {
  console.log(`OCR page ${i + 1}/${pngs.length}...`);
  const text = await ocrImage(pngs[i]);
  allText += text + '\n\n--- PAGE BREAK ---\n\n';
}

await writeFile(resolve(outputPath), allText, 'utf-8');
console.log(`OK: ${outputPath} (${allText.length} chars)`);

// 清理临时文件
await rm(workDir, { recursive: true, force: true });
