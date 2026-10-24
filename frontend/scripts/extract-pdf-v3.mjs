// 改进的 PDF 提取，处理字体编码问题
import { readFile, writeFile } from 'fs/promises';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('用法: node scripts/extract-pdf-v3.mjs <input.pdf> <output.txt>');
  process.exit(1);
}

const unpdf = await import('unpdf');
const dataBuffer = await readFile(inputPath);
const pdf = await unpdf.getDocumentProxy(new Uint8Array(dataBuffer));
console.log(`PDF pages: ${pdf.numPages}`);

let fullText = '';
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const tc = await page.getTextContent();
  let pageText = '';
  let lastY = null;
  for (const item of tc.items) {
    // 当 Y 坐标变化时插入换行
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
