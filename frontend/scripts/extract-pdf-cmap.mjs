// 修复 cMap 问题：使用 unpkg CDN 加载中文 cMap
// 用法: node scripts/extract-pdf-cmap.mjs <input.pdf> <output.txt>
import { readFile, writeFile } from 'fs/promises';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('用法: node scripts/extract-pdf-cmap.mjs <input.pdf> <output.txt>');
  process.exit(1);
}

const unpdf = await import('unpdf');
const dataBuffer = await readFile(inputPath);
const pdf = await unpdf.getDocumentProxy(new Uint8Array(dataBuffer), {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
  cMapPacked: true,
});
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
