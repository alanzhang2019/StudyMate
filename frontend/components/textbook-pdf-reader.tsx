'use client';

// ============================================================================
// 教材 PDF 阅读器
// ----------------------------------------------------------------------------
// 为什么不用浏览器自带的 <iframe src="x.pdf">：
//   1. 内嵌 PDF 查看器的工具栏是浏览器自己画的，页码「10 / 209」只是个只读
//      文本，点不动 —— 而一本 209 页的教材，没有页码跳转基本没法用。
//   2. 各浏览器行为不一致：Chrome/Edge 有完整工具栏，Safari 只有一页一页滚，
//      移动端微信 X5 干脆直接触发下载，根本不预览。
//   3. 也没法做「只渲染视口附近几页」的懒加载，209 页整本丢给浏览器 PDF
//      插件，低端机滚动会明显掉帧。
//
// 所以这里用 pdfjs-dist 自己渲染到 <canvas>，自己画工具栏。
//
// ---------------------------------------------------------------------------
// ⚠️ pdfjs 是「运行时脚本加载」，不是 import —— 这是刻意的，原因如下：
//   直接把 `import('pdfjs-dist/build/pdf.js')` 交给 webpack 打包会失败：
//   pdfjs 内有一处 `require('canvas')`（NodeCanvasFactory 内，浏览器永远走
//   不到），webpack 静态分析会顺着它解析进 node_modules 的 canvas 包，钻进
//   内部的相对 require，最后撞上给 Node ABI 编译的原生二进制
//   `canvas/build/Release/canvas.node`，报
//     Module not found: Can't resolve '../build/Release/canvas.node'
//   导致 /textbooks 整页 500。
//
//   已实测无效的办法（别重复踩）：
//     resolve.alias.canvas=false / resolve.fallback.canvas=false /
//     config.externals / IgnorePlugin / resolve.aliasFields=['browser']
//     —— 全都拦不住「解析进真实包后的第二跳相对 require」。
//
//   真正有效的办法：把 pdfjs 的 UMD 包（自包含，挂 globalThis.pdfjsLib）
//   放进 public/，用 <script> 在运行时加载。webpack 看不到它，也就无从
//   静态分析那段 canvas require。三个文件都由构建时从 node_modules 拷入
//   public/：pdf.min.js（主包）+ pdf.worker.min.js（渲染线程）+ 见下方注释。
// ============================================================================

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';

/** 静态资源路径：均为构建时从 node_modules/pdfjs-dist 拷进 public/ 的文件 */
const PDFJS_SCRIPT_SRC = '/pdf.min.js';
const PDFJS_WORKER_SRC = '/pdf.worker.min.js';
/** 与 public/ 里那两个文件保持一致的版本号（仅用于 CDN 上的 cmaps / 字体） */
const PDFJS_VERSION = '3.11.174';

/** 缩放范围与预设档位（100% = 页面原始 CSS 尺寸的 1.0 倍） */
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** 页间距（px）与页面四周留白（px）—— 页面高度计算只在这里定义 */
const PAGE_GAP = 16;
const PAGE_PADDING = 12;

/** 跳页后抑制 scroll 回写的时长（ms）：scrollTop 赋值是异步触发 scroll 的 */
const SUPPRESS_SCROLL_MS = 350;

type Phase = 'loading' | 'ready' | 'error';

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfPage {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }) => { promise: Promise<void>; cancel: () => void };
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => void;
}

interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: Record<string, unknown>) => { promise: Promise<unknown> };
}

/** 脚本加载是异步的，多个阅读器实例共享同一个 promise，避免重复插入 <script> */
let pdfjsPromise: Promise<PdfjsLib> | null = null;

function loadPdfjs(): Promise<PdfjsLib> {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise<PdfjsLib>((resolve, reject) => {
    const existing = (window as unknown as { pdfjsLib?: PdfjsLib }).pdfjsLib;
    if (existing) {
      resolve(existing);
      return;
    }
    const el = document.createElement('script');
    el.src = PDFJS_SCRIPT_SRC;
    el.async = true;
    el.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PdfjsLib }).pdfjsLib;
      if (lib) resolve(lib);
      else reject(new Error('pdfjs 脚本已加载但未挂载 pdfjsLib 全局对象'));
    };
    el.onerror = () => reject(new Error('无法加载 PDF 渲染引擎（pdf.min.js）'));
    document.head.appendChild(el);
  });
  return pdfjsPromise;
}

