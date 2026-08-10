// 详查每份试卷的所有 scene，找出 content.kind 与实际题目类型不匹配的场景
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('data/classrooms');

const files = (await fs.readdir(DIR))
  .filter((f) => /^cm_imp_csp[js]\d{4}[js]_v1\.json$/.test(f))
  .sort();

for (const f of files) {
  const raw = await fs.readFile(path.join(DIR, f), 'utf-8');
  const j = JSON.parse(raw);
  console.log(`\n=== ${f} ===  (${j.stage?.name})`);
  for (const sc of j.scenes) {
    const kind = sc.content?.kind ?? '(missing)';
    const hasCodeBlock = !!sc.content?.codeBlock;
    const questionCount = Array.isArray(sc.content?.questions) ? sc.content.questions.length : 0;
    const hasCodeLinesInQuestion = sc.content?.questions?.some((q) => q.codeLines) ?? false;
    console.log(
      `  ${sc.id.padEnd(34)} kind=${kind.padEnd(18)} codeBlock=${String(hasCodeBlock).padEnd(5)} ` +
        `qCount=${String(questionCount).padEnd(3)} qWithCodeLines=${hasCodeLinesInQuestion}`,
    );
  }
}
