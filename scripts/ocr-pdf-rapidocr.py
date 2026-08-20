#!/usr/bin/env python3
"""使用 rapidocr + PyMuPDF 提取 PDF 文本。

用法: python ocr-pdf-rapidocr.py <input.pdf> <output.txt> [--pages N] [--dpi D]
"""
import argparse
import os
import sys
import time
import fitz  # PyMuPDF
from rapidocr_onnxruntime import RapidOCR


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", help="输入 PDF 路径")
    ap.add_argument("out", help="输出文本路径")
    ap.add_argument("--pages", type=int, default=0, help="仅处理前 N 页 (0=全部)")
    ap.add_argument("--dpi", type=int, default=200, help="渲染 DPI")
    args = ap.parse_args()

    if not os.path.exists(args.pdf):
        print(f"[ERR] PDF not found: {args.pdf}", file=sys.stderr)
        sys.exit(1)

    print(f"[OCR] init engine...")
    engine = RapidOCR()
    print(f"[OCR] engine ready")

    doc = fitz.open(args.pdf)
    total = doc.page_count
    if args.pages > 0:
        total = min(total, args.pages)
    print(f"[OCR] {args.pdf}: {doc.page_count} pages, processing {total}")

    lines_all = []
    t0 = time.time()
    for i in range(total):
        page = doc[i]
        mat = fitz.Matrix(args.dpi / 72.0, args.dpi / 72.0)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        result, _ = engine(img_bytes)
        if not result:
            continue
        # 按 y 排序
        boxes = sorted(result, key=lambda x: (x[0][0][1] + x[0][2][1]) / 2)
        for box, text, conf in boxes:
            txt = (text or "").strip()
            if not txt:
                continue
            lines_all.append(txt)
        # 跨页分隔
        lines_all.append("")

    doc.close()
    out_text = "\n".join(lines_all)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(out_text)

    dt = time.time() - t0
    print(f"[OCR] done: {len(out_text)} chars, {len(lines_all)} lines, {dt:.1f}s -> {args.out}")


if __name__ == "__main__":
    main()
