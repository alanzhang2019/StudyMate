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