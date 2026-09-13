'use client';

/**
 * 客户端把 .html 文件渲染截图成 PNG dataURL，作为封面兜底。
 * 服务端 chromium 没装/失败/AI 插画未配时也能产出封面。
 *
 * 已知限制：html2canvas 是 DOM 重绘，对 canvas/SVG 动画/外部资源表现弱，
 * 但对绝大多数 7-12 岁孩子的 HTML 作品（div + 文字 + 图片 + 简单动画）够用。
 */

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const STABLE_DELAY_MS = 1200; // 等动画跑一帧再截图

export type ScreenshotOptions = {
  width?: number;
  height?: number;
  stableDelayMs?: number;
  signal?: AbortSignal;
};

export async function screenshotHtmlFile(
  file: File,
  options: ScreenshotOptions = {},
): Promise<string> {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const stableDelayMs = options.stableDelayMs ?? STABLE_DELAY_MS;

  const html = await file.text();

  // 隐藏 sandbox iframe：srcdoc 渲染学生的 HTML
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    `width:${width}px`,
    `height:${height}px`,
    'border:0',
    'background:#fff',
    'visibility:visible',
  ].join(';');
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  try {
    await waitForIframeLoad(iframe, options.signal);
    await delay(stableDelayMs, options.signal);

    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) throw new Error('iframe 文档不可访问');

    // 把 iframe body 撑到截图尺寸（避免学生作品 height:100% 失真）
    const originalStyle = iframeDoc.body.getAttribute('style') || '';
    iframeDoc.body.setAttribute(
      'style',
      `${originalStyle};width:${width}px;min-height:${height}px;margin:0;background:#fff;`,
    );

    const mod = await import('html2canvas');
    const html2canvas = (mod as any).default ?? mod;

    const canvas = await html2canvas(iframeDoc.body, {
      width,
      height,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: false,
      allowTaint: false,
      scale: 1,
    });

    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png')) {
      throw new Error('canvas 转 PNG 失败');
    }

    // 内容校验：html2canvas 对 canvas 动画 / 复杂 SVG / Three.js / 跨域图
    // 常常渲染出纯白画布（仍是合法 PNG），如果直接传上去服务端落盘，
    // 学生看到的封面就是空白。粗略用「非白色像素占比」过滤掉这种 case：
    // < 1% 视为空白，调用方应让服务端 chromium 兜底。
    assertNotBlank(canvas, width, height);

    return dataUrl;
  } finally {
    iframe.remove();
  }
}

function waitForIframeLoad(
  iframe: HTMLIFrameElement,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = iframe.contentDocument;
    if (doc && doc.readyState === 'complete') {
      resolve();
      return;
    }
    const onLoad = () => {
      iframe.removeEventListener('load', onLoad);
      resolve();
    };
    iframe.addEventListener('load', onLoad);
    if (signal) {
      const onAbort = () => {
        iframe.removeEventListener('load', onLoad);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * 校验 canvas 不是空白画布。
 * html2canvas 在 srcdoc iframe 下对 canvas 动画/SVG/Three.js/外链图片常常
 * 渲染出纯白画布（仍是合法 PNG dataURL），如果不拦住就会被当成封面存进
 * DB，学生看到的就是空白封面。这里用「非白像素占比」粗略过滤：
 * 占比 < 1% 视为渲染失败，调用方应让服务端 chromium 兜底。
 */
function assertNotBlank(canvas: HTMLCanvasElement, w: number, h: number): void {
  if (w <= 0 || h <= 0) {
    throw new Error('截图尺寸为 0，渲染失败');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // 拿不到 2d context（极端情况）也视为失败
    throw new Error('拿不到 canvas 2d context');
  }
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const totalPixels = w * h;
  let nonWhitePixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 10) continue; // 完全透明的像素不算
    if (r < 245 || g < 245 || b < 245) {
      nonWhitePixels++;
    }
  }
  const ratio = nonWhitePixels / totalPixels;
  if (ratio < 0.01) {
    throw new Error(
      `截图内容过少（非白像素 ${(ratio * 100).toFixed(2)}% < 1%），html2canvas 可能没渲染出来`,
    );
  }
}