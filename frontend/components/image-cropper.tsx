'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
import { imageBoxToDisplayBox } from '@/lib/image/coordinates';
import type { CropBox } from '@/lib/image/detect-problem';

interface ImageCropperProps {
  imageUrl: string;
  /** Pre-detected crop box in original image coordinates. When set, the
   * cropper will open with this region pre-selected. The user can adjust. */
  initialCrop?: CropBox | null;
  /** True while a background detection (auto or re-detect) is in flight.
   * The cropper shows a "识别中" indicator next to the title. */
  isDetecting?: boolean;
  /** Optional callback to re-run detection (e.g. user taps "smart select" again).
   * Should return a new image-coordinate box, or null if nothing found. */
  onReDetect?: () => Promise<CropBox | null>;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

type DisplayBox = CropBox;

type DragType =
  | null
  | 'image'
  | 'move'
  | 'tl' | 'tr' | 'bl' | 'br'
  | 't' | 'b' | 'l' | 'r';

const MIN_BOX = 80;

export function ImageCropper({
  imageUrl,
  initialCrop,
  isDetecting = false,
  onReDetect,
  onCrop,
  onCancel,
}: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [baseDisplay, setBaseDisplay] = useState({ w: 0, h: 0 });
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [cropBox, setCropBox] = useState<DisplayBox>({ x: 0, y: 0, width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [isReDetecting, setIsReDetecting] = useState(false);

  const containerSize = useMemo(() => {
    if (typeof window === 'undefined') return { w: 360, h: 360 };
    return {
      w: Math.min(window.innerWidth * 0.92, 480),
      h: Math.min(window.innerHeight * 0.6, 480),
    };
  }, []);

  // 加载图片，初始化显示尺寸和裁剪框
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      setImgSize({ w: nw, h: nh });
      const ratio = Math.min(containerSize.w / nw, containerSize.h / nh);
      const dispW = nw * ratio;
      const dispH = nh * ratio;
      setBaseDisplay({ w: dispW, h: dispH });
      const offX = (containerSize.w - dispW) / 2;
      const offY = (containerSize.h - dispH) / 2;
      setImagePos({ x: offX, y: offY });
      setScale(1);

      if (initialCrop) {
        const db = imageBoxToDisplayBox(
          initialCrop,
          { w: nw, h: nh },
          { w: dispW, h: dispH },
          { x: offX, y: offY },
        );
        setCropBox(db);
        setIsAutoDetected(true);
      } else {
        setCropBox({ x: offX, y: offY, width: dispW, height: dispH });
        setIsAutoDetected(false);
      }
    };
    img.src = imageUrl;
  }, [imageUrl, containerSize, initialCrop]);

  const handleReDetect = useCallback(async () => {
    if (!onReDetect || isReDetecting) return;
    setIsReDetecting(true);
    try {
      const result = await onReDetect();
      if (result && imgRef.current) {
        const nw = imgRef.current.naturalWidth;
        const nh = imgRef.current.naturalHeight;
        const ratio = Math.min(containerSize.w / nw, containerSize.h / nh);
        const dispW = nw * ratio;
        const dispH = nh * ratio;
        const offX = (containerSize.w - dispW) / 2;
        const offY = (containerSize.h - dispH) / 2;
        const db = imageBoxToDisplayBox(
          result,
          { w: nw, h: nh },
          { w: dispW, h: dispH },
          { x: offX, y: offY },
        );
        setImagePos({ x: offX, y: offY });
        setBaseDisplay({ w: dispW, h: dispH });
        setScale(1);
        setCropBox(db);
        setIsAutoDetected(true);
      }
    } finally {
      setIsReDetecting(false);
    }
  }, [onReDetect, isReDetecting, containerSize]);

  const displayW = baseDisplay.w * scale;
  const displayH = baseDisplay.h * scale;

  const dragRef = useRef<{
    type: DragType;
    startX: number;
    startY: number;
    startBox: CropBox;
    startPos: { x: number; y: number };
  }>({
    type: null,
    startX: 0,
    startY: 0,
    startBox: { x: 0, y: 0, width: 0, height: 0 },
    startPos: { x: 0, y: 0 },
  });

