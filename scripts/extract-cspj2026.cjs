// scripts/extract-cspj2026.cjs - 提取 2026 CSP-J 第一轮真题卷
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const pdfPath = path.resolve(__dirname, '..', 'J组十年普及组初赛试题', '2026 CSP-J 第一轮真题卷.pdf');
const outDir = path.resolve(__dirname, '..', 'J组十年普及组初赛试题');
const txtOut = path.join(outDir, '2026-cspj-pdf.txt');
const jsonOut = path.join(outDir, '2026-cspj-pages.json');

(async () => {
  const dataBuffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: dataBuffer });
  const data = await parser.getText();
  const text = data.text || (data.pages || []).map(p => p.text).join('\n\f');
  const numpages = data.numpages || (data.pages ? data.pages.length : 0);
  fs.writeFileSync(txtOut, text, 'utf-8');

  // 按页输出
  const pageTexts = text.split(/\f/);
  const pages = pageTexts.map((t, i) => ({ page: i + 1, text: t }));
  fs.writeFileSync(jsonOut, JSON.stringify(pages, null, 2), 'utf-8');

  console.log(`OK: ${numpages} pages`);
  console.log(`  -> ${txtOut}`);
  console.log(`  -> ${jsonOut}`);
  console.log(`Total text length: ${text.length}`);
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});