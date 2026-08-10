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
      // 期望根据 scene id 前缀判断类型
      let expected;
      if (sc.id.includes('choice') || sc.category === 'choice') expected = 'choice';
      else if (sc.id.includes('read') || sc.category === 'read') expected = 'code-reading';
      else if (sc.id.includes('perfect') || sc.category === 'perfect') expected = 'code-completion';
      else expected = '?';
      if (expected === '?') continue; // 跳过不明类型
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
