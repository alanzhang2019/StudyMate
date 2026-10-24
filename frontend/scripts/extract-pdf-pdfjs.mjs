// 直接使用 pdfjs-dist 处理 CMap
// 用法: node scripts/extract-pdf-pdfjs.mjs <input.pdf> <output.txt>
import { readFile, writeFile } from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('用法: node scripts/extract-pdf-pdfjs.mjs <input.pdf> <output.txt>');
  process.exit(1);
}

const dataBuffer = await readFile(inputPath);
const loadingTask = pdfjs.getDocument({
  data: new Uint8Array(dataBuffer),
  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
  useSystemFonts: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
});
const pdf = await loadingTask.promise;
console.log(`PDF pages: ${pdf.numPages}`);

let fullText = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const tc = await page.getTextContent();
  let pageText = '';
  let lastY = null;
  for (const item of tc.items) {
    if (lastY !== null && Math.abs(item.transform[5] - lastY) > 1) {
      pageText += '\n';
    }
    pageText += item.str;
    lastY = item.transform[5];
  }
  fullText += pageText + '\n\n--- PAGE BREAK ---\n\n';
}
await writeFile(outputPath, fullText, 'utf-8');
console.log(`OK: ${outputPath} (${fullText.length} chars)`);
