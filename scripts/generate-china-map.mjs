#!/usr/bin/env node
/**
 * Generate an SVG map of mainland China with each province labeled
 * in Chinese.
 *
 * Output: docs/CSP初赛难度地图.png
 *
 * Why this script instead of an AI image generator:
 *  - D3-geo + real GeoJSON renders accurate province boundaries
 *  - SVG <text> elements use a real Chinese font (system fallback),
 *    so the province names never come out as garbled / wrong-glyph
 *    noise the way every T2I model does.
 *  - The output is a vector, so it scales to any size without
 *    pixelation (we then rasterize to PNG via sharp at 2x DPI for
 *    a clean 1600x1200 PNG).
 *
 * Data source:
 *   https://geojson.cn/data/atlas/china.json  (~200 KB, 34 province
 *   polygons + accurate centroids via d3.geoCentroid).
 *
 * Run:
 *   cd scripts && npm install && node generate-china-map.mjs
 *
 * Requires Node 18+, sharp, d3-geo, d3-geo-projection.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Load China province GeoJSON (downloaded once; checked in to the
//    repo to avoid network dependency at run time).
const geojsonPath = resolve(__dirname, '..', 'data', 'china-provinces.geojson');
let raw;
try {
  raw = await readFile(geojsonPath, 'utf-8');
} catch (e) {
  console.error(
    `Failed to read ${geojsonPath}. Download it from\n` +
      '  https://geojson.cn/data/atlas/china.json\n' +
      `and save it as data/china-provinces.geojson before running this script.`,
  );
  process.exit(1);
}
const geo = JSON.parse(raw);

// 2. Project the polygons to a flat 1600x1200 viewBox.
//    d3.geoMercator fits China well at this aspect ratio; we tweak
//    scale + translate to give a comfortable ~5% margin on all sides.
const width = 1600;
const height = 1200;
const projection = geoMercator()
  .center([105, 36])
  .scale(900)
  .translate([width / 2, height / 2]);
const path = geoPath(projection);

// 3. Render each province as a <path> in uniform light beige.
//    Adjacent provinces get a thin gray border for separation.
const fillColor = '#f5e8d0';
const strokeColor = '#9ca3af';
const strokeWidth = 1.2;

const provincePaths = geo.features
  .map((f) => {
    const d = path(f);
    if (!d) return '';
    return `<path d="${d}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" />`;
  })
  .filter(Boolean)
  .join('\n  ');

// 4. Render the province-name labels. d3.geoCentroid gives a
//    polygon-interior point that respects concave shapes (Tibet
//    etc.) — much more accurate than centroid-of-bbox.
const labels = geo.features
  .map((f) => {
    const name = f.properties.name;
    if (!name) return '';
    const [x, y] = geoCentroid(f);
    if (Number.isNaN(x) || Number.isNaN(y)) return '';
    // Smaller / northern provinces get a smaller font so the
    // labels don't overlap (Beijing / Tianjin / Shanghai / HK
    // / Macao are all very small in area).
    const isTiny =
      name === '北京市' ||
      name === '天津市' ||
      name === '上海市' ||
      name === '香港特别行政区' ||
      name === '澳门特别行政区';
    const fontSize = isTiny ? 16 : 22;
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, Source Han Sans CN, sans-serif" font-size="${fontSize}" font-weight="600" fill="#111827">${name}</text>`;
  })
  .filter(Boolean)
  .join('\n  ');

// 5. Title in the top-left corner.
const titleText = 'CSP-J/S 2025 初赛晋级难度地图';
const title = `<text x="40" y="56" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, Source Han Sans CN, sans-serif" font-size="34" font-weight="700" fill="#111827">${titleText}</text>`;

// 6. Subtitle / footnote in the bottom-right.
const footnote = `<text x="${width - 40}" y="${height - 24}" text-anchor="end" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif" font-size="14" fill="#6b7280">仅显示中国 34 个省级行政区 · 各省按 2025 CSP-J/S 晋级难度自行标注</text>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#ffffff" />
  ${title}
  ${provincePaths}
  ${labels}
  ${footnote}
</svg>
`;

// 7. Write the SVG to docs/ and rasterize to a 2x DPI PNG.
const docsDir = resolve(__dirname, '..', 'docs');
await mkdir(docsDir, { recursive: true });
const svgPath = join(docsDir, 'CSP初赛难度地图.svg');
await writeFile(svgPath, svg, 'utf-8');
console.log(`Wrote SVG: ${svgPath}`);

const pngPath = join(docsDir, 'CSP初赛难度地图.png');
await sharp(Buffer.from(svg), { density: 144 })
  .resize({ width: width * 2, height: height * 2, fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(pngPath);
console.log(`Wrote PNG: ${pngPath}`);
