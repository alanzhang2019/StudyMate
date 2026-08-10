// 列出 csp-lecture 公开页面上能看到的所有课件 (collection === 'csp-lecture'),
// 并按 primer / paper 分桶, 输出 id / stage name / scene 数 / 总题数.
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('data/classrooms');

const entries = (await fs.readdir(DIR)).filter((n) => n.endsWith('.json'));

const items = [];
for (const name of entries) {
  try {
    const raw = (await fs.readFile(path.join(DIR, name), 'utf-8')).replace(/^\ufeff/, '');
    const j = JSON.parse(raw);
    if (j.collection !== 'csp-lecture') continue;
    const stage = j.stage ?? {};
    const scenes = Array.isArray(j.scenes) ? j.scenes : [];
    const totalQ = scenes.reduce(
      (s, sc) => s + (Array.isArray(sc.content?.questions) ? sc.content.questions.length : 0),
      0,
    );
    items.push({
      id: j.id ?? name.replace(/\.json$/, ''),
      name: stage.name ?? '?',
      sceneCount: scenes.length,
      totalQ,
      kindBreakdown: scenes.map((sc) => sc.content?.kind ?? '(none)').join(', '),
    });
  } catch {
    // skip
  }
}

const bucket = (id) =>
  id.startsWith('cm_imp_cspj') || id.startsWith('cm_imp_csps') ? 'paper' : 'primer';
const primers = items.filter((it) => bucket(it.id) === 'primer');
const papers = items.filter((it) => bucket(it.id) === 'paper');

console.log('=== primer (CSP要点精讲) ===');
for (const it of primers) {
  console.log(`\n  ${it.id}`);
  console.log(`    name: ${it.name}`);
  console.log(`    scenes: ${it.sceneCount}  totalQ: ${it.totalQ}`);
  console.log(`    kinds: ${it.kindBreakdown}`);
}
console.log(`\n--- ${primers.length} primer items ---`);

console.log('\n=== paper (历年真题) ===');
for (const it of papers) {
  console.log(`  ${it.id}  scenes=${it.sceneCount}  totalQ=${it.totalQ}  ${it.name}`);
}
console.log(`--- ${papers.length} paper items ---`);
