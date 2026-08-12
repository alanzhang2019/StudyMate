// Check code-block lines for "compact" cases where multiple top-level statements
// share a line. Semicolons inside parens (e.g., for-loop conditions) are ignored.
const fs = require('fs');
const path = require('path');

function topLevelSemicolons(line) {
  let depth = 0;
  let count = 0;
  for (const ch of line) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ';' && depth === 0) count++;
  }
  return count;
}

const dir = 'frontend/data/classrooms';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
let total = 0, problematic = 0;
const problemFiles = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '');
  let d;
  try { d = JSON.parse(raw); } catch (e) { console.log('PARSE ERROR in', f, e.message); continue; }
  const scenes = d.scenes || [];
  for (const s of scenes) {
    if (s.content && s.content.codeBlock && s.content.codeBlock.lines) {
      total++;
      const compact = s.content.codeBlock.lines.filter(l => l && topLevelSemicolons(l) > 1).length;
      if (compact > 0) {
        problematic++;
        problemFiles.push({ file: f, title: s.title, compact });
      }
    }
  }
}
console.log('Total codeBlock scenes:', total, 'with multiple top-level statements per line:', problematic);
for (const p of problemFiles) {
  console.log('  ' + p.file + ' :: ' + p.title + ' (compact lines: ' + p.compact + ')');
}
