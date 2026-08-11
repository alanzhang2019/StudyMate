/**
 * inject-figures.mjs
 *
 * 原型 (阶段 2/3): 把已经裁好的单题图 (image + imageCaption) 注入
 * 到对应 classroom JSON 的 question 节点。
 *
 * 工作流:
 *   1. extract-figures.mjs   → 渲染 PDF 整页 PNG 到 public/figures/...
 *   2. crop-figure.mjs       → 按坐标裁出单题图, 命名 cspj2021-q14-figure.png
 *   3. **本脚本**            → 把图路径写回对应 question.image 字段
 *   4. quiz-view.tsx 渲染     → <figure> 区块出现在题文和选项之间
 *
 * 用法:
 *
 *   # 批量 (推荐): 准备一个 manifest, 一次性灌多条
 *   node scripts/figures-extractor/inject-figures.mjs \
 *     --manifest data/figures-manifest.json
 *
 *   # 预览 (不写文件):
 *   node scripts/figures-extractor/inject-figures.mjs \
 *     --manifest data/figures-manifest.json --dry-run
 *
 *   # 单条 (临时修补):
 *   node scripts/figures-extractor/inject-figures.mjs \
 *     --classroom cm_imp_cspj2021j_v1 \
 *     --question q14 \
 *     --image   /figures/csp-j-2021/cspj2021-q14-figure.png \
 *     --caption "图: 5 个点的无向图 (a, b, c, d, e)"
 *
 *   # 扫描: 列出当前所有已有 image 字段的 question
 *   node scripts/figures-extractor/inject-figures.mjs --list
 *
 * Manifest 格式 (data/figures-manifest.json):
 *   {
 *     "entries": [
 *       {
 *         "classroomId":  "cm_imp_cspj2021j_v1",
 *         "sceneId":      "sc_cspj21j_choice",  // 可选, 不填则全 scene 扫描
 *         "questionId":   "q14",
 *         "image":        "/figures/csp-j-2021/cspj2021-q14-figure.png",
 *         "imageCaption": "图: 5 个点的无向图 (a, b, c, d, e)"  // 可选
 *       }
 *     ]
 *   }
 *
 * Classroom 路径解析:
 *   1. $STUDYMATE_DB_DIR/classrooms/<id>.json
 *   2. <cwd>/data/classrooms/<id>.json
 *   3. <script 上两级>/data/classrooms/<id>.json  (脚本在 frontend/scripts/...)
 *   跟 lib/server/classroom-storage.ts 的 CLASSROOMS_DIR 解析顺序一致。
 *
 * 幂等性:
 *   - 字段值已存在且 == 期望值 → "skip, already set"
 *   - 字段值已存在但 != 期望值 → "update" (除非加 --strict 表示报错退出)
 *   - 字段不存在                → "add"
 *
 * 校验:
 *   - classroom JSON 必须存在
 *   - scene (如指定) 必须存在
 *   - question.id 必须存在
 *   - 物理图片文件 (去掉前导 / 后拼到 <frontend>/public) 必须存在
 *     (缺图时不阻断注入, 只 warn, 因为开发期经常先生成 JSON 再补图)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// frontend/scripts/figures-extractor/  →  frontend/
const FRONTEND_DIR = path.resolve(__dirname, '..', '..');

// ── args ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    manifest: null,
    classroom: null,
    question: null,
    image: null,
    caption: null,
    sceneId: null,
    dryRun: false,
    list: false,
    strict: false, // 字段已存在且值不同时, 报错退出而不是覆盖
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case '--manifest':
      case '-m':
        opts.manifest = args[++i];
        break;
      case '--classroom':
      case '-c':
        opts.classroom = args[++i];
        break;
      case '--question':
      case '-q':
        opts.question = args[++i];
        break;
      case '--image':
      case '-i':
        opts.image = args[++i];
        break;
      case '--caption':
        opts.caption = args[++i];
        break;
      case '--scene':
        opts.sceneId = args[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--list':
        opts.list = true;
        break;
      case '--strict':
        opts.strict = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[inject-figures] 未知参数: ${a}`);
        printHelp();
        process.exit(1);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`用法:
  node scripts/figures-extractor/inject-figures.mjs --manifest <path> [--dry-run]
  node scripts/figures-extractor/inject-figures.mjs --classroom <id> --question <qid> --image <url> [--caption <text>] [--scene <sid>] [--dry-run]
  node scripts/figures-extractor/inject-figures.mjs --list`);
}

// ── classroom 路径解析 ──────────────────────────────────────────────────────

function resolveClassroomsDir() {
  if (process.env.STUDYMATE_DB_DIR) {
    return path.join(process.env.STUDYMATE_DB_DIR, 'classrooms');
  }
  // cwd 优先, 因为 npm scripts 通常在 frontend/ 下运行
  const cwdBased = path.join(process.cwd(), 'data', 'classrooms');
  return cwdBased;
}

function resolveClassroomPath(id, dir) {
  return path.join(dir, `${id}.json`);
}

function resolvePublicDir() {
  return path.join(FRONTEND_DIR, 'public');
}

function resolveImageOnDisk(publicDir, imageUrl) {
  if (!imageUrl) return null;
  // imageUrl 形如 "/figures/csp-j-2021/cspj2021-q14-figure.png"
  // 去掉前导 /, 拼到 publicDir
  const rel = imageUrl.replace(/^\/+/, '');
  return path.join(publicDir, rel);
}

// ── 工具: 原子写 ────────────────────────────────────────────────────────────

async function writeJsonAtomic(filePath, data) {
  // 临时文件 + rename, 避免中途崩溃留半截 JSON。
  // Windows 下 rename 到已存在的目标偶发失败 (EPERM/EEXIST),
  // 退化为 copy + unlink 兜底。
  //
  // 风格细节: 仓库里其他 classroom JSON **不带**尾换行 (用 git diff
  // 经常看到 "No newline at end of file"), 所以默认也不加。
  // 但如果原文件已经有尾换行, 我们也保留, 保持最小改动。
  const original = await fs.readFile(filePath, 'utf-8');
  const hadTrailingNewline = original.endsWith('\n');
  const body = JSON.stringify(data, null, 2) + (hadTrailingNewline ? '\n' : '');
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, body, 'utf-8');
  try {
    await fs.rename(tmp, filePath);
  } catch (err) {
    const code = err && err.code;
    if (code === 'EEXIST' || code === 'EPERM' || code === 'EACCES') {
      await fs.copyFile(tmp, filePath);
      await fs.unlink(tmp);
    } else {
      throw err;
    }
  }
}

// ── 找 question ─────────────────────────────────────────────────────────────

/**
 * 在 classroom.scenes[].content.questions[] 里按 id 找 question。
 * 顺带返回所在 scene 的 id, 方便日志。
 * sceneId 可选; 提供时只在该 scene 里找, 找不到报错。
 * 不提供时跨 scene 找第一个匹配。
 */
