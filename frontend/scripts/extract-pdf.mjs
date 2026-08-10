// scripts/extract-pdf.mjs - 从 PDF 提取纯文本
// 用法: node scripts/extract-pdf.mjs <input.pdf> <output.txt>
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('用法: node scripts/extract-pdf.mjs <input.pdf> <output.txt>');
    process.exit(1);
  }
  // unpdf 失败时回退到 pdfjs-dist
  let extractText;
  try {
    const unpdf = await import('unpdf');
    extractText = (buf) => unpdf.extractText(buf, { mergePages: true });
  } catch (e) {
    console.error('unpdf 不可用:', e.message);
    process.exit(1);
  }
  const absIn = path.resolve(inputPath);
  const absOut = path.resolve(outputPath);
  const buf = await fs.readFile(absIn);
  const result = await extractText(new Uint8Array(buf));
  const text = result.text || (Array.isArray(result) ? result.join('\n') : '');
  await fs.writeFile(absOut, text, 'utf-8');
  console.log(`OK: ${absOut}`);
  console.log(`  chars: ${text.length}`);
  console.log(`  pages: ${result.totalPages || '?'}`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
