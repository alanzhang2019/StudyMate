/**
 * batch-crop-and-link.mjs
 *
 * 原型 (阶段 4/4): 一次性跑完 N 套 CSP 真题卷的 "裁图 + 注入" 链路。
 *
 * 工作流总览:
 *   1. extract-figures.mjs           → 渲染 PDF 整页 PNG (一次性, 一套卷跑一次)
 *   2. crop-figure.mjs               → 裁出单题图 (单条 CLI)
 *   3. inject-figures.mjs            → 写 question.image 字段
 *   4. link-figures-to-questions.mjs → 串起 2+3
 *   5. **本脚本**                    → 把 N 套卷的 link 任务派发出去
 *
 * 用法:
 *
 *   # 默认: 跑完整 24 套
 *   node scripts/figures-extractor/batch-crop-and-link.mjs \
 *     --manifest scripts/figures-extractor/batch-manifest.example.json
 *
 *   # 预览 (不真写)
 *   node scripts/figures-extractor/batch-crop-and-link.mjs \
 *     --manifest <path> --dry-run
 *
 *   # 只跑 J 组 (在 manifest 里只列 J 的 papers, 或者用 --filter)
 *   node scripts/figures-extractor/batch-crop-and-link.mjs \
 *     --manifest <path> --filter '^J$'
 *
 *   # 单套 (按 classroomId 选)
 *   node scripts/figures-extractor/batch-crop-and-link.mjs \
 *     --manifest <path> --only cm_imp_cspj2021j_v1
 *
 * Batch manifest 格式 (scripts/figures-extractor/batch-manifest.example.json):
 *   {
 *     "_comment": "每套卷一条 paper, entries 留空表示跳过该套. link 阶段会自己 spawn link-figures 串行处理.",
 *     "papers": [
 *       {
 *         "name":         "2014 J",
 *         "classroomId":  "cm_imp_cspj2014j_v1",
 *         "pageDir":      "public/figures/csp-j-2014",
 *         "prefix":       "cspj2014",
 *         "publicUrlBase": "/figures/csp-j-2014",   // 可选, 默认 = /<pageDir 末段>
 *         "pdf":          "public/csp-j-2014-original.pdf",  // 可选, 仅供人类阅读
 *         "entries": [
 *           {
 *             "page": 5,
 *             "left": 100, "top": 200, "right": 400, "bottom": 500,
 *             "pad": 10,                            // 可选, 默认 10
 *             "figureName": "cspj2014-q3-figure.png",  // 可选, 默认 = <prefix>-q<id>-figure.png
 *             "sceneId": "sc_cspj14j_choice",       // 可选
 *             "questionId": "q3",
 *             "imageCaption": "图: ..."
 *           }
 *         ]
 *       },
 *       ...
 *     ]
 *   }
 *
 * 串行 vs 并行:
 *   - 串行: 出错定位简单, 输出顺序稳定, 适合开发期
 *   - 不做并行: sharp + 文件写并发在 Windows 上偶尔会报 EBUSY, 不值得冒这个险
 *   - 如果以后真要并行, 改 spawnSinglePaper 为 Promise.allSettled 即可
 *
 * 跳过策略:
 *   - paper.entries 为空 → 跳过该 paper, 标记 "skip (no entries)"
 *   - paper.pageDir 不存在 → 跳过该 paper, 标记 "skip (pageDir missing)"
 *   - 任一 paper 出错 → 记录, 不中断后续 paper, 最后退出码 1
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LINK_SCRIPT = path.join(__dirname, 'link-figures-to-questions.mjs');

// ── args ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    manifest: null,
    dryRun: false,
    filter: null, // 正则, paper.name 匹配才跑
    only: null, // 单个 classroomId, 只跑这一个 paper
    continueOnError: true, // 任一 paper 失败是否继续. 这里硬编码 true, 后续可加 flag
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case '--manifest':
      case '-m':
        opts.manifest = args[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--filter':
        opts.filter = new RegExp(args[++i]);
        break;
      case '--only':
        opts.only = args[++i];
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[batch] 未知参数: ${a}`);
        printHelp();
        process.exit(1);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`用法:
  node scripts/figures-extractor/batch-crop-and-link.mjs --manifest <path> [--dry-run] [--filter <regex>] [--only <classroomId>]`);
}

// ── 单套 paper: 写临时 manifest, spawn link-figures ────────────────────────

async function processOnePaper(paper, opts) {
  // 1. 过滤
  if (opts.only && paper.classroomId !== opts.only) {
    return { paper, status: 'skip', reason: '--only 过滤' };
  }
  if (opts.filter && !opts.filter.test(paper.name || '')) {
    return { paper, status: 'skip', reason: '--filter 不匹配' };
  }

  // 2. 空 entries 跳过
  if (!Array.isArray(paper.entries) || paper.entries.length === 0) {
    return { paper, status: 'skip', reason: 'no entries' };
  }

  // 3. pageDir 存在性 (best-effort 检查, link-figures 内部还会再查)
  const pageDir = path.resolve(paper.pageDir || '');
  if (pageDir) {
    try {
      await fs.access(pageDir);
    } catch {
      return {
        paper,
        status: 'skip',
        reason: `pageDir 不存在: ${pageDir}  (先跑 extract-figures.mjs)`,
      };
    }
  }

  // 4. 写临时 link manifest
  // 注意: link-figures 内部从每个 entry 里读 classroomId / sceneId,
  // 所以这里要把 paper 级的 classroomId / sceneId 注入到每个 entry.
  // (paper 级保留一份只是方便人类阅读, 不是 link-figures 的输入约定)
  const linkEntries = (paper.entries || []).map((e) => ({
    classroomId: paper.classroomId,
    sceneId: e.sceneId ?? paper.sceneId, // entry 优先, 没有再退回 paper 级
    ...e,
  }));
  const linkManifest = {
    _source: 'batch-crop-and-link.mjs',
    _paper: paper.name,
    _classroomId: paper.classroomId,
    pageDir: paper.pageDir,
    prefix: paper.prefix,
    publicUrlBase: paper.publicUrlBase,
    entries: linkEntries,
  };
  const tmpPath = path.join(
    process.cwd(),
    `.batch-link-${process.pid}-${Date.now()}-${(paper.classroomId || '').replace(/[^a-z0-9]/gi, '_')}.tmp.json`,
  );
  await fs.writeFile(tmpPath, JSON.stringify(linkManifest, null, 2) + '\n', 'utf-8');

  // 5. spawn link-figures
  const args = [LINK_SCRIPT, '--manifest', tmpPath];
  if (opts.dryRun) args.push('--dry-run');

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', async (code) => {
      try {
        await fs.unlink(tmpPath);
      } catch {
        // ignore
      }
      // 解析 stdout 找 link-figures 的 "汇总" 行
      const summary = parseLinkSummary(stdout);
      resolve({
        paper,
        status: code === 0 ? 'ok' : 'error',
        code,
        summary,
        stdout,
        stderr,
      });
    });
    child.on('error', async (err) => {
      try {
        await fs.unlink(tmpPath);
      } catch {
        // ignore
      }
      resolve({ paper, status: 'error', code: -1, err: err.message, stderr });
    });
  });
}

/**
 * 从 link-figures 的 stdout 里抓 "汇总" 行. 失败时返回 null.
 * 期望格式 (由 link-figures 拼出来, 来自 inject-figures):
 *   "汇总: add=0 update=1 skip=0 dry-run=0 error=0"
 *   "退出码 = 0  (crop ok=1 err=0  inject code=0)"
 */
