// 修正 2014-2018 普及/提高组共 10 份试卷中 scene.content.kind 错配。
//
// 历史原因: 2014-2018 NOIP 初赛试卷里有两类「问题求解」和「多选题」
// 类型的 scene, 之前在 JSON 里被误标为 `code-reading` (problem_solving)
// 和 `multi-choice` (multi), 前者让 QuizCover 显示「阅读程序题」标签
// (实际是文字题), 后者不在 QuizKind 枚举 ('choice' | 'code-reading' |
// 'code-completion') 里, QuizCover 会 fallback 到 'choice' 但视觉上
// 仍能看出「单选题」标签, 不能让用户准确判断题型。
//
// 修正目标:
//   - sc_*_problem_solving (或 sc_*_problem)  → 'choice'
//   - sc_*_multi                               → 'choice'
//
// 注意: 这里不修改 scene.id (保留历史命名, 避免影响已有的 URL/deep link),
// 也不合并 read 1~4 → read1/2/3/4 (那需要重新组织 questions 数组, 超出
// 「只修 kind 错配」范围).
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('data/classrooms');

const TARGETS = [
  // 普及组 2014-2018
  'cm_imp_cspj2014j_v1.json',
  'cm_imp_cspj2015j_v1.json',
  'cm_imp_cspj2016j_v1.json',
  'cm_imp_cspj2017j_v1.json',
  'cm_imp_cspj2018j_v1.json',
  // 提高组 2014-2018
  'cm_imp_csps2014s_v1.json',
  'cm_imp_csps2015s_v1.json',
  'cm_imp_csps2016s_v1.json',
  'cm_imp_csps2017s_v1.json',
  'cm_imp_csps2018s_v1.json',
];

let totalFixed = 0;
for (const file of TARGETS) {
  const filePath = path.join(DIR, file);
  const raw = await fs.readFile(filePath, 'utf-8');
  const j = JSON.parse(raw);
  const fixed = [];
  for (const sc of j.scenes) {
    // problem_solving / problem 是「问题求解」题 (文字推理题),
    // 之前误标为 code-reading
    if (
      (sc.id.includes('problem_solving') || sc.id === 'sc_csps18s_problem') &&
      sc.content?.kind === 'code-reading'
    ) {
      sc.content.kind = 'choice';
      fixed.push({ id: sc.id, old: 'code-reading', new: 'choice' });
    }
    // multi 是「多选题」, 之前标为 multi-choice (不在标准枚举)
    if (sc.id.includes('_multi') && sc.content?.kind === 'multi-choice') {
      sc.content.kind = 'choice';
      fixed.push({ id: sc.id, old: 'multi-choice', new: 'choice' });
    }
  }
  if (fixed.length > 0) {
    await fs.writeFile(filePath, JSON.stringify(j, null, 2) + '\n', 'utf-8');
    console.log(`\n=== ${file} ===`);
    for (const f of fixed) console.log(`  ${f.id}: ${f.old} -> ${f.new}`);
    totalFixed += fixed.length;
  } else {
    console.log(`(skip) ${file}: no mismatched kinds`);
  }
}
console.log(`\n=== Total: ${totalFixed} scene.kind fixed ===`);
