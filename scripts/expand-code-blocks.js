// Expand all code blocks in CSP-J/S JSON files to one-statement-per-line format
const fs = require('fs');
const path = require('path');
const { splitCppLine } = require('./test-splitter-impl.js');

function expandCodeBlock(codeBlock) {
  if (!codeBlock || !codeBlock.lines || !Array.isArray(codeBlock.lines)) return codeBlock;
  // Join all lines with \n so the splitter preserves original line boundaries
  // (e.g. #include on its own line) while still re-splitting compact lines on
  // `;`, `{`, `}` boundaries. The splitter treats \n at parenDepth=0 as a flush.
  const joined = codeBlock.lines.join('\n');
  const expanded = splitCppLine(joined);
  // Collapse runs of empty lines into single empties
  const out = [];
  for (const l of expanded) {
    if (l === '' && out.length > 0 && out[out.length - 1] === '') continue;
    out.push(l);
  }
  return { ...codeBlock, lines: out };
}

function processFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  let d;
  try { d = JSON.parse(raw); } catch (e) {
    console.log('  PARSE ERROR in', path.basename(filePath), e.message);
    return { changed: false, error: true };
  }
  if (!d.scenes) return { changed: false, error: false };
  let changed = false;
  let totalScenes = 0;
  let totalBefore = 0, totalAfter = 0;
  for (const s of d.scenes) {
    if (s.content && s.content.codeBlock && Array.isArray(s.content.codeBlock.lines)) {
      totalScenes++;
      const oldLines = s.content.codeBlock.lines;
      totalBefore += oldLines.length;
      const newCodeBlock = expandCodeBlock(s.content.codeBlock);
      totalAfter += newCodeBlock.lines.length;
      if (JSON.stringify(oldLines) !== JSON.stringify(newCodeBlock.lines)) {
        s.content.codeBlock = newCodeBlock;
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(d, null, 2) + '\n', 'utf8');
  }
  return { changed, totalScenes, totalBefore, totalAfter, error: false };
}

const dir = 'frontend/data/classrooms';
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.json') && /^cm_imp_csp[js]/.test(f))
  .sort();

let totalChanged = 0, totalScenes = 0, totalBefore = 0, totalAfter = 0;
const errors = [];
for (const f of files) {
  const r = processFile(path.join(dir, f));
  if (r.error) { errors.push(f); continue; }
  totalScenes += r.totalScenes;
  totalBefore += r.totalBefore;
  totalAfter += r.totalAfter;
  if (r.changed) {
    totalChanged++;
    console.log(`  ✓ ${f}  (${r.totalBefore} → ${r.totalAfter} lines, ${r.totalScenes} scenes)`);
  } else {
    console.log(`  - ${f}  (no change)`);
  }
}
console.log(`\nDone. ${totalChanged}/${files.length} files changed.`);
console.log(`Total: ${totalScenes} code-block scenes, ${totalBefore} → ${totalAfter} lines.`);
if (errors.length) console.log('Parse errors:', errors);