function findQuestion(classroom, questionId, sceneId) {
  const scenes = Array.isArray(classroom.scenes) ? classroom.scenes : [];
  const matches = [];
  for (const s of scenes) {
    if (sceneId && s.id !== sceneId) continue;
    const c = s.content;
    if (!c || c.type !== 'quiz' || !Array.isArray(c.questions)) continue;
    for (const q of c.questions) {
      if (q && q.id === questionId) {
        matches.push({ scene: s, question: q });
      }
    }
  }
  if (matches.length === 0) return null;
  if (matches.length > 1 && !sceneId) {
    // 多 scene 都用了同一个 id (罕见, 但 read1/read2 不同 scene 可能 q1 都叫 q1),
    // 不指定 sceneId 就退到第一个, 给出 warning
    return { ...matches[0], ambiguous: true, count: matches.length };
  }
  return matches[0];
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

async function processEntry(entry, opts, ctx) {
  const { classroomId, sceneId, questionId, image, imageCaption } = entry;
  const tag = `${classroomId}/${sceneId || '*'}/${questionId}`;

  if (!classroomId || !questionId || !image) {
    return { tag, status: 'error', message: '缺少 classroomId / questionId / image' };
  }

  // 1. 读 classroom JSON
  const classroomPath = resolveClassroomPath(classroomId, ctx.classroomsDir);
  let raw;
  try {
    raw = await fs.readFile(classroomPath, 'utf-8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return { tag, status: 'error', message: `找不到 classroom 文件: ${classroomPath}` };
    }
    throw err;
  }
  // PowerShell ConvertTo-Json 会吐 BOM, 跟 classroom-storage.ts 一样 strip 一下
  const json = raw.replace(/^\ufeff/, '');
  let classroom;
  try {
    classroom = JSON.parse(json);
  } catch (err) {
    return { tag, status: 'error', message: `JSON 解析失败: ${err.message}` };
  }

  // 2. 找 question
  const found = findQuestion(classroom, questionId, sceneId);
  if (!found) {
    return { tag, status: 'error', message: `找不到 question id=${questionId}${sceneId ? ` in scene=${sceneId}` : ''}` };
  }
  const { question, scene, ambiguous } = found;

  // 3. 校验物理图片 (best-effort, 缺图不阻断)
  const imageOnDisk = resolveImageOnDisk(ctx.publicDir, image);
  let imageExists = null;
  if (imageOnDisk) {
    try {
      await fs.access(imageOnDisk);
      imageExists = true;
    } catch {
      imageExists = false;
    }
  }

  // 4. 对比已有字段
  const prevImage = question.image;
  const prevCaption = question.imageCaption;
  const sameImage = prevImage === image;
  // caption 允许 undefined → 设值, 也算 "add"; 但已有 caption 与期望相同则 skip
  const sameCaption = (prevCaption || '') === (imageCaption || '');

  if (sameImage && sameCaption) {
    return {
      tag,
      status: 'skip',
      message: '字段已是目标值',
      sceneId: scene.id,
      image,
      imageExists,
    };
  }

  // 字段存在但不一致, --strict 下报错
  if (opts.strict && (prevImage || prevCaption)) {
    return {
      tag,
      status: 'error',
      message: `已有值与目标不同 (--strict 拒绝覆盖): prev.image=${prevImage || '∅'} new.image=${image}`,
    };
  }

  // 5. 写入
  question.image = image;
  if (imageCaption !== undefined) {
    question.imageCaption = imageCaption;
  } else if (prevCaption === undefined) {
    // 既无旧值, manifest 也没给 caption, 不强行塞空串
    delete question.imageCaption;
  }

  if (opts.dryRun) {
    return {
      tag,
      status: 'dry-run',
      message: ambiguous
        ? `将写入 (警告: 跨 ${ambiguous.count} 个 scene 都有 id=${questionId}, 已选第 1 个)`
        : '将写入',
      sceneId: scene.id,
      prevImage: prevImage || '∅',
      newImage: image,
      imageExists,
    };
  }

  await writeJsonAtomic(classroomPath, classroom);

  return {
    tag,
    status: prevImage ? 'update' : 'add',
    message: ambiguous
      ? `已写入 (警告: 跨 ${ambiguous.count} 个 scene 都有 id=${questionId}, 已选第 1 个)`
      : `已${prevImage ? '更新' : '新增'}`,
    sceneId: scene.id,
    prevImage: prevImage || '∅',
    newImage: image,
    imageExists,
  };
}

// ── 入口 ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const classroomsDir = resolveClassroomsDir();
  const publicDir = resolvePublicDir();
  const ctx = { classroomsDir, publicDir };

  console.log(`[inject-figures] classroomsDir = ${classroomsDir}`);
  console.log(`[inject-figures] publicDir     = ${publicDir}`);

  // 模式 1: --list 扫描
  if (opts.list) {
    return runList(ctx);
  }

  // 模式 2: 单条 CLI
  let entries = [];
  if (opts.classroom || opts.question || opts.image) {
    if (!opts.classroom || !opts.question || !opts.image) {
      console.error('[inject-figures] 单条模式必须同时指定 --classroom / --question / --image');
      process.exit(1);
    }
    entries.push({
      classroomId: opts.classroom,
      sceneId: opts.sceneId,
      questionId: opts.question,
      image: opts.image,
      imageCaption: opts.caption,
    });
  } else if (opts.manifest) {
    // 模式 3: manifest 批量
    const manifestPath = path.resolve(opts.manifest);
    let raw;
    try {
      raw = await fs.readFile(manifestPath, 'utf-8');
    } catch (err) {
      console.error(`[inject-figures] 读 manifest 失败: ${manifestPath} - ${err.message}`);
      process.exit(1);
    }
    let manifest;
    try {
      manifest = JSON.parse(raw.replace(/^\ufeff/, ''));
    } catch (err) {
      console.error(`[inject-figures] manifest JSON 解析失败: ${err.message}`);
      process.exit(1);
    }
    if (!Array.isArray(manifest.entries)) {
      console.error('[inject-figures] manifest 必须含 entries: [...] 数组');
      process.exit(1);
    }
    entries = manifest.entries;
    console.log(`[inject-figures] manifest = ${manifestPath} (${entries.length} 条)`);
  } else {
    printHelp();
    process.exit(1);
  }

  if (opts.dryRun) {
    console.log('[inject-figures] DRY-RUN 模式, 不会写文件');
  }

  // 跑
  const results = [];
  for (const e of entries) {
    const r = await processEntry(e, opts, ctx);
    results.push(r);
  }

  // 汇总
  const counts = { add: 0, update: 0, skip: 0, 'dry-run': 0, error: 0 };
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;

  console.log('\n──── 结果 ────');
  for (const r of results) {
    const flag = r.imageExists === false ? '  ⚠ 缺图' : '';
    const ambig = r.message && r.message.includes('警告') ? '  ⚠ ambiguous' : '';
    console.log(
      `  [${r.status.padEnd(7)}] ${r.tag}${flag}${ambig}\n             ${r.message}`,
    );
  }
  console.log(
    `\n汇总: add=${counts.add} update=${counts.update} skip=${counts.skip}` +
      ` dry-run=${counts['dry-run']} error=${counts.error}`,
  );

  // 任一 error 退出码 1
  if (counts.error > 0) process.exit(1);
}

