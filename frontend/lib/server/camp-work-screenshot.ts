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

/**
 * 把作品 HTML 截图成封面 PNG。
 * @returns 成功时返回封面落盘的绝对路径，失败返回 null。
 */
export async function screenshotHtmlToPng(workId: string): Promise<string | null> {
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

  const output = coverFilePath(`${workId}.png`);
  // 提前确保父目录存在，chromium CLI --screenshot 不会自动创建目录
  // (Docker named volume 第一次写入时尤其需要)
  mkdirSync(path.dirname(output), { recursive: true });
  // 封面统一 4:3（960×720），与作品墙卡片一致
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
    '--virtual-time-budget=5000',
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

function pathToFileUrl(p: string): string {
  // Windows 盘符与反斜杠 → file:/// 形式；Linux 直接拼接
  return p.replace(/\\/g, '/');
}
