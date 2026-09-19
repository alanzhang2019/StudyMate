# scripts/gen-cspj2026-q8-grid.py
# 生成 2026 CSP-J 第 8 题 5x5 网格图
from PIL import Image, ImageDraw, ImageFont

GRID = [
    ['S', '.', '.', '#', '.'],
    ['.', '.', '.', '#', '.'],
    ['.', '.', '.', '#', '.'],
    ['#', '#', '.', '.', 'E'],
    ['.', '.', '.', '#', '.'],
]

CELL = 80
PAD = 30
W = PAD * 2 + CELL * 5
H = PAD * 2 + CELL * 5

img = Image.new('RGB', (W, H), 'white')
draw = ImageDraw.Draw(img)

# 尝试加载字体
try:
    font = ImageFont.truetype('arial.ttf', 48)
except Exception:
    font = ImageFont.load_default()

for r in range(5):
    for c in range(5):
        x = PAD + c * CELL
        y = PAD + r * CELL
        # 网格线
        draw.rectangle([x, y, x + CELL, y + CELL], outline='black', width=2)
        ch = GRID[r][c]
        # 居中绘制字符
        bbox = draw.textbbox((0, 0), ch, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = x + (CELL - tw) // 2 - bbox[0]
        ty = y + (CELL - th) // 2 - bbox[1]
        draw.text((tx, ty), ch, fill='black', font=font)

out = r'd:\AItrade\ai-math-mistake-machine\frontend\public\figures\csp-j-2026\q8-grid.png'
import os
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out)
print(f'OK: {out}')
print(f'Size: {W}x{H}')