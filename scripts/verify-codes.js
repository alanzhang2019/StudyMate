// verify-codes.js
// 作用：列出所有有 codeBlock 的 scene 场景，
//       对每个场景输出：(a) 我在 JSON 里的 code  (b) 原始 PDF 页面路径
//       让用户（或者我下一轮）直接看图对比。
//
// 用法：node scripts/verify-codes.js [--year=2015] [--render]
//   --render  会先用 pymupdf 渲染对应原 PDF 页为 PNG 到 .verify-png/ 目录
//   --year=N  只看指定年份的 codeBlock

const fs = require('fs');
const path = require('path');

const arg = (k) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : null;
};
const year = arg('year');
const render = process.argv.includes('--render');

const classroomDir = 'frontend/data/classrooms';
const pdfDir = 'J组十年普及组初赛试题';
const outDir = 'J组十年普及组初赛试题/.verify-png';

if (render) fs.mkdirSync(outDir, { recursive: true });

// 一份 codeBlock → 原始 PDF 哪一页的查找表
// 通过 stage 名字、scene title 推测页码（已知 2015 的结构）
function findPdfPage(stageName, sceneTitle) {
  if (!stageName.includes('2015')) return null;
  // 2015 J 已知排版（来自 OCR 校对）:
  //   p4: 选择题末段 + 阅读程序 (一)
  //   p5: 阅读程序 (二)(三)
  //   p6: 阅读程序 (四) + 完善程序 (一)
  //   p7: 完善程序 (二)
  if (sceneTitle.includes('阅读程序（1') || sceneTitle.includes('阅读程序（1）') ||
      sceneTitle.includes('（1）简单条件输出')) return 4;
  if (sceneTitle.includes('阅读程序（2') || sceneTitle.includes('（2）结构体')) return 5;
  if (sceneTitle.includes('阅读程序（3') || sceneTitle.includes('（3）字符串小写')) return 5;
  if (sceneTitle.includes('阅读程序（4') || sceneTitle.includes('（4）字符指针')) return 6;
  if (sceneTitle.includes('完善程序（1') || sceneTitle.includes('（1）打印月历')) return 6;
  if (sceneTitle.includes('完善程序（2') || sceneTitle.includes('（2）中位数')) return 7;
  return null;
}

const files = fs.readdirSync(classroomDir).filter((f) => f.endsWith('.json'));
let total = 0;
let flagged = 0;
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(classroomDir, f), 'utf8'));
  if (!d.stage || !d.stage.name) continue;
  if (year && !d.stage.name.includes(year)) continue;
  for (const s of d.scenes) {
    if (!s.content || !s.content.codeBlock) continue;
    total++;
    const code = s.content.codeBlock.lines.join('\n');
    const page = findPdfPage(d.stage.name, s.title);
    const stem = f.replace('.json', '');
    let imgPath = '';
    if (render && page) {
      const pdfName = `${year} CSP-J真题卷（已根据新题型改编）.pdf`;
      const pdfPath = path.join(pdfDir, pdfName);
      if (fs.existsSync(pdfPath)) {
        const outPng = path.join(outDir, `${stem}--p${page}.png`);
        // 用 pymupdf 渲染
        const { execSync } = require('child_process');
        try {
          execSync(
            `python -c "import pymupdf; d=pymupdf.open(r'${pdfPath}'); pix=d[${page - 1}].get_pixmap(dpi=300); pix.save(r'${outPng}')"`,
            { stdio: 'pipe' }
          );
          imgPath = outPng;
        } catch (e) {
          imgPath = `[render failed: ${e.message}]`;
        }
      } else {
        imgPath = `[pdf not found: ${pdfPath}]`;
      }
    }
    console.log('========================================');
    console.log(`FILE: ${f}`);
    console.log(`SCENE: ${s.title}`);
    console.log(`ORIGINAL PDF PAGE: ${page || '(unknown)'}`);
    console.log(`RENDERED IMAGE: ${imgPath || '(run with --render to generate)'}`);
    console.log('--- MY CODE ---');
    console.log(code);
    console.log('');
  }
}
console.log(`\n[summary] ${total} codeBlock scenes scanned.`);
