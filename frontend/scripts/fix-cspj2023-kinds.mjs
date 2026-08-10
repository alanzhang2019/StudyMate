// 修复 2023 CSP-J 普及组真题卷的 content.kind 字段
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE = path.resolve('data/classrooms/cm_imp_cspj2023j_v1.json');

const raw = await fs.readFile(FILE, 'utf-8');
const j = JSON.parse(raw);

const expected = {
  sc_cspj23j_read1: 'code-reading',
  sc_cspj23j_read2: 'code-reading',
  sc_cspj23j_read3: 'code-reading',
  sc_cspj23j_perfect1: 'code-completion',
  sc_cspj23j_perfect2: 'code-completion',
};

let changed = 0;
for (const sc of j.scenes) {
  if (expected[sc.id]) {
    if (!sc.content) sc.content = {};
    if (sc.content.kind !== expected[sc.id]) {
      console.log(`  ${sc.id}: kind ${sc.content.kind ?? '(missing)'} -> ${expected[sc.id]}`);
      sc.content.kind = expected[sc.id];
      changed++;
    }
  }
}

if (changed > 0) {
  await fs.writeFile(FILE, JSON.stringify(j, null, 2) + '\n', 'utf-8');
  console.log(`\nWrote ${FILE} (${changed} scenes updated)`);
} else {
  console.log('\nNo changes needed.');
}
