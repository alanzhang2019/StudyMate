// 详查 cm_imp_a39914d3af5c64d6 课件的所有 scene 类型分布
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE = path.resolve('data/classrooms/cm_imp_a39914d3af5c64d6.json');
const raw = await fs.readFile(FILE, 'utf-8');
const j = JSON.parse(raw);

console.log('Stage:', j.stage?.name);
console.log('Total scenes:', j.scenes?.length);
console.log();

const byType = {};
for (const sc of j.scenes) {
  const key = `${sc.type}/${sc.content?.type ?? '?'}`;
  byType[key] = (byType[key] ?? 0) + 1;
}
console.log('Scene type distribution:');
for (const [k, v] of Object.entries(byType)) {
  console.log(`  ${k}: ${v}`);
}

console.log('\nScene 详细列表:');
for (const sc of j.scenes) {
  const c = sc.content ?? {};
  const qCount = Array.isArray(c.questions) ? c.questions.length : 0;
  const hasCodeBlock = !!c.codeBlock;
  const hasCanvas = !!c.canvas;
  const kind = c.kind ?? '(none)';
  console.log(
    `  [${String(sc.order).padStart(2, '0')}] ${sc.id.padEnd(24)} type=${sc.type.padEnd(6)} ` +
      `content.type=${String(c.type).padEnd(6)} kind=${kind.padEnd(16)} ` +
      `questions=${String(qCount).padEnd(3)} codeBlock=${String(hasCodeBlock).padEnd(5)} canvas=${hasCanvas}`,
  );
}
