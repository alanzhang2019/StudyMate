#!/usr/bin/env node
// scripts/migrate-imported-classrooms.mjs
//
// One-off migration: re-normalize existing `cm_imp_*.json` classrooms
// that were written before the importer had `normalizeSceneContent`.
//
// What it fixes:
//   1. Element position: x/y → left/top (renderer reads left/top).
//   2. Element defaults: rotate, defaultColor, defaultFontName, etc.
//   3. Canvas defaults: viewportSize, viewportRatio, theme.
//
// Usage:
//   node scripts/migrate-imported-classrooms.mjs           (default path)
//   node scripts/migrate-imported-classrooms.mjs --dry-run (preview only)
//
// Safe to re-run: the normalizer is idempotent.

import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const FRONTEND_DIR = process.cwd();
const CLASSROOMS_DIR = path.join(FRONTEND_DIR, 'data', 'classrooms');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Normalization (mirror of lib/server/classroom-import.ts) ─────

const DEFAULT_VIEWPORT_SIZE = 1000;
const DEFAULT_VIEWPORT_RATIO = 0.5625;
const DEFAULT_THEME = {
  backgroundColor: '#ffffff',
  fontColor: '#333333',
  fontName: 'Microsoft YaHei',
  themeColors: ['#5b9bd5'],
};
const DEFAULT_FONT_NAME = 'Microsoft YaHei';
const DEFAULT_FONT_COLOR = '#333333';
const DEFAULT_LINE_HEIGHT = 1.5;

function toFiniteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeElement(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const e = { ...raw };
  const left = toFiniteNumber(e.left, toFiniteNumber(e.x, 0));
  const top = toFiniteNumber(e.top, toFiniteNumber(e.y, 0));
  e.left = left;
  e.top = top;
  e.width = toFiniteNumber(e.width, 0);
  e.height = toFiniteNumber(e.height, 0);
  e.rotate = toFiniteNumber(e.rotate, 0);

  const type = e.type;
  if (type === 'text') {
    e.defaultColor = typeof e.defaultColor === 'string' ? e.defaultColor : DEFAULT_FONT_COLOR;
    e.defaultFontName = typeof e.defaultFontName === 'string' ? e.defaultFontName : DEFAULT_FONT_NAME;
    e.content = typeof e.content === 'string' ? e.content : '';
    if (typeof e.lineHeight !== 'number') e.lineHeight = DEFAULT_LINE_HEIGHT;
    if (typeof e.wordSpace !== 'number') e.wordSpace = 0;
    if (typeof e.opacity !== 'number') e.opacity = 1;
    if (typeof e.vertical !== 'boolean') e.vertical = false;
  } else if (type === 'shape') {
    if (!Array.isArray(e.viewBox)) e.viewBox = [100, 100];
    if (typeof e.path !== 'string') e.path = '';
    if (typeof e.fill !== 'string') e.fill = '#5b9bd5';
    if (typeof e.fixedRatio !== 'boolean') e.fixedRatio = false;
    if (e.text && typeof e.text === 'object') {
      const t = { ...e.text };
      t.defaultColor = typeof t.defaultColor === 'string' ? t.defaultColor : DEFAULT_FONT_COLOR;
      t.defaultFontName = typeof t.defaultFontName === 'string' ? t.defaultFontName : DEFAULT_FONT_NAME;
      t.content = typeof t.content === 'string' ? t.content : '';
      t.align = t.align || 'middle';
      e.text = t;
    }
  } else if (type === 'image') {
    e.fixedRatio = typeof e.fixedRatio === 'boolean' ? e.fixedRatio : true;
    if (typeof e.src !== 'string') e.src = '';
  } else if (type === 'latex') {
    if (typeof e.latex !== 'string') e.latex = '';
    if (typeof e.align !== 'string') e.align = 'center';
  } else if (type === 'line') {
    if (!Array.isArray(e.start)) e.start = [left, top];
    if (!Array.isArray(e.end)) e.end = [left, top];
    if (typeof e.style !== 'string') e.style = 'solid';
    if (typeof e.color !== 'string') e.color = '#333333';
  } else if (type === 'chart') {
    if (typeof e.chartType !== 'string') e.chartType = 'bar';
    if (!Array.isArray(e.themeColors)) e.themeColors = ['#5b9bd5'];
  } else if (type === 'table') {
    if (!Array.isArray(e.colWidths)) e.colWidths = [0.25, 0.25, 0.25, 0.25];
    if (typeof e.cellMinHeight !== 'number') e.cellMinHeight = 36;
    if (!Array.isArray(e.data)) e.data = [];
  }
  return e;
}

