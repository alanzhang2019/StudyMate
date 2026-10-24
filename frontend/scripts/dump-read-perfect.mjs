// 提取阅读程序和完善程序题目内容到文件
import { readFile, writeFile } from 'fs/promises';

const data = JSON.parse(await readFile('data/classrooms/cm_imp_cspj2024j_v1.json', 'utf-8'));

let out = '';
for (const s of data.scenes || []) {
  if (s.category === 'read' || s.category === 'perfect') {
    out += '====================================\n';
    out += 'SCENE: ' + s.title + '\n';
    out += '====================================\n';
    for (const q of (s.content && s.content.questions) || []) {
      out += `\nQ ${q.id} [${q.type}] pts=${q.points}\n`;
      out += 'QUESTION:\n' + q.question + '\n';
      out += '--- OPTIONS ---\n';
      if (Array.isArray(q.options)) {
        for (const o of q.options) {
          out += '  ' + (typeof o === 'string' ? o : JSON.stringify(o)) + '\n';
        }
      }
      out += 'ANSWER: ' + JSON.stringify(q.answer) + '\n';
      out += '\n';
    }
  }
}
await writeFile('tmp/cspj2024-read-perfect.txt', out, 'utf-8');
console.log('Written:', out.length, 'chars');