  const startDrag = (e: React.PointerEvent, type: DragType) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...cropBox },
      startPos: { ...imagePos },
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.type) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.type === 'image') {
      setImagePos({ x: d.startPos.x + dx, y: d.startPos.y + dy });
      return;
    }

    let nx = d.startBox.x;
    let ny = d.startBox.y;
    let nw = d.startBox.width;
    let nh = d.startBox.height;

    if (d.type === 'move') {
      nx = d.startBox.x + dx;
      ny = d.startBox.y + dy;
    } else {
      if (d.type.includes('l')) {
        nx = d.startBox.x + dx;
        nw = d.startBox.width - dx;
        if (nw < MIN_BOX) {
          nx = d.startBox.x + d.startBox.width - MIN_BOX;
          nw = MIN_BOX;
        }
      }
      if (d.type.includes('r')) {
        nw = d.startBox.width + dx;
        if (nw < MIN_BOX) nw = MIN_BOX;
      }
      if (d.type.includes('t')) {
        ny = d.startBox.y + dy;
        nh = d.startBox.height - dy;
        if (nh < MIN_BOX) {
          ny = d.startBox.y + d.startBox.height - MIN_BOX;
          nh = MIN_BOX;
        }
      }
      if (d.type.includes('b')) {
        nh = d.startBox.height + dy;
        if (nh < MIN_BOX) nh = MIN_BOX;
      }
    }

    // 限制裁剪框在图片显示区域内
    const ix = imagePos.x;
    const iy = imagePos.y;
    if (nx < ix) {
      nw -= ix - nx;
      nx = ix;
    }
    if (ny < iy) {
      nh -= iy - ny;
      ny = iy;
    }
    if (nx + nw > ix + displayW) nw = ix + displayW - nx;
    if (ny + nh > iy + displayH) nh = iy + displayH - ny;
    if (nw < MIN_BOX) nw = MIN_BOX;
    if (nh < MIN_BOX) nh = MIN_BOX;

    setCropBox({ x: nx, y: ny, width: nw, height: nh });
  };

  const endDrag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragRef.current.type = null;
  };

  const handleZoomIn = () => setScale((s) => Math.min(s * 1.2, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s / 1.2, 0.5));
  const handleReset = () => {
    setScale(1);
    setImagePos({
      x: (containerSize.w - baseDisplay.w) / 2,
      y: (containerSize.h - baseDisplay.h) / 2,
    });
    setCropBox({
      x: (containerSize.w - baseDisplay.w) / 2,
      y: (containerSize.h - baseDisplay.h) / 2,
      width: baseDisplay.w,
      height: baseDisplay.h,
    });
  };

  const handleCrop = () => {
    if (!imgRef.current || !baseDisplay.w) return;
    const img = imgRef.current;
    // 把显示坐标系的裁剪框映射回原图坐标
    const cx = ((cropBox.x - imagePos.x) / baseDisplay.w / scale) * img.naturalWidth;
    const cy = ((cropBox.y - imagePos.y) / baseDisplay.h / scale) * img.naturalHeight;
    const cw = (cropBox.width / baseDisplay.w / scale) * img.naturalWidth;
    const ch = (cropBox.height / baseDisplay.h / scale) * img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cw));
    canvas.height = Math.max(1, Math.round(ch));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      Math.max(0, cx),
      Math.max(0, cy),
      Math.min(cw, img.naturalWidth - Math.max(0, cx)),
      Math.min(ch, img.naturalHeight - Math.max(0, cy)),
      0,
      0,
      canvas.width,
      canvas.height
    );
    canvas.toBlob(
      (blob) => {
        if (blob) onCrop(blob);
      },
      'image/jpeg',
      0.95
    );
  };

  if (!imgSize.w) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center select-none">
      <div className="flex items-center justify-between w-full max-w-md mb-3 px-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">裁剪图片</span>
          {isDetecting && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/80">
              <Loader2 className="w-3 h-3 animate-spin" />
              识别中
            </span>
          )}
          {!isDetecting && isAutoDetected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
              <Sparkles className="w-3 h-3" />
              智能
            </span>
          )}
        </div>
        <button
          onClick={handleCrop}
          className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        >
          <Check className="w-5 h-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative bg-black/40 touch-none overflow-hidden"
        style={{ width: containerSize.w, height: containerSize.h }}
        onPointerDown={(e) => startDrag(e, 'image')}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          src={imageUrl}
          alt=""
          className="absolute pointer-events-none"
          draggable={false}
          style={{
            left: imagePos.x,
            top: imagePos.y,
            width: displayW,
            height: displayH,
          }}
        />

        {/* 暗色遮罩（4 块） */}
        <div
          className="absolute bg-black/60 pointer-events-none"
          style={{ left: 0, top: 0, width: '100%', height: cropBox.y }}
        />
        <div
          className="absolute bg-black/60 pointer-events-none"
          style={{
            left: 0,
            top: cropBox.y + cropBox.height,
            width: '100%',
            height: containerSize.h - cropBox.y - cropBox.height,
          }}
        />
        <div
          className="absolute bg-black/60 pointer-events-none"
          style={{
            left: 0,
            top: cropBox.y,
            width: cropBox.x,
            height: cropBox.height,
          }}
        />
        <div
          className="absolute bg-black/60 pointer-events-none"
          style={{
            left: cropBox.x + cropBox.width,
            top: cropBox.y,
            width: containerSize.w - cropBox.x - cropBox.width,
            height: cropBox.height,
          }}
        />

        {/* 裁剪框 */}
        <div
          className="absolute border-2 border-blue-500"
          style={{
            left: cropBox.x,
            top: cropBox.y,
            width: cropBox.width,
            height: cropBox.height,
            boxShadow: '0 0 0 1px rgba(59,130,246,0.4)',
          }}
          onPointerDown={(e) => startDrag(e, 'move')}
        >
          {/* 3x3 网格线 */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-0 right-0 h-px bg-blue-300/70" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-blue-300/70" />
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-blue-300/70" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-blue-300/70" />
          </div>

          {/* 4 角把手 */}
          {(
            [
              { pos: 'tl', style: { left: -12, top: -12, cursor: 'nwse-resize' } },
              { pos: 'tr', style: { right: -12, top: -12, cursor: 'nesw-resize' } },
              { pos: 'bl', style: { left: -12, bottom: -12, cursor: 'nesw-resize' } },
              { pos: 'br', style: { right: -12, bottom: -12, cursor: 'nwse-resize' } },
            ] as { pos: DragType; style: React.CSSProperties }[]
          ).map(({ pos, style }) => (
            <div
              key={pos as string}
              className="absolute w-6 h-6 bg-white border-2 border-blue-500 rounded-full shadow-md"
              style={style}
              onPointerDown={(e) => startDrag(e, pos)}
            />
          ))}

          {/* 4 边把手 */}
          {(
            [
              { pos: 't', style: { left: '50%', top: -8, marginLeft: -8, cursor: 'ns-resize' } },
              { pos: 'b', style: { left: '50%', bottom: -8, marginLeft: -8, cursor: 'ns-resize' } },
              { pos: 'l', style: { top: '50%', left: -8, marginTop: -8, cursor: 'ew-resize' } },
              { pos: 'r', style: { top: '50%', right: -8, marginTop: -8, cursor: 'ew-resize' } },
            ] as { pos: DragType; style: React.CSSProperties }[]
          ).map(({ pos, style }) => (
            <div
              key={pos as string}
              className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md"
              style={style}
              onPointerDown={(e) => startDrag(e, pos)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleZoomOut}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleReset}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        {onReDetect && (
          <button
            onClick={handleReDetect}
            disabled={isReDetecting}
            className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {isReDetecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            智能框选
          </button>
        )}
      </div>

      <p className="text-white/70 text-sm mt-3">
        拖动中央移动 · 拖动角/边调整大小 · 缩放调整图片
      </p>
    </div>
  );
}
