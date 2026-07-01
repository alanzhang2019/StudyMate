// Tests the image-coordinate → display-coordinate conversion used to
// pre-fill the cropper with the auto-detected region.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));

const srcPath = join(__dirname, '..', '..', 'lib', 'image', 'coordinates.ts');
const src = readFileSync(srcPath, 'utf-8');
const out = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', out)(mod, mod.exports);
const { imageBoxToDisplayBox } = mod.exports;

// 800x600 image, 480x480 container, 1:1 fit on width, image is 600x360 displayed
// centered in 480x480 container → offX=0, offY=60
// → ratio = 480/800 = 0.6 → dispW=480, dispH=360
const imgSize = { w: 800, h: 600 };
const display = { w: 480, h: 360 };
const imagePos = { x: 0, y: 60 };

// 1. Full-image box
{
  const r = imageBoxToDisplayBox(
    { x: 0, y: 0, width: 800, height: 600 },
    imgSize,
    display,
    imagePos,
  );
  assert.equal(r.x, 0, '1. full image x = 0');
  assert.equal(r.y, 60, '1. full image y = 60');
  assert.equal(r.width, 480, '1. full image width = 480');
  assert.equal(r.height, 360, '1. full image height = 360');
}

// 2. Top-left quadrant
{
  const r = imageBoxToDisplayBox(
    { x: 0, y: 0, width: 400, height: 300 },
    imgSize,
    display,
    imagePos,
  );
  assert.equal(r.x, 0, '2. top-left x');
  assert.equal(r.y, 60, '2. top-left y');
  assert.equal(r.width, 240, '2. top-left width (400 * 0.6)');
  assert.equal(r.height, 180, '2. top-left height (300 * 0.6)');
}

// 3. Bottom-right quadrant
{
  const r = imageBoxToDisplayBox(
    { x: 400, y: 300, width: 400, height: 300 },
    imgSize,
    display,
    imagePos,
  );
  assert.equal(r.x, 240, '3. bottom-right x (400*0.6)');
  assert.equal(r.y, 240, '3. bottom-right y (60 + 300*0.6)');
  assert.equal(r.width, 240);
  assert.equal(r.height, 180);
}

// 4. Centered detection box
{
  const r = imageBoxToDisplayBox(
    { x: 100, y: 100, width: 600, height: 400 },
    imgSize,
    display,
    imagePos,
  );
  assert.equal(r.x, 60, '4. centered x (100*0.6)');
  assert.equal(r.y, 120, '4. centered y (60 + 100*0.6)');
  assert.equal(r.width, 360, '4. centered width (600*0.6)');
  assert.equal(r.height, 240, '4. centered height (400*0.6)');
}

// 5. Degenerate: zero-size image falls back to container center
{
  const r = imageBoxToDisplayBox(
    { x: 0, y: 0, width: 100, height: 100 },
    { w: 0, h: 0 },
    display,
    imagePos,
  );
  assert.equal(r.width, 480, '5. fallback width = display width');
  assert.equal(r.height, 360, '5. fallback height = display height');
}

console.log('5 image-coordinates tests passed.');
