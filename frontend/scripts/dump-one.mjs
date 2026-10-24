// Dump read/perfect scenes for one JSON file
import { readFile, writeFile } from 'fs/promises';

const fname = process.argv[2];
const outName = process.argv[3] || null;
const raw = await readFile(fname, 'utf-8');
const data = JSON.parse(raw);
const m = fname.match(/cm_imp_csp([js])(\d{4})([js])_v1/);
const series = m[1] === 'j' ? 'J' : 'S';
const year = m[2];

let out = `========== ${year} ${series} ==========\n`;
out += `FILE: ${fname}\n\n`;

for (const s of data.scenes || []) {
  if (s.category === 'read' || s.category === 'perfect') {
    out += `\n----- [${s.category.toUpperCase()}] ${s.title} (id=${s.id}) -----\n`;
    const c = s.content || {};
    if (c.codeBlock) {
      out += `[codeBlock title: ${c.codeBlock.title || ''}]\n`;
      out += `[description: ${c.codeBlock.description || ''}]\n`;
      out += `[language: ${c.codeBlock.language || ''}]\n`;
      out += `[startLine: ${c.codeBlock.startLine || 1}]\n`;
      out += '--- CODE ---\n';
      for (const ln of (c.codeBlock.lines || [])) {
        out += ln + '\n';
      }
      out += '--- END CODE ---\n';
    } else {
      out += '[NO codeBlock]\n';
    }
    out += '\n--- QUESTIONS ---\n';
    for (const q of (c.questions || [])) {
      out += `Q ${q.id} [${q.type}] pts=${q.points}\n`;
      out += `Q: ${q.question}\n`;
      if (q.options) {
        for (const o of q.options) {
          out += `  ${typeof o === 'string' ? o : JSON.stringify(o)}\n`;
        }
      }
      out += `A: ${JSON.stringify(q.answer)}\n\n`;
    }
  }
}

console.log(out);
if (outName) {
  await writeFile(outName, out, 'utf-8');
}
