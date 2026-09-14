/**
 * 少年 AI 创造营 —— 作品自动生成服务（fire-and-forget）
 *
 * 学生提交 HTML 作品后，后台异步：
 *   1. 从 HTML 抽取纯文本；
 *   2. 用 LLM 生成一段童趣、具体的作品介绍（学生自己写了就用学生的，不覆盖）；
 *   3. 用文生图（Seedream）生成一张封面插画，落盘到 DB_DIR/camp-covers/。
 *
 * 每一步都 try/catch 降级：失败只记日志，绝不阻塞提交主流程。
 * 数据落盘根目录沿用 db.ts 的 DB_DIR（生产 = /app/data 持久卷）。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { callLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import { generateImage } from '@/lib/media/image-providers';
import {
  resolveImageApiKey,
  resolveImageBaseUrl,
} from '@/lib/server/provider-config';
import { createLogger } from '@/lib/logger';
import { screenshotHtmlToPng } from '@/lib/server/camp-work-screenshot';

const log = createLogger('CampWorkAutoGen');

const DATA_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate';
const UPLOADS_DIR = path.join(DATA_DIR, 'camp-uploads');
const COVERS_DIR = path.join(DATA_DIR, 'camp-covers');
const VIDEOS_DIR = path.join(DATA_DIR, 'camp-videos');

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** 作品 HTML 文件的落盘绝对路径 */
export function htmlFilePath(workId: string): string {
  return path.join(UPLOADS_DIR, `${workId}.html`);
}

/** 封面文件绝对路径；filename 形如 `<id>.png`，调用方须保证无路径穿越 */
export function coverFilePath(filename: string): string {
  return path.join(COVERS_DIR, filename);
}

/** 作品介绍视频落盘目录（camp-videos/） */
export function videoDir(): string {
  return VIDEOS_DIR;
}

/**
 * 介绍视频文件绝对路径。
 * @param workId 作品 id
 * @param ext    扩展名（不含点，如 mp4 / webm / mov）
 */
export function videoFilePath(workId: string, ext: string): string {
  return path.join(VIDEOS_DIR, `${workId}.${ext}`);
}

/** 介绍视频对外服务 URL（与 /api/camp/videos/[filename] 路由一致） */
export function videoServeUrl(workId: string, ext: string): string {
  return `/api/camp/videos/${workId}.${ext}`;
}

/** 落盘学生上传的 HTML，返回存库用的相对路径（相对 DB_DIR） */
export function saveHtmlFile(workId: string, content: Buffer): string {
  ensureDir(UPLOADS_DIR);
  writeFileSync(htmlFilePath(workId), content);
  return `camp-uploads/${workId}.html`;
}

/** 读取已落盘的 HTML 文本内容 */
export function readHtmlContent(htmlFileRel: string): string {
  return readFileSync(path.join(DATA_DIR, htmlFileRel), 'utf-8');
}

/** 从 HTML 抽取纯文本：去掉 script/style/注释/标签，做基础实体解码 */
export function extractTextFromHtml(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 4000);
}

/** LLM 生成童趣作品介绍 */
export async function generateDescription(
  title: string,
  text: string,
): Promise<string> {
  const resolved = await resolveModel({});
  const system =
    '你是少年 AI 创造营的作品介绍小助手。请为 7-12 岁孩子的编程作品写一段充满童趣、生动具体的介绍，' +
    '让家长和孩子看了都想点进去玩一玩。用中文，120-180 字，直接输出介绍正文，不要标题、不要署名、不要 markdown。';
  const prompt =
    `作品标题：${title}\n\n作品页面里的文字内容：\n${text || '（页面里没提取到文字）'}\n\n` +
    `请根据以上信息写一段作品介绍。`;
  const result = await callLLM(
    {
      model: resolved.model,
      system,
      prompt,
      maxOutputTokens: 500,
      temperature: 0.7,
    },
    'camp-work-desc',
  );
  return (result.text || '').trim();
}

