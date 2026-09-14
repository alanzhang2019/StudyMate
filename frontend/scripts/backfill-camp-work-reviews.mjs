#!/usr/bin/env node
/**
 * 一次性回填脚本：给 camp_works 里 approved 作品批量生成
 * 「老师点评 + 能力评估 + 创作记录」三块草稿，用 LLM 生成后写回数据库。
 *
 * 背景：详情页 2026-09-14 起支持展示这三块内容，但历史作品这三列是空的。
 * 本脚本基于作品的标题/分类/学员/介绍，让 LLM 生成一套初始草稿，
 * 老师在后台 `/admin/camp/works` 编辑微调后即可上线。
 *
 * 运行方式（在服务器上，脚本需先传进容器，因为 runner 镜像不含 scripts/）：
 *   cd /home/ubuntu/studymate
 *   git pull origin master
 *   docker compose cp frontend/scripts/backfill-camp-work-reviews.mjs frontend:/app/scripts/backfill-camp-work-reviews.mjs
 *   docker compose exec frontend node /app/scripts/backfill-camp-work-reviews.mjs --dry-run
 *   docker compose exec frontend node /app/scripts/backfill-camp-work-reviews.mjs
 *
 * 环境变量（容器内已由 docker-compose 配好）：KIMI_API_KEY / KIMI_BASE_URL / STUDYMATE_DB_DIR
 *
 * 参数：
 *   --dry-run   只打印「将要处理哪些作品」，不调 LLM、不写库
 *   --force     覆盖已存在的三块内容（默认跳过任何已有 teacherComment 的作品）
 *   --limit N   只处理前 N 个作品（默认全量）
 *   --model <id>  覆盖默认模型（默认 deepseek/deepseek-v4-flash-20260731）
 */

import Database from 'better-sqlite3';
import path from 'path';

// ---------- 配置 ----------
const DB_DIR = process.env.STUDYMATE_DB_DIR || '/tmp/studymate';
const DB_PATH = path.join(DB_DIR, 'studymate.sqlite');
const API_KEY = process.env.KIMI_API_KEY || '';
const BASE_URL = (process.env.KIMI_BASE_URL || 'https://api.qnaigc.com/v1').replace(/\/$/, '');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 0 : 0;
const modelIdx = args.indexOf('--model');
const MODEL = modelIdx >= 0 ? args[modelIdx + 1] : 'deepseek/deepseek-v4-flash-20260731';

const log = (msg) => console.log(`[backfill] ${msg}`);

