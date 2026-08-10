// 批量检查所有 CSP 真题卷 JSON 中每个 scene 的 content.kind 字段
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('data/classrooms');

const files = (await fs.readdir(DIR))
  .filter((f) => /^cm_imp_csp[js]\d{4}[js]_v1\.json$/.test(f))
  .sort();

let totalIssues = 0;
for (const f of files) {
  try {
    const raw = await fs.readFile(path.join(DIR, f), 'utf-8');
    const j = JSON.parse(raw);
    const issues = [];
    if (!Array.isArray(j.scenes)) {
      console.log(`${f}: NO SCENES`);
      continue;
    }
    for (const sc of j.scenes) {
      const kind = sc.content?.kind;
      // 通过 id 优先判断 (scenes[*] id 在 build 脚本里有规范化命名):
      //   - *_choice          → 单项选择题
      //   - *_problem_solving / *_problem / *_multi → 也是选择题类
      //     (NOIP 2014-2018 历史术语, 分别是"问题求解题"和"多选题")
      //   - *_read            → 阅读程序题
      //   - *_perfect / *_perfect2 → 完善程序题
      // category 字段仅作为 fallback (旧版 build 脚本可能没填或填错).
      let expected;
      if (sc.id.includes('_choice') || sc.category === 'choice') expected = 'choice';
      else if (
        sc.id.includes('problem_solving') ||
        sc.id.includes('_problem') ||
        sc.id.includes('_multi')
      )
        expected = 'choice';
      else if (sc.id.includes('_read') || sc.category === 'read') expected = 'code-reading';
      else if (sc.id.includes('_perfect') || sc.category === 'perfect') expected = 'code-completion';
      else expected = '?';
      if (expected === '?') continue;
      if (kind !== expected) {
        issues.push({ id: sc.id, actual: kind ?? '(missing)', expected });
      }
    }
    if (issues.length > 0) {
      totalIssues += issues.length;
      console.log(`\n=== ${f} ===`);
      for (const it of issues) {
        console.log(`  ${it.id}: kind=${it.actual}  expected=${it.expected}`);
      }
    } else {
      console.log(`✓ ${f}: all kinds correct`);
    }
  } catch (e) {
    console.log(`${f}: PARSE ERROR ${e.message}`);
  }
}
console.log(`\n=== Total issues: ${totalIssues} ===`);
