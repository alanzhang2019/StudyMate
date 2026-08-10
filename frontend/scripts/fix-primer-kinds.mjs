// 补全 CSP初赛要点精讲 (cm_imp_a39914d3af5c64d6) 课件中 quiz scene 的
// content.kind 字段, 跟 2023 CSP-J 的"在线练习"模式对齐.
//
// 背景:
//   CSP初赛要点精讲 是 csp-lecture 公开页 primer 桶的核心课件, 16 个
//   scene 中有 2 个是 quiz 类型, 之前 content.kind 字段缺失, 导致
//   QuizCover fallback 到默认标签. 修复后 QuizCover 会显示
//   "单项选择题" 标签 + ListChecks 图标, 跟 2023+ 真题卷风格一致.
//
// 涉及的 scene:
//   - sc_imp_5c64d6_5  (order 6,  "原反补转换小测验",   3 题)
//   - sc_imp_5c64d6_14 (order 15, "综合大闯关",         4 题)
//
// 另:
//   - 13 个 slide scene 不需要 kind
//   - 1 个 interactive scene (位运算模拟器) 是 simulation, 不需要 kind
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE = path.resolve('data/classrooms/cm_imp_a39914d3af5c64d6.json');
const raw = await fs.readFile(FILE, 'utf-8');
const j = JSON.parse(raw);

const fixed = [];
for (const sc of j.scenes) {
  if (sc.type === 'quiz' && (!sc.content || !sc.content.kind)) {
    if (!sc.content) sc.content = {};
    sc.content.kind = 'choice';
    fixed.push({ id: sc.id, order: sc.order, title: sc.title });
  }
}

if (fixed.length > 0) {
  await fs.writeFile(FILE, JSON.stringify(j, null, 2) + '\n', 'utf-8');
  console.log(`Updated ${fixed.length} quiz scene(s):`);
  for (const f of fixed) {
    console.log(`  [${f.order}] ${f.id}  ${f.title}  -> kind=choice`);
  }
} else {
  console.log('No quiz scene without kind; nothing to do.');
}