// ── --list 模式: 扫所有 classroom, 列出有 image 字段的 question ─────────────

async function runList(ctx) {
  let entries;
  try {
    entries = await fs.readdir(ctx.classroomsDir);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.error(`[inject-figures] 目录不存在: ${ctx.classroomsDir}`);
      process.exit(1);
    }
    throw err;
  }
  const jsonFiles = entries.filter((n) => n.endsWith('.json')).sort();
  console.log(`[inject-figures] 扫描 ${jsonFiles.length} 个 classroom JSON`);

  const rows = [];
  for (const f of jsonFiles) {
    const filePath = path.join(ctx.classroomsDir, f);
    let data;
    try {
      data = JSON.parse((await fs.readFile(filePath, 'utf-8')).replace(/^\ufeff/, ''));
    } catch (err) {
      console.error(`  跳过 ${f}: ${err.message}`);
      continue;
    }
    const id = data.id || f.replace(/\.json$/, '');
    for (const s of data.scenes || []) {
      const c = s.content;
      if (!c || c.type !== 'quiz' || !Array.isArray(c.questions)) continue;
      for (const q of c.questions) {
        if (q && q.image) {
          const imgOnDisk = resolveImageOnDisk(ctx.publicDir, q.image);
          let exists = '?';
          if (imgOnDisk) {
            try {
              await fs.access(imgOnDisk);
              exists = '✓';
            } catch {
              exists = '✗';
            }
          }
          rows.push({
            classroom: id,
            scene: s.id,
            qid: q.id,
            image: q.image,
            caption: q.imageCaption || '',
            fileExists: exists,
          });
        }
      }
    }
  }

  if (rows.length === 0) {
    console.log('\n(没有 question 携带 image 字段)');
    return;
  }

  console.log(`\n找到 ${rows.length} 个带 image 字段的 question:\n`);
  // 简易对齐表格
  const header = ['CLASSROOM', 'SCENE', 'QID', 'IMG?', 'IMAGE', 'CAPTION'];
  const widths = [22, 22, 6, 4, 50, 30];
  console.log(
    header
      .map((h, i) => h.padEnd(widths[i]))
      .join(' '),
  );
  console.log(widths.map((w) => '-'.repeat(w)).join(' '));
  for (const r of rows) {
    const cap = (r.caption || '').slice(0, widths[5] - 1);
    const img = r.image.length > widths[4] - 1 ? r.image.slice(0, widths[4] - 2) + '…' : r.image;
    console.log(
      [
        r.classroom.padEnd(widths[0]),
        r.scene.padEnd(widths[1]),
        r.qid.padEnd(widths[2]),
        r.fileExists.padEnd(widths[3]),
        img.padEnd(widths[4]),
        cap.padEnd(widths[5]),
      ].join(' '),
    );
  }
}

main().catch((err) => {
  console.error('[inject-figures] 失败:', err);
  process.exit(1);
});
