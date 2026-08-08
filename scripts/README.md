# 一次性构建脚本

`china-map.mjs` 用真实的中国 GeoJSON + d3-geo 渲染
带中文标签的 SVG / PNG 地图。**不**依赖 AI 生图,
所以省份名称和边界都准确。

## 生成 CSP 初赛难度地图

1. 下载 GeoJSON 数据 (约 200 KB):
   ```powershell
   # 在 frontend 仓库根目录
   mkdir -p data
   curl.exe -L -o data/china-provinces.geojson ^
     https://geojson.cn/data/atlas/china.json
   ```

2. 装依赖 + 跑脚本:
   ```powershell
   cd scripts
   npm install
   node generate-china-map.mjs
   ```

3. 产物:
   - `docs/CSP初赛难度地图.svg` — 矢量 (推荐)
   - `docs/CSP初赛难度地图.png` — 2x DPI 位图 (2 MB)

## 为什么不用 trae-api 直接生图

AI 图像模型 (trae-api / doubao / midjourney / SDXL) 对中
文渲染**不可靠**: 错字、形近字、字体重叠, 教材级别不能
用。脚本方案中文字体走系统 font fallback (PingFang /
微软雅黑), 100% 准确。