function normalizeCanvas(raw) {
  const canvas = raw && typeof raw === 'object' ? { ...raw } : {};
  canvas.viewportSize = toFiniteNumber(canvas.viewportSize, DEFAULT_VIEWPORT_SIZE);
  canvas.viewportRatio = toFiniteNumber(canvas.viewportRatio, DEFAULT_VIEWPORT_RATIO);
  if (!canvas.theme || typeof canvas.theme !== 'object') {
    canvas.theme = { ...DEFAULT_THEME };
  } else {
    canvas.theme = { ...DEFAULT_THEME, ...canvas.theme };
  }
  if (!Array.isArray(canvas.elements)) {
    canvas.elements = [];
  } else {
    canvas.elements = canvas.elements.map(normalizeElement);
  }
  return canvas;
}

function normalizeSceneContent(content) {
  if (!content || typeof content !== 'object') return content;
  if (content.type === 'slide') {
    return { ...content, canvas: normalizeCanvas(content.canvas) };
  }
  return content;
}

// ─── Migration ────────────────────────────────────────────────────

function diffElement(before, after) {
  const changes = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      changes.push(`${key}: ${JSON.stringify(b)} → ${JSON.stringify(a)}`);
    }
  }
  return changes;
}

async function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, 'utf-8');
  await rename(tempPath, filePath);
}

async function main() {
  let entries;
  try {
    entries = await readdir(CLASSROOMS_DIR);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.log(`No classrooms dir at ${CLASSROOMS_DIR} — nothing to migrate.`);
      return;
    }
    throw err;
  }

  const targets = entries
    .filter((name) => name.startsWith('cm_imp_') && name.endsWith('.json') && !name.endsWith('.utf8.json'))
    .sort();

  if (targets.length === 0) {
    console.log('No cm_imp_*.json files found — nothing to migrate.');
    return;
  }

  console.log(`Found ${targets.length} imported classroom(s) to migrate${DRY_RUN ? ' (dry-run)' : ''}.`);
  let totalChanges = 0;
  let touched = 0;

  for (const name of targets) {
    const filePath = path.join(CLASSROOMS_DIR, name);
    const raw = await readFile(filePath, 'utf-8');
    const json = JSON.parse(raw);
    const fileChanges = [];

    if (Array.isArray(json.scenes)) {
      for (let s = 0; s < json.scenes.length; s += 1) {
        const scene = json.scenes[s];
        if (!scene || scene.type !== 'slide') continue;
        const beforeCanvas = scene.content && scene.content.canvas;
        const afterCanvas = normalizeSceneContent(scene.content).canvas;
        if (beforeCanvas) {
          const canvasChanges = diffElement(beforeCanvas, afterCanvas);
          if (canvasChanges.length > 0) {
            fileChanges.push(`  scene[${s}].canvas: ${canvasChanges.length} change(s)`);
            for (const c of canvasChanges) fileChanges.push(`    ${c}`);
          }
          if (Array.isArray(beforeCanvas.elements)) {
            for (let e = 0; e < beforeCanvas.elements.length; e += 1) {
              const bef = beforeCanvas.elements[e] || {};
              const aft = afterCanvas.elements[e] || {};
              const ec = diffElement(bef, aft);
              if (ec.length > 0) {
                fileChanges.push(`  scene[${s}].element[${e}] (${bef.id || '?'}/${bef.type || '?'}): ${ec.length} change(s)`);
                for (const c of ec) fileChanges.push(`    ${c}`);
              }
            }
          }
        }
        scene.content = { ...scene.content, canvas: afterCanvas };
      }
    }

    if (fileChanges.length === 0) {
      console.log(`  ${name}: already normalized, skip.`);
      continue;
    }

    touched += 1;
    totalChanges += fileChanges.length;
    console.log(`  ${name}:`);
    for (const line of fileChanges) console.log(line);

    if (!DRY_RUN) {
      const out = JSON.stringify(json, null, 2);
      await atomicWrite(filePath, out);
    }
  }

  console.log(`\nSummary: ${touched} file(s) ${DRY_RUN ? 'would be ' : ''}updated, ${totalChanges} change(s).`);
  if (DRY_RUN) console.log('(dry-run mode — no files written)');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
