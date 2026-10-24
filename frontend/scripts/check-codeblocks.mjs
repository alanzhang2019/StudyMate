// 检查所有csp卷子是否有codeBlock
import { readFile, writeFile } from 'fs/promises';
import { readdirSync } from 'fs';

const files = readdirSync('data/classrooms').filter(f => /^cm_imp_csp.*_v1\.json$/.test(f));

let report = 'Year\tType\tScene\tCategory\tHasCodeBlock\tQuestionCount\tQ1Snippet\n';
for (const f of files) {
  const data = JSON.parse(await readFile(`data/classrooms/${f}`, 'utf-8'));
  const m = f.match(/cm_imp_csp([js])(\d{4})([js])_v1/);
  if (!m) continue;
  const [, kind, year, jOrS] = m;
  const series = kind === 'j' ? 'J' : 'S';
  for (const s of data.scenes || []) {
    if (s.category === 'read' || s.category === 'perfect') {
      const hasCB = !!(s.content && s.content.codeBlock);
      const qCount = (s.content && s.content.questions || []).length;
      const q1 = (s.content && s.content.questions && s.content.questions[0]) || {};
      const snippet = (q1.question || '').slice(0, 80).replace(/\n/g, ' ');
      report += `${year}\t${series}\t${s.id || ''}\t${s.category}\t${hasCB}\t${qCount}\t${snippet}\n`;
    }
  }
}
await writeFile('tmp/codeblock-report.txt', report, 'utf-8');
console.log(report);
