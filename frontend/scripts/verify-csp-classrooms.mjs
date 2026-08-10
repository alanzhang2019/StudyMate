// 验证所有 cm_imp_csp*.json 文件结构
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../data/classrooms');

const files = (await fs.readdir(DIR))
  .filter((f) => /^cm_imp_csp[js]\d{4}[js]_v1\.json$/.test(f))
  .sort();

const summary = [];
for (const f of files) {
  try {
    const raw = await fs.readFile(path.join(DIR, f), 'utf-8');
    const j = JSON.parse(raw);
    const sc = Array.isArray(j.scenes) ? j.scenes : [];
    const totalQ = sc.reduce(
      (s, sc) => s + (Array.isArray(sc.content?.questions) ? sc.content.questions.length : 0),
      0
    );
    summary.push({
      id: j.id,
      name: j.stage?.name ?? '?',
      scenes: sc.length,
      totalQ,
      valid: !!j.id && !!j.stage && sc.length > 0 && totalQ > 0,
    });
  } catch (e) {
    summary.push({ id: f, error: e.message });
  }
}
for (const r of summary) {
  if (r.error) {
    console.log(`❌ ${r.id} ERROR: ${r.error}`);
  } else {
    const mark = r.valid ? '✅' : '⚠️ ';
    console.log(`${mark} ${r.id} | scenes=${r.scenes} totalQ=${r.totalQ} | ${r.name}`);
  }
}
console.log(`\n总计: ${summary.length} 份`);
