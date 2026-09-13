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
  } catch (e) {
    log.error(`[camp-work-autogen] runWorkAutoGen failed for ${workId}`, e);
  }
}