/** 从 LLM 文本里鲁棒地解析出 JSON（剥离可能的 ```json 代码块 / 首尾引号 / 截取花括号区间） */
function parseJsonFromText(text: string): any | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    t = t.slice(1, -1).replace(/\\"/g, '"');
  }
  try {
    return JSON.parse(t);
  } catch {
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

/** 把 5 维能力分数钳制到 0-10 的整数，缺项补 7 */
function clampScores(scores: unknown): number[] {
  const arr = Array.isArray(scores) ? scores : [];
  const out: number[] = [];
  for (let i = 0; i < 5; i++) {
    const n = Number(arr[i]);
    out.push(Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : 7);
  }
  return out;
}

/**
 * LLM 生成三块内容草稿：老师点评 + 能力评估 + 创作记录。
 * 返回结构化对象；失败或解析失败时返回 null（由调用方降级跳过）。
 */
export async function generateWorkReviews(params: {
  title: string;
  studentLabel: string;
  category: string;
  description: string;
}): Promise<{
  teacherComment: string;
  ability: { heading: string; intro: string; note: string; scores: number[] };
  processLog: Array<{
    time: string;
    tag: string;
    image: string;
    title: string;
    description: string;
  }>;
} | null> {
  const resolved = await resolveModel({});
  const system =
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

  const prompt =
    `作品标题：${params.title || '未命名'}\n` +
    `作品分类：${params.category || '作品'}\n` +
    `学员：${params.studentLabel || '孩子'}\n` +
    `作品介绍：${params.description || '（无介绍）'}\n\n` +
    `请根据以上信息生成三块内容。`;

  const result = await callLLM(
    {
      model: resolved.model,
      system,
      prompt,
      maxOutputTokens: 4000,
      temperature: 0.7,
    },
    'camp-work-reviews',
  );

  const parsed = parseJsonFromText(result.text || '');
  if (!parsed || typeof parsed !== 'object') return null;

  const teacherComment =
    typeof parsed.teacherComment === 'string' ? parsed.teacherComment.trim() : '';
  if (!teacherComment) return null;

  const ability = parsed.ability && typeof parsed.ability === 'object' ? parsed.ability : {};
  const processLog = Array.isArray(parsed.processLog)
    ? parsed.processLog
        .filter((it: any) => it && typeof it === 'object')
        .map((it: any) => ({
          time: typeof it.time === 'string' ? it.time : '',
          tag: typeof it.tag === 'string' ? it.tag : '',
          image: typeof it.image === 'string' ? it.image : '',
          title: typeof it.title === 'string' ? it.title : '',
          description: typeof it.description === 'string' ? it.description : '',
        }))
    : [];

  return {
    teacherComment,
    ability: {
      heading: typeof ability.heading === 'string' ? ability.heading : '',
      intro: typeof ability.intro === 'string' ? ability.intro : '',
      note: typeof ability.note === 'string' ? ability.note : '',
      scores: clampScores(ability.scores),
    },
    processLog,
  };
}

/**
 * 用 Seedream 生成封面插画并落盘。
 * 返回 { coverImage, coverSource }；没有配置 API key 或生成失败时返回 null。
 */
export async function generateAndSaveCover(
  workId: string,
  title: string,
  description: string,
): Promise<{ coverImage: string; coverSource: string } | null> {
  const apiKey = resolveImageApiKey('seedream');
  if (!apiKey) {
    log.warn('[camp-work-autogen] no Seedream API key configured; skip auto cover');
    return null;
  }
  const baseUrl = resolveImageBaseUrl('seedream');
  const prompt =
    `儿童编程作品封面插画，扁平卡通风格，主题：${title}。` +
    `${(description || '').slice(0, 60)}。明亮色彩、可爱有趣、适合 7-12 岁孩子、画面不要出现文字。`;

  const result = await generateImage(
    { providerId: 'seedream', apiKey, baseUrl },
    { prompt, aspectRatio: '4:3' },
  );

  let buffer: Buffer | null = null;
  if (result.base64) {
    const b64 = result.base64.replace(/^data:image\/\w+;base64,/, '');
    buffer = Buffer.from(b64, 'base64');
  } else if (result.url) {
    try {
      const resp = await fetch(result.url);
      if (!resp.ok) return null;
      buffer = Buffer.from(await resp.arrayBuffer());
    } catch {
      return null;
    }
  }
  if (!buffer || buffer.length === 0) return null;

  ensureDir(COVERS_DIR);
  const filename = `${workId}.png`;
  writeFileSync(path.join(COVERS_DIR, filename), buffer);
  return { coverImage: `/api/camp/covers/${filename}`, coverSource: 'ai' };
}

/**
 * 生成作品封面（统一入口）：优先用作品真实截图（chromium），
 * 截图不可用时回退 AI 插画（Seedream）。都失败返回 null。
 * 返回 { coverImage, coverSource }，coverSource ∈ 'screenshot' | 'ai'。
 */
export async function generateCover(
  workId: string,
  title: string,
  description: string,
  htmlFileRel?: string | null,
): Promise<{ coverImage: string; coverSource: string } | null> {
  // 1. 作品截图（默认首选，真实还原 HTML）
  if (htmlFileRel) {
    try {
      const shot = await screenshotHtmlToPng(workId);
      if (shot) {
        return { coverImage: `/api/camp/covers/${workId}.png`, coverSource: 'screenshot' };
      }
    } catch (e) {
      log.warn(`[camp-work-autogen] screenshot failed for ${workId}`, e);
    }
  }

  // 2. AI 插画兜底
  try {
    const gen = await generateAndSaveCover(workId, title, description);
    if (gen) return gen;
  } catch (e) {
    log.warn(`[camp-work-autogen] AI cover failed for ${workId}`, e);
  }

  return null;
}

/** 编排：抽文本 → 生成介绍 → 生成封面 → 写回 DB。整体 try/catch，永不抛。 */
export async function runWorkAutoGen(workId: string): Promise<void> {
  try {
    const row = getDb()
      .prepare('SELECT * FROM camp_works WHERE id = ?')
      .get(workId) as any;
    if (!row) return;

    const title = row.title || '我的作品';
    let description = row.description || '';
    let coverImage = row.coverImage || '';
    let coverSource = row.coverSource || (coverImage ? 'url' : 'none');

    // 1. 介绍：学生没填才自动生成
    if (!description && row.htmlFile) {
      try {
        const html = readHtmlContent(row.htmlFile);
        const text = extractTextFromHtml(html);
        const gen = await generateDescription(title, text);
        if (gen) {
          description = gen;
          getDb()
            .prepare('UPDATE camp_works SET description = ? WHERE id = ?')
            .run(description, workId);
          log.info(`[camp-work-autogen] description generated for ${workId}`);
        }
      } catch (e) {
        log.warn(`[camp-work-autogen] description failed for ${workId}`, e);
      }
    }

    // 2. 封面：学生没填封面才自动生成（默认作品截图，回退 AI 插画）
    if (!coverImage) {
      try {
        const gen = await generateCover(workId, title, description, row.htmlFile);
        if (gen) {
          coverImage = gen.coverImage;
          coverSource = gen.coverSource;
          getDb()
            .prepare('UPDATE camp_works SET coverImage = ?, coverSource = ? WHERE id = ?')
            .run(coverImage, coverSource, workId);
          log.info(`[camp-work-autogen] cover generated for ${workId} (${coverSource})`);
        }
      } catch (e) {
        log.warn(`[camp-work-autogen] cover failed for ${workId}`, e);
      }
    }

    // 3. 三块内容（老师点评 + 能力评估 + 创作记录）：学生没填点评才自动生成草稿。
    //    草稿性质，老师后台 /admin/camp/works 可随时微调覆盖。
    if (!row.teacherComment) {
      try {
        const studentLabel = [row.studentName, row.grade].filter(Boolean).join(' · ');
        const reviews = await generateWorkReviews({
          title,
          studentLabel,
          category: row.category || '作品',
          description,
        });
        if (reviews) {
          // 创作记录每节课截图：LLM 通常不返回有效图片，统一用作品封面兜底。
          const cover = coverImage;
          const processLog = (reviews.processLog || []).map((p) => ({
            ...p,
            image: p.image && p.image.trim() ? p.image : cover || '',
          }));
          getDb()
            .prepare(
              'UPDATE camp_works SET processLogJson = ?, abilityJson = ?, teacherComment = ?, updatedAt = ? WHERE id = ?',
            )
            .run(
              JSON.stringify(processLog),
              JSON.stringify(reviews.ability),
              reviews.teacherComment,
              new Date().toISOString(),
              workId,
            );
          log.info(`[camp-work-autogen] reviews generated for ${workId}`);
        }
      } catch (e) {
        log.warn(`[camp-work-autogen] reviews failed for ${workId}`, e);
      }
    }
  } catch (e) {
    log.error(`[camp-work-autogen] runWorkAutoGen failed for ${workId}`, e);
  }
}
