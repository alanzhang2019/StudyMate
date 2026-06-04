'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onCrop: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageUrl, onCrop, onCancel }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      // Center the image initially
      setPosition({ x: 0, y: 0 });
      setScale(1);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw image on canvas
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imgRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container or default
    const container = containerRef.current;
    const size = Math.min(container?.clientWidth || 400, 600);
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate draw parameters
    const img = imgRef.current;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;

    let drawWidth, drawHeight;
    if (imgAspect > canvasAspect) {
      drawHeight = canvas.height / scale;
      drawWidth = drawHeight * imgAspect;
    } else {
      drawWidth = canvas.width / scale;
      drawHeight = drawWidth / imgAspect;
    }

    const drawX = (canvas.width - drawWidth) / 2 + position.x;
    const drawY = (canvas.height - drawHeight) / 2 + position.y;

    // Draw image
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Draw overlay with cutout
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear center area (the crop region)
    const cropSize = Math.min(canvas.width, canvas.height) * 0.8;
    const cropX = (canvas.width - cropSize) / 2;
    const cropY = (canvas.height - cropSize) / 2;
    ctx.clearRect(cropX, cropY, cropSize, cropSize);

    // Draw crop border
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropX, cropY, cropSize, cropSize);

    // Draw corner handles
    const handleSize = 20;
    ctx.fillStyle = '#3b82f6';
    // Top-left
    ctx.fillRect(cropX - handleSize/2, cropY - handleSize/2, handleSize, 3);
    ctx.fillRect(cropX - handleSize/2, cropY - handleSize/2, 3, handleSize);
    // Top-right
    ctx.fillRect(cropX + cropSize - handleSize/2, cropY - handleSize/2, handleSize, 3);
    ctx.fillRect(cropX + cropSize - 3, cropY - handleSize/2, 3, handleSize);
    // Bottom-left
    ctx.fillRect(cropX - handleSize/2, cropY + cropSize - 3, handleSize, 3);
    ctx.fillRect(cropX - handleSize/2, cropY + cropSize - handleSize/2, 3, handleSize);
    // Bottom-right
    ctx.fillRect(cropX + cropSize - handleSize/2, cropY + cropSize - 3, handleSize, 3);
    ctx.fillRect(cropX + cropSize - 3, cropY + cropSize - handleSize/2, 3, handleSize);
  }, [imageLoaded, scale, position]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y,
    });
  }, [isDragging, startPos]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleCrop = () => {
    if (!canvasRef.current || !imgRef.current) return;

    const canvas = canvasRef.current;
    const cropCanvas = document.createElement('canvas');
    const cropSize = Math.min(canvas.width, canvas.height) * 0.8;
    cropCanvas.width = cropSize;
    cropCanvas.height = cropSize;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return;

    const img = imgRef.current;
    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;

    let drawWidth, drawHeight;
    if (imgAspect > canvasAspect) {
      drawHeight = canvas.height / scale;
      drawWidth = drawHeight * imgAspect;
    } else {
      drawWidth = canvas.width / scale;
      drawHeight = drawWidth / imgAspect;
    }

    const drawX = (canvas.width - drawWidth) / 2 + position.x;
    const drawY = (canvas.height - drawHeight) / 2 + position.y;

    const cropX = (canvas.width - cropSize) / 2;
    const cropY = (canvas.height - cropSize) / 2;

    // Calculate source coordinates
    const sourceX = ((cropX - drawX) / drawWidth) * img.width;
    const sourceY = ((cropY - drawY) / drawHeight) * img.height;
    const sourceWidth = (cropSize / drawWidth) * img.width;
    const sourceHeight = (cropSize / drawHeight) * img.height;

    cropCtx.drawImage(
      img,
      Math.max(0, sourceX),
      Math.max(0, sourceY),
      Math.min(sourceWidth, img.width),
      Math.min(sourceHeight, img.height),
      0,
      0,
      cropSize,
      cropSize
    );

    cropCanvas.toBlob((blob) => {
      if (blob) {
        onCrop(blob);
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-lg mb-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-white font-medium">裁剪图片</span>
        <button
          onClick={handleCrop}
          className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        >
          <Check className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg aspect-square"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-lg cursor-move touch-none"
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-4">
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
      </div>

      <p className="text-white/60 text-sm mt-3">
        拖动移动 · 缩放调整 · 中间区域为裁剪范围
      </p>
    </motion.div>
  );
}