// ---------- 工具 ----------
function parseJsonFromText(text) {
  if (!text) return null;
  let t = text.trim();
  // 剥离可能的 ```json ... ``` 代码块
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  // 若首尾被引号包裹，去掉
  if (t.startsWith('"') && t.endsWith('"')) {
    t = t.slice(1, -1).replace(/\\"/g, '"');
  }
  try {
    return JSON.parse(t);
  } catch {
    // 尝试从第一个 { 到最后一个 } 截取
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clampScores(scores) {
  const arr = Array.isArray(scores) ? scores : [];
  const out = [];
  for (let i = 0; i < 5; i++) {
    const n = Number(arr[i]);
    out.push(Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 7);
  }
  return out;
}

async function callModel(system, prompt) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.7,
    // 尽力关闭 deepseek 的思考链，让 content 直接出结果（即便上游忽略也无害）
    enable_thinking: false,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
      throw new Error('LLM 返回 content 为空');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT =
  '你是少年AI创造营的老师Alan张老师。请根据学生作品信息，生成三块内容，' +
  '严格输出一个 JSON 对象（不要 markdown 代码块、不要多余文字、不要解释）：\n' +
  '{\n' +
  '  "teacherComment": "老师点评，80-120字，面向家长，具体、暖心、有画面感，点出孩子最亮眼的特质",\n' +
  '  "ability": {\n' +
  '    "heading": "能力评估标题（例：小小游戏设计师）",\n' +
  '    "intro": "一句引言（例：用游戏点燃数学热情）",\n' +
  '    "note": "评估备注（例：* 评估基于课堂过程记录，非标准化测试。）",\n' +
  '    "scores": [创造力, 逻辑, 表达, 协作, 审美] 五个 0-10 的整数，基于孩子年龄和作品难度合理打分，不要全给满分\n' +
  '  },\n' +
  '  "processLog": [\n' +
  '    {"time":"第1次课","tag":"阶段标签","title":"小标题","description":"1-2句描述"},\n' +
  '    {"time":"第2次课","tag":"阶段标签","title":"小标题","description":"1-2句描述"},\n' +
  '    {"time":"第3次课","tag":"阶段标签","title":"小标题","description":"1-2句描述"}\n' +
  '  ]\n' +
  '}\n' +
  'processLog 给 3 条，按「想法 → 实现 → 打磨发布」的节奏写。';

// ---------- 主流程 ----------
function main() {
  if (!API_KEY) {
    log('错误：未检测到 KIMI_API_KEY，脚本无法调用 LLM。');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: false });

  // 确保三列存在（幂等 ALTER，防止数据库还没跑过新迁移）
  for (const [col, type] of [
    ['processLogJson', 'TEXT'],
    ['abilityJson', 'TEXT'],
    ['teacherComment', 'TEXT'],
  ]) {
    try {
      db.exec(`ALTER TABLE camp_works ADD COLUMN ${col} ${type}`);
    } catch {
      /* 列已存在 */
    }
  }

  // 检测列是否存在（旧库可能没有 grade 列，动态决定 SELECT 字段）
  const cols = db.prepare('PRAGMA table_info(camp_works)').all().map((c) => c.name);
  const hasGrade = cols.includes('grade');
  const gradeExpr = hasGrade ? 'grade' : "NULL AS grade";

  // 目标：approved 且（三块都空 或 强制覆盖）
  let sql = `SELECT id, title, studentName, ${gradeExpr}, category, description, teacherComment, processLogJson, abilityJson
             FROM camp_works WHERE status = 'approved'`;
  if (!FORCE) {
    sql += ` AND (teacherComment IS NULL OR teacherComment = '')`;
  }
  sql += ` ORDER BY createdAt ASC`;
  if (LIMIT > 0) sql += ` LIMIT ${LIMIT}`;

  const rows = db.prepare(sql).all();

  log(`找到 ${rows.length} 个待处理作品${DRY_RUN ? '（dry-run，不写库）' : ''}。`);

  const results = [];
  (async () => {
    for (const row of rows) {
      const label = `「${row.title}」(${row.studentName || '匿名'}${row.grade ? ' · ' + row.grade : ''})`;
      log(`处理 ${label} ...`);

      const prompt =
        `作品标题：${row.title || '未命名'}\n` +
        `作品分类：${row.category || '作品'}\n` +
        `学员：${row.studentName || '孩子'}${row.grade ? ' · ' + row.grade : ''}\n` +
        `作品介绍：${row.description || '（无介绍）'}\n\n` +
        `请根据以上信息生成三块内容。`;

      let parsed = null;
      for (let attempt = 1; attempt <= 2 && !parsed; attempt++) {
        try {
          const content = await callModel(SYSTEM_PROMPT, prompt);
          parsed = parseJsonFromText(content);
          if (!parsed) {
            log(`  第 ${attempt} 次解析失败，${attempt < 2 ? '重试…' : '放弃'}`);
          }
        } catch (e) {
          log(`  第 ${attempt} 次调用失败：${e.message}`);
        }
      }

      if (!parsed) {
        results.push({ id: row.id, title: row.title, ok: false, reason: 'LLM 失败或解析失败' });
        continue;
      }

      const teacherComment =
        typeof parsed.teacherComment === 'string' ? parsed.teacherComment.trim() : '';
      const ability = parsed.ability && typeof parsed.ability === 'object' ? parsed.ability : {};
      const abilityObj = {
        heading: typeof ability.heading === 'string' ? ability.heading : '',
        intro: typeof ability.intro === 'string' ? ability.intro : '',
        note: typeof ability.note === 'string' ? ability.note : '',
        scores: clampScores(ability.scores),
      };
      const processLog = Array.isArray(parsed.processLog)
        ? parsed.processLog
            .filter((it) => it && typeof it === 'object')
            .map((it) => ({
              time: typeof it.time === 'string' ? it.time : '',
              tag: typeof it.tag === 'string' ? it.tag : '',
              image: typeof it.image === 'string' ? it.image : '',
              title: typeof it.title === 'string' ? it.title : '',
              description: typeof it.description === 'string' ? it.description : '',
            }))
        : [];

      if (!teacherComment) {
        results.push({ id: row.id, title: row.title, ok: false, reason: '点评为空' });
        continue;
      }

      if (DRY_RUN) {
        log(`  ✓ 将写入：点评 ${teacherComment.length} 字，能力 [${abilityObj.scores.join(',')}]，创作记录 ${processLog.length} 条`);
        results.push({ id: row.id, title: row.title, ok: true, dry: true });
        continue;
      }

      db.prepare(
        `UPDATE camp_works
         SET processLogJson = ?, abilityJson = ?, teacherComment = ?, updatedAt = ?
         WHERE id = ?`,
      ).run(
        JSON.stringify(processLog),
        JSON.stringify(abilityObj),
        teacherComment,
        new Date().toISOString(),
        row.id,
      );
      log(`  ✓ 已写入：点评 ${teacherComment.length} 字，能力 [${abilityObj.scores.join(',')}]，创作记录 ${processLog.length} 条`);
      results.push({ id: row.id, title: row.title, ok: true });
    }

    // 汇总
    const ok = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    log(`\n完成：成功 ${ok}，失败 ${fail}。`);
    if (fail > 0) {
      log('失败项：');
      for (const r of results.filter((r) => !r.ok)) {
        log(`  - ${r.title}: ${r.reason}`);
      }
    }

    db.close();
    process.exit(fail > 0 ? 1 : 0);
  })().catch((e) => {
    log(`脚本异常：${e.message}`);
    try {
      db.close();
    } catch {
      /* noop */
    }
    process.exit(1);
  });
}

main();
