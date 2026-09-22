// 盘点 + 拷贝 深圳中考真题 到 frontend/data/exam-papers, 生成 manifest
const fs = require('fs');
const path = require('path');

const SRC = 'D:/gongxiang/深圳中考真题库/exam-papers';
const DEST = 'D:/AItrade/ai-math-mistake-machine/frontend/data/exam-papers';

// 文件夹关键词 -> SubjectKey (与 textbooks.ts 一致)
const SUBJ_MAP = [
  ['语文', 'chinese'], ['数学', 'math'], ['英语', 'english'],
  ['物理', 'physics'], ['化学', 'chemistry'], ['道法', 'ethics'], ['历史', 'history'],
];
const VARIANT_LABEL = { answer: '真题及答案', blank: '空白卷', analysis: '解析卷' };

function classifyVariant(fn) {
  if (fn.includes('空白卷')) return 'blank';
  if (fn.includes('解析卷')) return 'analysis';
  return 'answer';
}

const raw = [];
const skipped = [];
for (const fld of fs.readdirSync(SRC)) {
  const fp = path.join(SRC, fld);
  if (!fs.statSync(fp).isDirectory()) continue;
  let subj = null;
  for (const [kw, code] of SUBJ_MAP) { if (fld.includes(kw)) { subj = code; break; } }
  for (const fn of fs.readdirSync(fp)) {
    const ext = path.extname(fn).toLowerCase().replace('.', '');
    if (ext !== 'doc' && ext !== 'docx') continue;
    const m = fn.match(/(\d{4})/);
    const year = m ? +m[1] : null;
    if (!subj || !year) { skipped.push(fn); continue; }
    raw.push({ subj, year, variant: classifyVariant(fn), ext, src: path.join(fp, fn), base: path.basename(fn) });
  }
}

// 同 (subj,year,variant) 去重：优先 docx，其次 doc
const groups = {};
for (const it of raw) {
  const k = `${it.subj}|${it.year}|${it.variant}`;
  if (!groups[k]) groups[k] = [];
  groups[k].push(it);
}
const chosen = [];
for (const k of Object.keys(groups)) {
  const arr = groups[k];
  arr.sort((a, b) => (a.ext === 'docx' ? -1 : 1) - (b.ext === 'docx' ? -1 : 1));
  chosen.push(arr[0]);
}

// 分配 slug（理论上已唯一，仍做碰撞保护）
const slugSeen = {};
const out = [];
for (const it of chosen) {
  let slug = `${it.subj}-${it.year}-${it.variant}`;
  if (slugSeen[slug]) { slugSeen[slug] += 1; slug += `-${slugSeen[slug]}`; }
  else slugSeen[slug] = 1;
  const fileName = `${slug}.${it.ext}`;
  const sizeBytes = fs.statSync(it.src).size;
  out.push({
    slug, subject: it.subj, year: it.year, variant: it.variant,
    title: `${subjLabel(it.subj)} · ${it.year} · ${VARIANT_LABEL[it.variant]}`,
    fileName, ext: it.ext, sizeBytes, src: it.src,
  });
}
function subjLabel(s){return {chinese:'语文',math:'数学',english:'英语',physics:'物理',chemistry:'化学',ethics:'道德与法治',history:'历史'}[s];}

// 拷贝
let copied = 0, existed = 0;
for (const o of out) {
  const d = path.join(DEST, o.subject);
  fs.mkdirSync(d, { recursive: true });
  const target = path.join(d, o.fileName);
  if (fs.existsSync(target) && fs.statSync(target).size === o.sizeBytes) { existed++; continue; }
  fs.copyFileSync(o.src, target);
  copied++;
}

fs.writeFileSync(
  'D:/AItrade/ai-math-mistake-machine/.workbuddy/exam_papers_manifest.json',
  JSON.stringify(out, null, 1)
);

// 汇总
const per = {};
for (const o of out) per[o.subject] = (per[o.subject] || 0) + 1;
console.log(`RAW=${raw.length} 去重后=${out.length} 拷贝=${copied} 已存在跳过=${existed}`);
for (const s of ['chinese','math','english','physics','chemistry','ethics','history'])
  console.log('  ' + s + ': ' + (per[s] || 0));
const yrs = [...new Set(out.map(o=>o.year))].sort((a,b)=>a-b);
console.log('years:', yrs[0], '~', yrs[yrs.length-1], '(', yrs.length, ')');
console.log('SKIPPED(非年份真题,如知识点汇总):', skipped.length, skipped.slice(0,5).join(' | '));
console.log('manifest -> .workbuddy/exam_papers_manifest.json');
