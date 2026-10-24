import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const DIR = './data/classrooms';
const files = (await readdir(DIR)).filter(f => /^cm_imp_csp[js]\d{4}[js]_v1\.json$/.test(f)).sort();

for (const f of files) {
  const m = f.match(/cm_imp_csp([js])(\d{4})([js])_v1/);
  if (!m) continue;
  const [, kind, year, jOrS] = m;
  const series = kind === 'j' ? 'J' : 'S';
  const data = JSON.parse(await readFile(join(DIR, f), 'utf-8'));
  const scenes = data.scenes || [];
  for (const s of scenes) {
    const id = s.id || '';
    const isProblem = id.includes('problem_solving') || (id.includes('_problem') && !id.includes('perfect')) || (s.title || '').includes('问题求解');
    if (!isProblem) continue;
    const qs = (s.content && s.content.questions) || [];
    for (const q of qs) {
      console.log(`=== ${year} ${series} | ${s.id} | ${q.id} ===`);
      console.log(`Q: ${(q.question || '').replace(/\n/g, ' ')}`);
      console.log(`A: ${JSON.stringify(q.answer)}`);
      console.log(`O: ${(q.options || []).map(o => `${o.value}=${o.label}`).join(', ')}`);
      console.log(`N: ${(q.analysis || '').slice(0, 150)}`);
      console.log('');
    }
  }
}