function parseLinkSummary(stdout) {
  const sum = stdout.match(/汇总:\s*add=(\d+)\s+update=(\d+)\s+skip=(\d+)\s+dry-run=(\d+)\s+error=(\d+)/);
  const crop = stdout.match(/crop ok=(\d+)\s+err=(\d+)/);
  if (!sum) return null;
  return {
    add: Number(sum[1]),
    update: Number(sum[2]),
    skip: Number(sum[3]),
    dryRun: Number(sum[4]),
    error: Number(sum[5]),
    cropOk: crop ? Number(crop[1]) : null,
    cropErr: crop ? Number(crop[2]) : null,
  };
}

// ── 入口 ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  if (!opts.manifest) {
    printHelp();
    process.exit(1);
  }

  // 1. 读 batch manifest
  const manifestPath = path.resolve(opts.manifest);
  let manifest;
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw.replace(/^\ufeff/, ''));
  } catch (err) {
    console.error(`[batch] 读 manifest 失败: ${manifestPath} - ${err.message}`);
    process.exit(1);
  }
  const papers = Array.isArray(manifest.papers) ? manifest.papers : [];
  if (papers.length === 0) {
    console.error('[batch] manifest 必须含至少 1 条 paper');
    process.exit(1);
  }

  console.log(`[batch] manifest = ${manifestPath}`);
  console.log(`[batch] papers   = ${papers.length}`);
  if (opts.only) console.log(`[batch] --only   = ${opts.only}`);
  if (opts.filter) console.log(`[batch] --filter = ${opts.filter}`);
  if (opts.dryRun) console.log('[batch] DRY-RUN 模式, 不会写文件');

  // 2. classroomId 唯一性校验
  const seenClassroom = new Set();
  const dupClassrooms = [];
  for (const p of papers) {
    if (p.classroomId) {
      if (seenClassroom.has(p.classroomId)) dupClassrooms.push(p.classroomId);
      seenClassroom.add(p.classroomId);
    }
  }
  if (dupClassrooms.length > 0) {
    console.error(
      `[batch] 警告: classroomId 重复, 仅第一次出现会被处理: ${[...new Set(dupClassrooms)].join(', ')}`,
    );
  }

  // 3. 串行跑
  const results = [];
  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    const tag = `${paper.name || '?'} [${paper.classroomId || '?'}]`;
    process.stdout.write(`\n──── paper ${i + 1}/${papers.length}: ${tag} ────\n`);
    const r = await processOnePaper(paper, opts);
    results.push(r);
    if (r.status === 'skip') {
      console.log(`  [skip] ${r.reason || ''}`);
    } else if (r.status === 'ok') {
      // link-figures 已经把详细结果打过了, 这里只补一行
      const s = r.summary;
      const sStr = s
        ? `add=${s.add} update=${s.update} skip=${s.skip} error=${s.error}  crop ok=${s.cropOk} err=${s.cropErr}`
        : '(no summary parsed)';
      console.log(`  [ok  ] ${sStr}`);
    } else {
      console.error(`  [err ] code=${r.code}  ${r.err || r.stderr || ''}`);
    }
  }

  // 4. 汇总
  const counts = { ok: 0, error: 0, skip: 0 };
  const tot = { add: 0, update: 0, skip: 0, error: 0, cropOk: 0, cropErr: 0 };
  for (const r of results) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    if (r.summary) {
      tot.add += r.summary.add;
      tot.update += r.summary.update;
      tot.skip += r.summary.skip;
      tot.error += r.summary.error;
      tot.cropOk += r.summary.cropOk || 0;
      tot.cropErr += r.summary.cropErr || 0;
    }
  }

  console.log('\n════ 总汇总 ════');
  console.log(`papers: ok=${counts.ok} err=${counts.error} skip=${counts.skip}`);
  console.log(
    `entries: add=${tot.add} update=${tot.update} skip=${tot.skip} error=${tot.error}`,
  );
  console.log(`crop:    ok=${tot.cropOk} err=${tot.cropErr}`);

  // 5. 表格化展示每个 paper 的结果
  console.log('\n──── 明细 ────');
  const w = { name: 14, cls: 26, st: 6, add: 4, upd: 4, skp: 4, err: 4, crop: 8 };
  const pad = (s, n) => String(s).padEnd(n);
  const padL = (s, n) => String(s).padStart(n);
  console.log(
    [pad('PAPER', w.name), pad('CLASSROOM', w.cls), pad('STATUS', w.st),
     padL('add', w.add), padL('upd', w.upd), padL('skp', w.skp), padL('err', w.err),
     padL('crop', w.crop)].join(' '),
  );
  console.log('-'.repeat(w.name + w.cls + w.st + w.add + w.upd + w.skp + w.err + w.crop + 7));
  for (const r of results) {
    const s = r.summary;
    console.log(
      [
        pad(r.paper.name || '?', w.name),
        pad(r.paper.classroomId || '?', w.cls),
        pad(r.status, w.st),
        padL(s ? s.add : '-', w.add),
        padL(s ? s.update : '-', w.upd),
        padL(s ? s.skip : '-', w.skp),
        padL(s ? s.error : '-', w.err),
        padL(s ? `${s.cropOk}/${s.cropErr}` : '-', w.crop),
      ].join(' '),
    );
  }

  // 6. 退出码
  process.exit(counts.error > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[batch] 失败:', err);
  process.exit(1);
});
