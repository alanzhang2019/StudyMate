// 由 exam_papers_manifest.json 生成 frontend/lib/examPapers.ts
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('D:/AItrade/ai-math-mistake-machine/.workbuddy/exam_papers_manifest.json', 'utf8'));

const SUBJ_ORDER = ['chinese','math','english','physics','chemistry','ethics','history'];
const VARIANT_ORDER = ['answer','blank','analysis'];
const VARIANT_LABEL = { answer: '真题及答案', blank: '空白卷', analysis: '解析卷' };
const SUBJ_LABEL = { chinese:'语文', math:'数学', english:'英语', physics:'物理', chemistry:'化学', ethics:'道德与法治', history:'历史' };

// 排序：科目顺序 -> 年份降序 -> 卷型顺序
m.sort((a,b)=>{
  const s = SUBJ_ORDER.indexOf(a.subject)-SUBJ_ORDER.indexOf(b.subject); if (s) return s;
  if (a.year!==b.year) return b.year-a.year;
  return VARIANT_ORDER.indexOf(a.variant)-VARIANT_ORDER.indexOf(b.variant);
});

const lines = [];
lines.push('// 自动生成：由 .workbuddy/exam_papers_manifest.json 生成，请勿手工改名/排序。');
lines.push('// 深圳中考真题（2008-2025），源为 doc/docx，仅提供下载，无在线预览。');
lines.push('// 文件由 /exam-papers/<subject>/<fileName> 经 app/api/exam-papers 路由提供下载。');
lines.push('');
lines.push("import { SUBJECT_LABEL, formatSize, type SubjectKey } from './textbooks';");
lines.push('');
lines.push("export type ExamVariant = 'answer' | 'blank' | 'analysis';");
lines.push('');
lines.push('export interface ExamPaper {');
lines.push('  /** ASCII slug，与文件名（不含扩展名）一致 */');
lines.push('  slug: string;');
lines.push('  subject: SubjectKey;');
lines.push('  year: number;');
lines.push('  variant: ExamVariant;');
lines.push('  title: string;');
lines.push('  fileName: string;');
lines.push('  ext: string;');
lines.push('  sizeBytes: number;');
lines.push('}');
lines.push('');
lines.push('export const VARIANT_LABEL: Record<ExamVariant, string> = {');
for (const v of VARIANT_ORDER) lines.push(`  ${v}: '${VARIANT_LABEL[v]}',`);
lines.push('};');
lines.push('');
lines.push('export const EXAM_PAPERS: ExamPaper[] = [');
for (const p of m) {
  const title = `${SUBJ_LABEL[p.subject]} · ${p.year} · ${VARIANT_LABEL[p.variant]}`;
  lines.push(`  { slug: '${p.slug}', subject: '${p.subject}', year: ${p.year}, variant: '${p.variant}', title: '${title}', fileName: '${p.fileName}', ext: '${p.ext}', sizeBytes: ${p.sizeBytes} },`);
}
lines.push('];');
lines.push('');
lines.push('export const EXAM_SUBJECT_ORDER: SubjectKey[] = ' + JSON.stringify(SUBJ_ORDER) + ';');
lines.push('');
lines.push('export function examYears(): number[] {');
lines.push('  return [...new Set(EXAM_PAPERS.map((p) => p.year))].sort((a, b) => b - a);');
lines.push('}');
lines.push('');
lines.push('export function examPapersBySubject(subject: SubjectKey): ExamPaper[] {');
lines.push('  return EXAM_PAPERS.filter((p) => p.subject === subject);');
lines.push('}');
lines.push('');
lines.push('export function examPaperTitle(slug: string | null | undefined): string {');
lines.push('  if (!slug) return "";');
lines.push('  const p = EXAM_PAPERS.find((x) => x.slug === slug);');
lines.push('  return p ? p.title : "";');
lines.push('}');
lines.push('');

fs.writeFileSync('D:/AItrade/ai-math-mistake-machine/frontend/lib/examPapers.ts', lines.join('\n'), 'utf8');
console.log('OK examPapers.ts 条目:', m.length);