/** 阅读器对外暴露的缩放控制（父级工具栏按钮调用） */
export interface PdfReaderHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  /** 跳到指定页（1-based），越界自动收敛 */
  goPage: (p: number) => void;
}

interface TextbookPdfReaderProps {
  /** PDF 地址，如 /textbooks/math-bnu-g7a.pdf */
  url: string;
  /** 书籍标题，用于无障碍标签 */
  title: string;
  /** 外部的当前页（1-based）；滚动会通过 onPageChange 回写 */
  page: number;
  /** 滚动导致的页码变化回传（1-based） */
  onPageChange: (page: number) => void;
  /** 总页数就绪后回传，供父级工具栏显示 */
  onTotalPages: (total: number) => void;
  /** 缩放变化后回传 */
  onScaleChange: (scale: number) => void;
  /** 载入失败时回传错误信息（父级决定怎么提示） */
  onError?: (msg: string) => void;
  handleRef?: Ref<PdfReaderHandle>;
}

export default function TextbookPdfReader({
  url,
  title,
  page,
  onPageChange,
  onTotalPages,
  onScaleChange,
  onError,
  handleRef,
}: TextbookPdfReaderProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  /** 单页原始 CSS 尺寸，由第 1 页 viewport 决定 */
  const [baseSize, setBaseSize] = useState<PdfViewport | null>(null);
  /** 滚动引发的重算触发器（值本身不重要，变一下就让 visibleRange 重新计算） */
  const [scrollTick, setScrollTick] = useState(0);

  const pageW = baseSize ? Math.round(baseSize.width * scale) : 0;
  const pageH = baseSize ? Math.round(baseSize.height * scale) : 0;
  /** 含间距的单页占位高度 —— 一切高度换算都用它 */
  const slotH = pageH + PAGE_GAP;

  /** 页面对象缓存，避免重复 getPage */
  const pagesCache = useRef<Map<number, PdfPage>>(new Map());
  /** 进行中的渲染任务，重渲染/卸载前必须 cancel */
  const renderTasks = useRef<Map<number, { cancel: () => void }>>(new Map());
  /** 抑制 scroll→onPageChange 回写的截止时间戳 */
  const suppressUntil = useRef(0);
  /**
   * 最新页码的镜像。跳页/缩放的相关 effect 只应依赖「尺寸」，
   * 页码变化不该触发它们 —— 否则滚动回写页码会导致自己把自己又滚一次，
   * 形成滚动抖动。用 ref 读最新值即可。
   */
  const pageRef = useRef(page);
  pageRef.current = page;

  // --------------------------------------------------------------------------
  // 1. 加载文档并确定统一页尺寸
  // --------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    let loaded: PdfDocument | null = null;

    setPhase('loading');
    setErrorMsg('');
    setDoc(null);
    setNumPages(0);
    setBaseSize(null);
    pagesCache.current.clear();

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (!alive) return;
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

        const task = pdfjs.getDocument({
          url,
          isEvalSupported: false,
          // 保持按需拉取：17MB 的教材若一次性下载，首屏要等好几秒
          disableAutoFetch: false,
          disableStream: false,
          // 中文字体的 cmap 与标准字体走 CDN（这两份不进 public，体积太大且极少命中）
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
        });

        const d = (await task.promise) as PdfDocument;
        if (!alive) {
          d.destroy();
          return;
        }
        loaded = d;

        // 用第 1 页确定统一页尺寸。全部页面按同一尺寸占位，跳页才是纯算术。
        const first = await d.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (!alive) return;

        pagesCache.current.set(1, first);
        setBaseSize({ width: vp.width, height: vp.height });
        setNumPages(d.numPages);
        setDoc(d);
        setPhase('ready');
        onTotalPages(d.numPages);
      } catch (err) {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setPhase('error');
        onError?.(msg);
      }
    })();

    return () => {
      alive = false;
      for (const t of renderTasks.current.values()) t.cancel();
      renderTasks.current.clear();
      pagesCache.current.clear();
      loaded?.destroy();
    };
    // onTotalPages / onError 为父级 useCallback，故意不入依赖以免重复加载文档
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // --------------------------------------------------------------------------
  // 2. 滚动 → 重算可见区间 + 回写页码
  // --------------------------------------------------------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || phase !== 'ready') return;

    let raf = 0;
    const flush = () => {
      raf = 0;
      setScrollTick((t) => t + 1);
      if (!slotH) return;
      const center = el.scrollTop + el.clientHeight / 2 - PAGE_PADDING;
      const p = Math.floor(Math.max(0, center) / slotH) + 1;
      const clamped = Math.min(Math.max(p, 1), numPages || 1);
      if (Date.now() > suppressUntil.current && clamped !== pageRef.current) {
        onPageChange(clamped);
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(flush);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    flush();
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // scrollTick 不入依赖（它由本 effect 自己 set），只作为渲染触发器；
    // onPageChange/url 由父级 useCallback/key 保证稳定，重复加载文档才是要防的
  }, [phase, slotH, numPages, onPageChange, url]);

  // --------------------------------------------------------------------------
  // 3. 跳页（外部页码变化、缩放后校正都走这里）
  // --------------------------------------------------------------------------
  const scrollToPage = useCallback(
    (p: number) => {
      const el = scrollRef.current;
      if (!el || !slotH) return;
      const target = Math.min(Math.max(p, 1), numPages || 1);
      // 目标页顶端贴住容器顶部（减去顶部留白，使页面视觉上贴边）
      el.scrollTop = (target - 1) * slotH;
      // scrollTop 赋值异步触发 scroll 事件；不抑制的话页码会先跳回旧值再跳过去
      suppressUntil.current = Date.now() + SUPPRESS_SCROLL_MS;
      setScrollTick((t) => t + 1);
    },
    [slotH, numPages]
  );

  // 外部要求跳页
  useEffect(() => {
    if (phase !== 'ready') return;
    scrollToPage(page);
  }, [page, phase, scrollToPage]);

  // 缩放后保持「当前页」不跑偏：页高变了，滚动位置必须同步换算。
  // 第一次（拿到 baseSize 时）不校正，否则会把初始第 1 页滚到奇怪的位置。
  const scaleSettled = useRef(false);
  useEffect(() => {
    if (phase !== 'ready' || !slotH) return;
    if (!scaleSettled.current) {
      scaleSettled.current = true;
      return;
    }
    scrollToPage(pageRef.current);
  }, [slotH, phase, scrollToPage]);

  // --------------------------------------------------------------------------
  // 5. 单页渲染
  // --------------------------------------------------------------------------
  const renderPage = useCallback(
    async (p: number, canvas: HTMLCanvasElement) => {
      if (!doc || !pageW || !pageH) return;
      // 尺寸变了或已存在任务 ⇒ 先取消，避免两次 render 并发写同一 canvas
      // （pdfjs 会抛 "Cannot use the same canvas during multiple render() operations"）
      const running = renderTasks.current.get(p);
      if (running) {
        if (canvas.dataset.renderedScale === String(scale)) return; // 已是同一尺寸，无需重画
        running.cancel();
        renderTasks.current.delete(p);
      }
      canvas.dataset.renderedScale = String(scale);

      let pageObj = pagesCache.current.get(p);
      if (!pageObj) {
        pageObj = await doc.getPage(p);
        pagesCache.current.set(p, pageObj);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pageObj.getViewport({ scale });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${pageW}px`;
      canvas.style.height = `${pageH}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.width, viewport.height);

      const task = pageObj.render({ canvasContext: ctx, viewport });
      renderTasks.current.set(p, task);
      try {
        await task.promise;
      } catch {
        // RenderingCancelledException：页面滚出视口被主动取消，属正常路径
      } finally {
        if (renderTasks.current.get(p) === task) renderTasks.current.delete(p);
      }
    },
    [doc, pageW, pageH, scale]
  );

  /** 需要渲染的页号区间：视口内 + 上下各 1 页 */
  const visibleRange = useMemo(() => {
    if (!slotH || !numPages) return { from: 1, to: 1 };
    const el = scrollRef.current;
    const h = el?.clientHeight ?? 900;
    const top = el?.scrollTop ?? 0;
    const from = Math.floor(Math.max(0, top - PAGE_PADDING) / slotH);
    const to = Math.ceil((top + h) / slotH) + 1;
    return {
      from: Math.max(1, Math.min(from, numPages)),
      to: Math.max(1, Math.min(to, numPages)),
    };
    // scrollTick 是刻意的依赖：滚动时它变化，触发区间重算
  }, [slotH, numPages, scrollTick]);

  // 进入视口的页面立刻开始渲染
  useEffect(() => {
    if (phase !== 'ready') return;
    const host = scrollRef.current;
    if (!host) return;
    for (let p = visibleRange.from; p <= visibleRange.to; p += 1) {
      const canvas = host.querySelector<HTMLCanvasElement>(`canvas[data-pg="${p}"]`);
      if (canvas) void renderPage(p, canvas);
    }
  }, [phase, visibleRange, renderPage]);

  // --------------------------------------------------------------------------
  // 6. 缩放
  // --------------------------------------------------------------------------
  const applyScale = useCallback(
    (next: number) => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(next * 100) / 100));
      setScale(clamped);
      onScaleChange(clamped);
    },
    [onScaleChange]
  );

  const zoomIn = useCallback(() => {
    applyScale(ZOOM_PRESETS.find((z) => z > scale + 0.001) ?? MAX_SCALE);
  }, [scale, applyScale]);

  const zoomOut = useCallback(() => {
    const rev = [...ZOOM_PRESETS].reverse();
    applyScale(rev.find((z) => z < scale - 0.001) ?? MIN_SCALE);
  }, [scale, applyScale]);

  const goPage = useCallback(
    (p: number) => {
      const target = Math.min(Math.max(Math.round(p), 1), numPages || 1);
      scrollToPage(target);
      onPageChange(target);
    },
    [numPages, scrollToPage, onPageChange]
  );

  useImperativeHandle(
    handleRef,
    () => ({ zoomIn, zoomOut, zoomReset: () => applyScale(1), goPage }),
    [zoomIn, zoomOut, applyScale, goPage]
  );

  // --------------------------------------------------------------------------
  // 7. 键盘：← → / PgUp PgDn 翻页
  // 必须走 goPage（而不是 scrollToPage）——后者只滚不给父级回写页码，
  // 就会出现「内容滚了但输入框还停在旧页码」。
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      // 不劫持 Ctrl/⌘ 组合，也不打断正在输入页码
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPage(pageRef.current - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goPage(pageRef.current + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, goPage]);

  // --------------------------------------------------------------------------
  // 7. 渲染
  // --------------------------------------------------------------------------
  if (phase === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-[#D8E3FA]">这本教材暂时打不开</p>
        <p className="max-w-md text-xs leading-relaxed text-[#8FA9DE]">{errorMsg}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20"
        >
          新标签打开
        </a>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      data-testid="pdf-reader-scroll"
      aria-label={title}
      className="relative flex-1 overflow-auto overscroll-contain bg-[#0F1E45]"
    >
      {phase === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-sm text-[#B9C9EE]">正在载入教材…</p>
        </div>
      )}

      {phase === 'ready' && baseSize && (
        <div
          className="flex flex-col items-center"
          style={{ padding: `${PAGE_PADDING}px 0`, gap: `${PAGE_GAP}px` }}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
            const inView = p >= visibleRange.from && p <= visibleRange.to;
            return (
              <div
                key={p}
                data-page={p}
                className="relative shrink-0 overflow-hidden rounded-sm bg-white shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
                style={{ width: pageW, height: pageH }}
              >
                {inView ? (
                  <canvas data-pg={p} className="block" />
                ) : (
                  // 未进入视口：只留空白占位，不建 canvas，省掉整张位图的内存
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-300">
                    {p}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
