/**
 * link-figures-to-questions.mjs
 *
 * 原型 (阶段 3/3): 把"裁剪单题图"和"注入到 classroom JSON"
 * 两个步骤串成一条命令。
 *
 * 工作流总览:
 *   1. extract-figures.mjs    → 渲染 PDF 整页 PNG
 *   2. crop-figure.mjs         → 按坐标裁出单题图
 *   3. inject-figures.mjs      → 把图路径写回 question.image
 *   4. **本脚本**             → 串起 2 + 3, 单条 manifest 一次跑完
 *
 * 为什么串起来:
 *   - 一份 manifest 同时含"裁剪坐标"和"目标 question", 维护成本低
 *   - 减少手工拼路径: 不用先 crop 再写 JSON manifest 再 inject
 *   - 同一份 manifest 多次跑是幂等的 (crop 覆盖旧图, inject 检测已有值)
 *
 * 用法:
 *
 *   # 默认: 跑完整链路 (crop + inject)
 *   node scripts/figures-extractor/link-figures-to-questions.mjs \
 *     --manifest scripts/figures-extractor/link-manifest.example.json
 *
 *   # 只裁不注入 (--crop-only)
 *   node scripts/figures-extractor/link-figures-to-questions.mjs \
 *     --manifest <path> --crop-only
 *
 *   # 只注入不裁 (--inject-only, 假设图已存在, 只更新 JSON)
 *   node scripts/figures-extractor/link-figures-to-questions.mjs \
 *     --manifest <path> --inject-only
 *
 *   # 全链路预览 (--dry-run): 裁剪仍然真做 (方便核对),
 *   #   但 inject 走 --dry-run, JSON 不写
 *   node scripts/figures-extractor/link-figures-to-questions.mjs \
 *     --manifest <path> --dry-run
 *
 * Manifest 格式 (scripts/figures-extractor/link-manifest.example.json):
 *   {
 *     "_comment": "源页 PNG 来自 extract-figures.mjs 渲染的整页图, 默认在 <outDir>/<prefix>-pN.png",
 *     "pageDir":   "public/figures/csp-j-2021",
 *     "prefix":    "cspj2021",
 *     "publicUrlBase": "/figures/csp-j-2021",  // 默认 = /<pageDir 末段>, 见 resolvePublicUrl
 *     "entries": [
 *       {
 *         "page":  4,
 *         "left":  620, "top": 510, "right": 920, "bottom": 870,
 *         "pad":   15,                       // 可选, 默认 10
 *         "figureName": "cspj2021-q14-figure.png",  // 可选, 默认 = <prefix>-q<id>-figure.png
 *         "classroomId":  "cm_imp_cspj2021j_v1",
 *         "sceneId":      "sc_cspj21j_choice",  // 可选
 *         "questionId":   "q14",
 *         "imageCaption": "图: 5 个点的无向图 (a, b, c, d, e)"  // 可选
 *       }
 *     ]
 *   }
 *
 * 串联机制:
 *   1. 对每个 entry, 用 sharp 直接裁, 输出到 <pageDir>/<figureName>
 *   2. 在内存里组装一个 inject-figures 兼容的 manifest (entries 数组)
 *   3. 写到 <pageDir>/.link-inject-<pid>.json 临时文件
 *   4. spawn `node inject-figures.mjs --manifest <tmp> [--dry-run]`
 *   5. 解析子进程退出码, 汇总打印
 *
 *   之所以用子进程而不是直接调函数: 让 inject-figures 保持独立可执行,
 *   link 是纯胶水, 不引入额外耦合。
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..', '..');
const INJECT_SCRIPT = path.join(__dirname, 'inject-figures.mjs');

// ── args ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    manifest: null,
    cropOnly: false,
    injectOnly: false,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case '--manifest':
      case '-m':
        opts.manifest = args[++i];
        break;
      case '--crop-only':
        opts.cropOnly = true;
        break;
      case '--inject-only':
        opts.injectOnly = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[link-figures] 未知参数: ${a}`);
        printHelp();
        process.exit(1);
    }
  }
  if (opts.cropOnly && opts.injectOnly) {
    console.error('[link-figures] --crop-only 和 --inject-only 互斥');
    process.exit(1);
  }
  return opts;
}

function printHelp() {
  console.log(`用法:
  node scripts/figures-extractor/link-figures-to-questions.mjs --manifest <path> [--crop-only|--inject-only] [--dry-run]`);
}

// ── 工具 ────────────────────────────────────────────────────────────────────

function deriveFigureName(prefix, entry) {
  if (entry.figureName && typeof entry.figureName === 'string') return entry.figureName;
  return `${prefix}-q${entry.questionId}-figure.png`;
}

function resolvePublicUrl(publicUrlBase, figureName) {
  // /figures/csp-j-2021  +  cspj2021-q14-figure.png
  // → /figures/csp-j-2021/cspj2021-q14-figure.png
  const base = publicUrlBase || '';
  const sep = base.endsWith('/') ? '' : '/';
  return `${base}${sep}${figureName}`;
}

// ── 裁剪 (sharp 直接做, 不调子进程) ─────────────────────────────────────────

async function cropEntry(entry, pageDir, figureName) {
  const inputPath = path.join(pageDir, `${entry._prefix}-p${entry.page}.png`);
  const outputPath = path.join(pageDir, figureName);
  const pad = entry.pad ?? 10;

  // 1. 源页必须存在
  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`源页 PNG 不存在: ${inputPath}  (先跑 extract-figures.mjs)`);
  }

  // 2. 读尺寸, 做边界保护
  const meta = await sharp(inputPath).metadata();
  const W = meta.width;
  const H = meta.height;
  const x = Math.max(0, entry.left - pad);
  const y = Math.max(0, entry.top - pad);
  const w = Math.min(W - x, entry.right - entry.left + pad * 2);
  const h = Math.min(H - y, entry.bottom - entry.top + pad * 2);
  if (w <= 0 || h <= 0) {
    throw new Error(`裁剪区域非法: x=${x} y=${y} w=${w} h=${h} (源 ${W}x${H})`);
  }

  // 3. 裁剪
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(inputPath)
    .extract({ left: x, top: y, width: w, height: h })
    .png()
    .toFile(outputPath);

  return {
    outputPath,
    width: w,
    height: h,
    sourceMeta: { width: W, height: H },
    pad,
  };
}

// ── 注入 (spawn inject-figures.mjs) ─────────────────────────────────────────

async function injectEntries(entries, { dryRun }) {
  if (entries.length === 0) return { ok: true, stdout: '', stderr: '' };

  // 临时 manifest 写到第一个 entry 的 pageDir 旁边, 注入完删掉。
  // 用 <pageDir>/.link-inject-<pid>.tmp.json 命名, 不会被 git 跟踪 (点开头)。
  // 这里我们用 process.cwd() 的相对位置, 避免硬编码绝对路径。
  // 实际上 inject-figures 接受任意路径, 我们直接写到 /tmp 即可, 但 Windows
  // 没有 /tmp, 所以写到 pageDir 同级的 .link-inject-<pid>.tmp.json。
  const tmpPath = path.join(
    process.cwd(),
    `.link-inject-${process.pid}-${Date.now()}.tmp.json`,
  );

  const tmpManifest = { _source: 'link-figures-to-questions.mjs', entries };
  await fs.writeFile(tmpPath, JSON.stringify(tmpManifest, null, 2) + '\n', 'utf-8');

  const args = [INJECT_SCRIPT, '--manifest', tmpPath];
  if (dryRun) args.push('--dry-run');

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', async (code) => {
      // 清理临时文件
      try {
        await fs.unlink(tmpPath);
      } catch {
        // 忽略
      }
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    child.on('error', async (err) => {
      try {
        await fs.unlink(tmpPath);
      } catch {
        // 忽略
      }
      resolve({ ok: false, code: -1, stdout, stderr: stderr + '\n' + err.message });
    });
  });
}

// ── 入口 ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  if (!opts.manifest) {
    printHelp();
    process.exit(1);
  }

  // 1. 读 manifest
  const manifestPath = path.resolve(opts.manifest);
  let manifest;
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw.replace(/^\ufeff/, ''));
  } catch (err) {
    console.error(`[link-figures] 读 manifest 失败: ${manifestPath} - ${err.message}`);
    process.exit(1);
  }

  const pageDir = path.resolve(manifest.pageDir || '');
  const prefix = manifest.prefix || path.basename(pageDir);
  const publicUrlBase = manifest.publicUrlBase || (pageDir ? `/${path.basename(pageDir)}` : '');
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

  if (!pageDir) {
    console.error('[link-figures] manifest 必须含 pageDir');
    process.exit(1);
  }
  if (entries.length === 0) {
    console.error('[link-figures] manifest 必须含至少 1 条 entry');
    process.exit(1);
  }

  // 把 prefix 挂到 entry 上, 方便 cropEntry 内部读
  for (const e of entries) e._prefix = prefix;

  console.log(`[link-figures] manifest   = ${manifestPath}`);
  console.log(`[link-figures] pageDir    = ${pageDir}`);
  console.log(`[link-figures] prefix     = ${prefix}`);
  console.log(`[link-figures] publicBase = ${publicUrlBase}`);
  console.log(`[link-figures] entries    = ${entries.length}`);
  if (opts.cropOnly) console.log('[link-figures] 模式: crop-only (跳过 inject)');
  if (opts.injectOnly) console.log('[link-figures] 模式: inject-only (跳过 crop)');
  if (opts.dryRun) console.log('[link-figures] DRY-RUN: crop 仍真做, inject 不写');

  // 2. 阶段 1: 裁剪
  const cropResults = []; // { entry, ok, err, figureName, path, width, height }
  if (!opts.injectOnly) {
    for (const e of entries) {
      const figureName = deriveFigureName(prefix, e);
      try {
        const r = await cropEntry(e, pageDir, figureName);
        cropResults.push({ entry: e, ok: true, figureName, ...r });
      } catch (err) {
        cropResults.push({ entry: e, ok: false, figureName, err: err.message });
      }
    }
  }

  // 3. 打印裁剪结果
  console.log('\n──── 阶段 1/2: 裁剪 ────');
  let cropOk = 0,
    cropErr = 0;
  for (const r of cropResults) {
    if (r.ok) {
      cropOk++;
      console.log(
        `  [crop OK  ] ${r.entry._prefix}-p${r.entry.page}.png → ${r.figureName}  (${r.width}x${r.height})`,
      );
    } else {
      cropErr++;
      console.error(
        `  [crop ERR ] ${r.entry._prefix}-p${r.entry.page}.png → ${r.figureName}  -- ${r.err}`,
      );
    }
  }
  console.log(`  裁剪汇总: ok=${cropOk} err=${cropErr}`);

  // 4. 阶段 2: 注入 (只对裁剪成功的 entry)
  let injectResult = { ok: true, code: 0, stdout: '', stderr: '' };
  if (!opts.cropOnly) {
    const okEntries = cropResults.filter((r) => r.ok).map((r) => r.entry);
    if (okEntries.length === 0) {
      console.log('\n──── 阶段 2/2: 注入 (跳过, 无可注入 entry) ────');
    } else {
      // 组装 inject-figures 格式的 manifest
      const injectEntries_ = okEntries.map((e) => {
        const figureName = deriveFigureName(prefix, e);
        return {
          classroomId: e.classroomId,
          sceneId: e.sceneId,
          questionId: e.questionId,
          image: resolvePublicUrl(publicUrlBase, figureName),
          imageCaption: e.imageCaption,
        };
      });
      console.log('\n──── 阶段 2/2: 注入 (spawn inject-figures.mjs) ────');
      injectResult = await injectEntries(injectEntries_, { dryRun: opts.dryRun });
      // inject-figures 自己已经打印了详细汇总, 这里透传它的 stdout
      // (去头去尾, 避免重复展示 manifest 路径)
      if (injectResult.stdout) {
        process.stdout.write(injectResult.stdout);
      }
      if (injectResult.stderr) {
        process.stderr.write(injectResult.stderr);
      }
    }
  } else {
    console.log('\n──── 阶段 2/2: 注入 (跳过, --crop-only) ────');
  }

  // 5. 总退出码
  const exitCode = cropErr > 0 || !injectResult.ok ? 1 : 0;
  console.log(
    `\n[link-figures] 退出码 = ${exitCode}  (crop ok=${cropOk} err=${cropErr}  inject code=${injectResult.code})`,
  );
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[link-figures] 失败:', err);
  process.exit(1);
});
