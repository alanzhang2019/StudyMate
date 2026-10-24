// 批量提取所有 CSP 真题卷 PDF 的纯文本
// 用法: node scripts/extract-all-pdfs.mjs
import { readFile, writeFile, readdir } from 'fs/promises';
import { resolve, basename, join } from 'path';

const sources = [
  { dir: '../J组十年普及组初赛试题', years: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023], series: 'j' },
  { dir: '../J组十年普及组初赛试题', years: [2020, 2021, 2022, 2023], series: 'j', prefix: '' },
  { dir: '../S组提高组初赛真题12年', years: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025], series: 's' },
  { dir: '..', years: [2024, 2025], series: 'j' }, // 2024CSP-J初赛试题.pdf / 2025年CSP-J真题(4).pdf
];

async function findPdf(dir, year, series) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith('.pdf')) continue;
    const n = e.name;
    if (series === 'j') {
      // 匹配 2019CSP-J, 2020CSP-J, 2024CSP-J, 2025年CSP-J
      if (n.includes(`${year}CSP-J`) || n.includes(`${year}NOIP普及组`) || n.includes(`${year}年CSP-J`)) {
        return join(dir, n);
      }
    } else {
      if (n.includes(`${year}CSP-S`) || n.includes(`${year}noip提高组`) || n.includes(`${year}提高组`)) {
        return join(dir, n);
      }
    }
  }
  return null;
}

const unpdf = await import('unpdf');

async function extract(pdfPath) {
  const buf = await readFile(pdfPath);
  const pdf = await unpdf.getDocumentProxy(new Uint8Array(buf));
  let full = '';
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
    full += pageText + '\n\n--- PAGE BREAK ---\n\n';
  }
  return { pages: pdf.numPages, text: full };
}

const outDir = resolve('tmp/pdf-text');
await import('fs/promises').then(m => m.mkdir(outDir, { recursive: true }));

const log = [];
for (const src of sources) {
  for (const y of src.years) {
    const pdfPath = await findPdf(resolve(src.dir), y, src.series);
    if (!pdfPath) {
      log.push(`[MISS] ${src.series.toUpperCase()}-${y} not found in ${src.dir}`);
      continue;
    }
    const outPath = join(outDir, `csp${src.series}${y}_pdf.txt`);
    try {
      const { pages, text } = await extract(pdfPath);
      await writeFile(outPath, text, 'utf-8');
      log.push(`[OK] ${src.series.toUpperCase()}-${y}  pages=${pages}  chars=${text.length}  -> ${outPath}`);
    } catch (e) {
      log.push(`[ERR] ${src.series.toUpperCase()}-${y} ${e.message}`);
    }
  }
}
console.log(log.join('\n'));
