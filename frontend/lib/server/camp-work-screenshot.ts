/**
 * 少年 AI 创造营 —— 作品截图封面（chromium headless CLI）
 *
 * 用系统 chromium 的 `--screenshot` 命令行方式，把学生上传的 HTML 作品
 * 渲染成一张真实截图作为封面。相比 html2canvas（DOM 重绘），这是「真渲染」：
 * canvas 动画 / p5.js / Scratch 类作品都能截到真实画面。
 *
 * 选 CLI 而非 puppeteer 的原因：零新增 npm 依赖（不动 lockfile），
 * chromium 由 Docker runner 通过 apk 安装，代码只需 child_process 调用。
 * 失败（没装 chromium / 渲染超时 / 空图）一律返回 null，由调用方降级。
 */

import { execFile } from 'child_process';
import { existsSync, statSync, mkdirSync } from 'fs';
import path from 'path';
import { htmlFilePath, coverFilePath } from '@/lib/server/camp-work-autogen';

const log = (msg: string, ...rest: unknown[]) =>
  console.log(`[camp-work-screenshot] ${msg}`, ...rest);

/** chromium 可执行文件候选路径（Alpine 版本差异，依次探测） */
const CHROMIUM_CANDIDATES: string[] = [
  process.env.CHROMIUM_PATH || '',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-headless',
].filter(Boolean);

function findChromium(): string | null {
  for (const p of CHROMIUM_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

function runChromium(chrome: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      chrome,
      args,
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

interface ScreenshotOptions {
  /** 虚拟时间预算（毫秒），越大页面动画推进越久，截到的画面越靠后 */
  budget?: number;
  /** 截图落盘绝对路径；默认 coverFilePath(`${workId}.png`) */
  output?: string;
}

/**
 * 把作品 HTML 截图成 PNG。
 * @returns 成功时返回截图落盘的绝对路径，失败返回 null。
 */
export async function screenshotHtmlToPng(
  workId: string,
  options?: ScreenshotOptions,
): Promise<string | null> {
  const chrome = findChromium();
  if (!chrome) {
    log('chromium not found, skip screenshot');
    return null;
  }

  const input = htmlFilePath(workId);
  if (!existsSync(input)) {
    log(`html not found for ${workId}`);
    return null;
  }

  const output = options?.output ?? coverFilePath(`${workId}.png`);
  // 提前确保父目录存在，chromium CLI --screenshot 不会自动创建目录
  // (Docker named volume 第一次写入时尤其需要)
  mkdirSync(path.dirname(output), { recursive: true });
  // 封面统一 4:3（960×720），与作品墙卡片一致
  const budget = options?.budget ?? 5000;
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=960,720',
    // 让 chromium 前进虚拟时间，等待 JS 初始化 / canvas 动画渲染出画面
    `--virtual-time-budget=${budget}`,
    `--screenshot=${output}`,
    `file://${pathToFileUrl(input)}`,
  ];

  try {
    await runChromium(chrome, args);
  } catch (e: any) {
    log(`chromium screenshot failed for ${workId}:`, e?.message);
    return null;
  }

  try {
    if (existsSync(output) && statSync(output).size > 0) {
      return output;
    }
    log(`empty screenshot for ${workId}`);
    return null;
  } catch {
    return null;
  }
}

/**
 * 为作品 HTML 截取 3 张不同时间点的过程截图。
 * 用不同 virtual-time-budget 让 canvas/动画/游戏作品呈现不同画面；
 * 静态作品可能差异较小，但仍优于 3 张完全相同封面。
 * @returns 3 张截图的服务 URL 数组（可能少于 3 张，由调用方用封面兜底）
 */
export async function screenshotHtmlVariants(workId: string): Promise<string[]> {
  const chrome = findChromium();
  if (!chrome) {
    log('chromium not found, skip variants');
    return [];
  }

  const input = htmlFilePath(workId);
  if (!existsSync(input)) {
    log(`html not found for variants ${workId}`);
    return [];
  }

  // 3 秒 / 8 秒 / 15 秒，分别对应「初始界面 → 进行中 → 后期/结束」
  const budgets = [3000, 8000, 15000];
  const urls: string[] = [];

  for (let i = 0; i < budgets.length; i++) {
    const filename = `${workId}-log-${i}.png`;
    const output = coverFilePath(filename);
    const shot = await screenshotHtmlToPng(workId, {
      budget: budgets[i],
      output,
    });
    if (shot) {
      urls.push(`/api/camp/covers/${filename}`);
    }
  }

  return urls;
}

function pathToFileUrl(p: string): string {
  // Windows 盘符与反斜杠 → file:/// 形式；Linux 直接拼接
  return p.replace(/\\/g, '/');
}
