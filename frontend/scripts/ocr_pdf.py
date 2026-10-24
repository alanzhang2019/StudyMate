"""
使用 PyMuPDF + Tesseract OCR 提取 PDF 中文文本
用法: python scripts/ocr_pdf.py <input.pdf> <output.txt> [--scale 2.0]
"""
import sys
import os
import subprocess
import tempfile
import shutil
from pathlib import Path

def find_tesseract() -> str:
    """查找 tesseract 可执行文件路径（PATH 中可能找不到 .cmd 包装）"""
    import shutil
    for cand in [
        shutil.which('tesseract'),
        shutil.which('tesseract.cmd'),
        r'C:\Users\Administrator\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\bin\tesseract.cmd',
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    ]:
        if cand and os.path.exists(cand):
            return cand
    return 'tesseract'

def ocr_pdf(pdf_path: str, out_path: str, scale: float = 2.0, lang: str = 'chi_sim', psm: int = 6) -> None:
    import pymupdf as fitz
    tess = find_tesseract()
    print(f'  tesseract: {tess}')

    pdf = fitz.open(pdf_path)
    print(f'PDF: {pdf_path}  pages={pdf.page_count}')

    workdir = tempfile.mkdtemp(prefix='ocr_')
    try:
        all_text = ''
        for i, page in enumerate(pdf):
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            png_path = os.path.join(workdir, f'page-{i+1:03d}.png')
            pix.save(png_path)

            # 调 tesseract
            r = subprocess.run(
                [tess, png_path, 'stdout', '-l', lang, '--psm', str(psm)],
                capture_output=True, text=True, encoding='utf-8'
            )
            text = r.stdout
            all_text += text + '\n\n--- PAGE BREAK ---\n\n'
            print(f'  page {i+1}: {len(text)} chars  (cumulative {len(all_text)})')
        Path(out_path).write_text(all_text, encoding='utf-8')
        print(f'OK: {out_path}  ({len(all_text)} chars)')
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('用法: python scripts/ocr_pdf.py <input.pdf> <output.txt> [--scale N]')
        sys.exit(1)
    pdf_path = sys.argv[1]
    out_path = sys.argv[2]
    scale = 2.0
    if '--scale' in sys.argv:
        idx = sys.argv.index('--scale')
        scale = float(sys.argv[idx + 1])
    ocr_pdf(pdf_path, out_path, scale=scale)
