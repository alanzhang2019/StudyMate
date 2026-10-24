// 提取所有近年的代码块内容
import { readFile, writeFile } from 'fs/promises';
import { readdirSync } from 'fs';

const years = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];
const series = ['j', 's'];

let out = '';
for (const y of years) {
  for (const k of series) {
    const fname = `data/classrooms/cm_imp_csp${k}${y}${k}_v1.json`;
    let data;
    try {
      data = JSON.parse(await readFile(fname, 'utf-8'));
    } catch (e) {
      out += `==== ${fname} (NOT FOUND) ====\n\n`;
      continue;
    }
    out += `========== ${y.toUpperCase()} ${k.toUpperCase()} ==========\n`;
    for (const s of data.scenes || []) {
      if (s.category === 'read' || s.category === 'perfect') {
        out += `\n----- ${s.title} -----\n`;
        const cb = s.content && s.content.codeBlock;
        if (cb) {
          out += `[codeBlock title: ${cb.title || ''}]\n`;
          out += `[description: ${cb.description || ''}]\n`;
          out += `[language: ${cb.language || ''}]\n`;
          out += `[startLine: ${cb.startLine || 1}]\n`;
          out += '--- CODE ---\n';
          for (const ln of (cb.lines || [])) {
            out += ln + '\n';
          }
          out += '--- END CODE ---\n';
        } else {
          out += '[NO codeBlock]\n';
        }
        out += '\n--- QUESTIONS ---\n';
        for (const q of (s.content && s.content.questions) || []) {
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
    out += '\n\n';
  }
}
await writeFile('tmp/all-read-perfect.txt', out, 'utf-8');
console.log('Wrote', out.length, 'chars');
