// 提取 PDF 文字内容用于结构化录入
// 用法: node scripts/extract-pdf-text.mjs <pdf-path> [output-json-path]
import { readFile, writeFile } from 'fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

const pdfPath = process.argv[2] ?? 'd:/AItrade/ai-math-mistake-machine/frontend/public/csp-j-2014-original.pdf';

const dataBuffer = await readFile(pdfPath);
console.log(`PDF size: ${(dataBuffer.length / 1024).toFixed(1)} KB`);

const pdf = await getDocumentProxy(new Uint8Array(dataBuffer));
console.log(`PDF pages: ${pdf.numPages}`);

// Merge all pages into one big string (合并/合并页格式)
const { totalPages, text } = await extractText(pdf, { mergePages: true });
console.log(`Extracted text: ${text.length} chars from ${totalPages} pages`);

// 输出完整文本到 stdout (前 8000 字符), 完整文本写入到 .txt 文件
const outTxt = pdfPath.replace('.pdf', '.txt');
await writeFile(outTxt, text, 'utf-8');
console.log(`Full text written to: ${outTxt}`);

console.log('\n========== 文本预览（前 8000 字符）==========\n');
console.log(text.slice(0, 8000));
console.log('\n========== END 预览 ==========');
