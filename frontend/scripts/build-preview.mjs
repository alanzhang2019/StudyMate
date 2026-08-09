// 为 2014 套题面+答案生成可在浏览器中预览的 HTML
import { readFile, writeFile } from 'fs/promises';

const txt = await readFile('D:/AItrade/ai-math-mistake-machine/frontend/public/csp-j-2014-original.txt', 'utf-8');
const json = JSON.parse(await readFile('D:/AItrade/ai-math-mistake-machine/frontend/data/classrooms/cm_imp_cspj2014j_v1.json', 'utf-8'));

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const scenesHTML = json.scenes.map((s, i) => {
  const questionsHTML = s.content.questions.map((q, j) => {
    const optsHTML = (q.options || []).map((o, k) => {
      const isAns = (q.answer || []).includes(o.value);
      return `<div class="opt ${isAns?'ans':''}"><b>${esc(o.value)}.</b> ${esc(o.label)}${isAns?' <span class="badge">AI推断</span>':''}</div>`;
    }).join('');
    const codeBlock = (q.question || '').includes('```');
    return `<div class="q">
      <div class="qhead"><span class="qid">${esc(q.id)}</span> <span class="qpts">${q.points||1} 分</span></div>
      <pre class="qbody">${esc(q.question)}</pre>
      ${optsHTML ? `<div class="opts">${optsHTML}</div>` : ''}
      ${q.analysis ? `<div class="analysis"><b>解析:</b> ${esc(q.analysis)}</div>` : ''}
      ${q.answer && q.answer.length ? `<div class="answer"><b>答案:</b> ${q.answer.map(esc).join(', ')}</div>` : ''}
    </div>`;
  }).join('');
  return `<div class="scene">
    <h2>${esc(s.title)}</h2>
    <p class="meta">类别: ${s.category} · 题数: ${s.content.questions.length}</p>
    ${questionsHTML}
  </div>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>2014 NOIP普及组 预览</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 920px; margin: 20px auto; padding: 0 20px; color: #222; }
h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 8px; }
h2 { color: #be185d; margin-top: 32px; background: #fdf2f8; padding: 8px 12px; border-radius: 4px; }
.scene { margin-bottom: 40px; }
.meta { color: #6b7280; font-size: 13px; }
.q { background: #f9fafb; border-left: 4px solid #6366f1; padding: 12px; margin: 12px 0; border-radius: 4px; }
.qhead { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; }
.qid { font-weight: bold; }
.qpts { background: #fef3c7; padding: 1px 6px; border-radius: 3px; }
.qbody { white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 13px; margin: 8px 0; background: white; padding: 8px; border-radius: 3px; }
.opts { margin: 8px 0; }
.opt { padding: 4px 8px; margin: 2px 0; background: white; border-radius: 3px; }
.opt.ans { background: #d1fae5; border: 1px dashed #10b981; }
.badge { background: #f59e0b; color: white; padding: 1px 6px; font-size: 11px; border-radius: 3px; margin-left: 6px; }
.analysis { background: #eff6ff; padding: 6px 10px; margin-top: 6px; border-radius: 3px; font-size: 13px; }
.answer { background: #d1fae5; padding: 6px 10px; margin-top: 6px; border-radius: 3px; font-size: 13px; }
.toolbar { background: #1e293b; color: white; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
.toolbar a { color: #38bdf8; margin-right: 12px; }
.warn { background: #fef3c7; padding: 8px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
</style>
</head>
<body>
<div class="toolbar">
  <a href="/public/csp-j-2014-original.pdf" target="_blank">📄 原始 PDF</a>
  <a href="/public/csp-j-2014-original.txt" target="_blank">📝 PDF 提取文字</a>
  <a href="/data/classrooms/cm_imp_cspj2014j_v1.json" target="_blank">{ } JSON 源文件</a>
</div>

<h1>2014 NOIP 普及组 - AI 抽题效果预览</h1>
<div class="warn">
  <b>说明:</b> 题面从 PDF 提取, 答案为 AI 基于题面推断, 标为 "AI推断" 的需要您校验。
  scoreBreakdown 实际为 choice:30, read:42, perfect:28 (NOIP 2014 与 CSP 2023 结构不同)。
</div>

${scenesHTML}

<hr>
<h2>📋 PDF 提取原文 (供对照)</h2>
<pre style="background: #f3f4f6; padding: 12px; font-size: 12px; white-space: pre-wrap;">${esc(txt)}</pre>
</body>
</html>`;

await writeFile('D:/AItrade/ai-math-mistake-machine/frontend/public/csp-j-2014-preview.html', html, 'utf-8');
console.log('OK: 预览已生成 public/csp-j-2014-preview.html');
console.log('  场景数:', json.scenes.length);
console.log('  总题数:', json.scenes.reduce((s, x) => s + x.content.questions.length, 0));
console.log('  HTML 路径: http://127.0.0.1:3002/public/csp-j-2014-preview.html');
