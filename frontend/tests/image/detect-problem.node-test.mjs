// Smoke test for the detection module: verifies the module shape
// (functions exported, types correct). Full detection testing requires
// HTMLImageElement + OpenCV runtime, exercised by the Playwright suite.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, '..', '..', 'lib', 'image', 'detect-problem.ts');
const src = readFileSync(srcPath, 'utf-8');

// 1. CropBox type is exported and matches the expected shape
assert.ok(
  /export type CropBox = \{[^}]*x: number[^}]*y: number[^}]*width: number[^}]*height: number/s.test(
    src,
  ),
  '1. CropBox type exported with expected shape',
);

// 2. loadOpenCV function is exported
assert.ok(
  /export function loadOpenCV\(/.test(src),
  '2. loadOpenCV function exported',
);

// 3. detectProblemRegion function is exported
assert.ok(
  /export async function detectProblemRegion\(/.test(src),
  '3. detectProblemRegion function exported',
);

// 4. Detection is timeboxed with Promise.race
assert.ok(
  src.includes('Promise.race'),
  '4. detection uses Promise.race for timeboxing',
);

// 5. Detection is fully async (returns a Promise) — race against timeout
const promiseMatch = src.match(/return Promise\.race\(\[([\s\S]*?)\]\)/);
assert.ok(promiseMatch, '5. returns Promise.race with timeout');

// 6. No 4-vertex requirement (relaxed from initial version)
assert.ok(
  !src.includes('approx.rows === 4'),
  '6. does not require 4-vertex polygon (robust for phone photos)',
);

// 7. Bounding rect is used (not minAreaRect)
assert.ok(
  src.includes('cv.boundingRect('),
  '7. uses cv.boundingRect for contour bounding box',
);

// 8. Canny edges + findContours pipeline
assert.ok(src.includes('cv.Canny('), '8. Canny edge detection used');
assert.ok(src.includes('cv.findContours('), '9. findContours used');

// 9. Min area filter uses image-area fraction
assert.ok(
  src.includes('minAreaFraction'),
  '10. min area filter is configurable as fraction of image area',
);

// 10. Padding is applied to the chosen rect
assert.ok(src.includes('padCropBox'), '11. chosen rect is padded before return');

console.log('11 detect-problem smoke tests passed.');
