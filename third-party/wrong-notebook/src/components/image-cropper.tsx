"use client";

import { useState, useRef, useEffect } from "react";
import ReactCrop, { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface ImageCropperProps {
    imageSrc: string;
    open: boolean;
    onClose: () => void;
    onCropComplete: (croppedImageBlob: Blob) => void;
}

/**
 * 拍照收错题的裁剪器。
 *
 * ★★★ 2026-11-12 用户报障：「错题拍照应该自动全屏操作，不然题目很小不好手动裁剪」。
 *   改之前是 `DialogContent className="max-w-3xl h-[90vh]"` + 图片
 *   `maxHeight: 70vh` / `maxWidth: 100%`。手机上（390×844）算一遍就知道为什么小：
 *   图最多 358 宽，竖拍的题（3:4 ~ 9:19）在 358 宽下高度早就超过 70vh=590 ⇒ 被压成
 *   约 273×590 —— 一道题在屏上不到 300px 宽，拖裁剪框时手指轻轻一碰就越过整道题。
 *   桌面端 90vh 的弹窗里还白白空着 20vh 不画图。
 *
 *   修法三条：
 *   ① Dialog **全屏**（w-screen / h-[100dvh] / 去内边距），图片区吃掉全部剩余高度；
 *   ② 图片不再按 70vh 封顶，改成「可用空间能给多大就给多大」（max-w/max-h 100%）；
 *   ③ 加 1×/2× 放大 —— 字还是小的时候能放大再看再裁。放大改的是**真实布局宽度**
 *      （`width: 200%`），不是 CSS `transform: scale()`：transform 会让
 *      `getBoundingClientRect()` 返回缩放后的框，ReactCrop 若据此算坐标会差一倍。
 *
 * ★★ 裁剪坐标一律由**百分比 crop** 现算，不依赖 `completedCrop`：
 *   放大后 `completedCrop` 还是上一次拖动时的**渲染像素**，直接拿去裁剪就会错位
 *   （同一块区域在 2× 下像素坐标翻倍）。百分比与渲染尺寸无关，放大/缩放都安全。
 *   ⚠️ 这条是"改为百分比"的真正理由 —— 若哪天把 zoom 去掉，也别退回用 completedCrop。
 *
 * ★ 初始裁剪框几乎贴住整幅图（96%）：学生多半只想裁掉桌面、手指、别的题目，
 *   原来默认 80%×50% 居中，反而每次都要先把框拉大。
 */
export function ImageCropper({ imageSrc, open, onClose, onCropComplete }: ImageCropperProps) {
    const { t } = useLanguage();
    const [crop, setCrop] = useState<Crop>();
    const [zoom, setZoom] = useState(1);
    const imgRef = useRef<HTMLImageElement>(null);

    // 每次打开/换图都回到 1× —— 上一张的放大倍数留到下一张上，会让人以为图变小了
    useEffect(() => {
        if (open) setZoom(1);
    }, [open, imageSrc]);

    function onImageLoad() {
        setCrop({ unit: "%", x: 2, y: 2, width: 96, height: 96 });
    }

    /** 按百分比 crop 从原图裁一块，输出 JPEG Blob。 */
    const getCroppedImg = async (image: HTMLImageElement, c: Crop): Promise<Blob | null> => {
        const canvas = document.createElement("canvas");
        const nw = image.naturalWidth;
        const nh = image.naturalHeight;
        if (!nw || !nh) return null;

        const sx = (c.x / 100) * nw;
        const sy = (c.y / 100) * nh;
        const sw = Math.max(1, (c.width / 100) * nw);
        const sh = Math.max(1, (c.height / 100) * nh);

        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error("Canvas is empty"))),
                "image/jpeg",
                0.92,
            );
        });
    };

    const handleConfirm = async () => {
        const img = imgRef.current;
        if (!img) return;
        try {
            // 没拖过（crop 还是 undefined）就等于整幅图 —— 别让"确认"变成没反应
            const c: Crop = crop || { unit: "%", x: 0, y: 0, width: 100, height: 100 };
            const blob = await getCroppedImg(img, c);
            if (blob) onCropComplete(blob);
        } catch (e) {
            console.error(e);
        }
    };

    const cropNode = (
        <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            minWidth={24}
            minHeight={24}
        >
            <img
                ref={imgRef}
                alt={t.common.cropper?.title || "Crop"}
                src={imageSrc}
                onLoad={onImageLoad}
                style={
                    zoom > 1
                        ? { width: "100%", display: "block" }
                        : { maxWidth: "100%", maxHeight: "100%", display: "block" }
                }
            />
        </ReactCrop>
    );

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent
                className="left-0 top-0 translate-x-0 translate-y-0 w-screen max-w-none h-screen rounded-none border-0 p-0 gap-0 flex flex-col"
                style={{ height: "100dvh" }}
            >
                <DialogHeader className="shrink-0 flex-row items-center gap-2 space-y-0 px-4 py-2 pr-12 border-b">
                    <DialogTitle className="text-base">
                        {t.common.cropper?.title || "Crop Image"}
                    </DialogTitle>
                    <div className="ml-auto flex items-center gap-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={zoom === 1 ? "default" : "outline"}
                            className="h-8 px-2 text-xs"
                            onClick={() => setZoom(1)}
                        >
                            1×
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={zoom === 2 ? "default" : "outline"}
                            className="h-8 px-2 text-xs"
                            onClick={() => setZoom(2)}
                        >
                            2×
                        </Button>
                    </div>
                </DialogHeader>

                {/* 图片区：吃掉 header 与底栏之外的全部高度；放大后可横向/纵向滚动 */}
                <div className="flex-1 min-h-0 overflow-auto bg-black p-2">
                    {zoom > 1 ? (
                        <div style={{ width: `${zoom * 100}%` }}>{cropNode}</div>
                    ) : (
                        <div className="min-h-full w-full flex items-center justify-center">
                            {cropNode}
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t bg-background px-3 py-2">
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground flex-1">
                            {t.common.cropper?.hint || "💡 Drag to adjust crop area"}
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={onClose}>
                            {t.common.cancel || "Cancel"}
                        </Button>
                        <Button type="button" size="sm" onClick={handleConfirm}>
                            {t.common.confirm || "Confirm"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
