// Standalone Node test for playback-session-storage (no vitest dependency).
// Run: node tests/mistake/playback-session-storage.node-test.mjs

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Polyfill sessionStorage for Node.
class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
globalThis.sessionStorage = new MemoryStorage();
globalThis.localStorage = new MemoryStorage();

const require = createRequire(import.meta.url);
const tsxLoaderUrl = require.resolve('typescript');

// Use tsx-style dynamic import via a tiny TS->JS re-export shim is overkill.
// Instead, hand-import the compiled output path. We rely on ts-node-free path:
// the test file lives next to source; re-implement the storage functions here
// is duplicate work. Instead, we transpile inline using TypeScript's compiler API.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(__dirname, '..', '..', 'lib', 'mistake', 'ui', 'playback-session-storage.ts');
const source = readFileSync(sourcePath, 'utf-8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Eval the transpiled module to obtain exports.
const mod = { exports: {} };
new Function('module', 'exports', 'require', 'sessionStorage', transpiled)(
  mod,
  mod.exports,
  require,
  globalThis.sessionStorage,
);
const { savePlaybackSession, loadPlaybackSession, clearPlaybackSession } = mod.exports;

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const fresh = (over = {}) => ({
  classroomId: 'classroom-1',
  sceneId: 'scene-1',
  sceneIndex: 0,
  isPlaying: true,
  savedAt: Date.now(),
  ...over,
});

// 1. round-trip
{
  sessionStorage.clear();
  const s = fresh({ sceneIndex: 4, isPlaying: false });
  savePlaybackSession(s);
  assert.deepEqual(loadPlaybackSession(), s, 'round-trip failed');
  console.log('  ✓ save/load round-trips');
}

// 2. empty
{
  sessionStorage.clear();
  assert.equal(loadPlaybackSession(), null);
  console.log('  ✓ returns null when empty');
}

// 3. expired
{
  sessionStorage.clear();
  sessionStorage.setItem('playbackSession', JSON.stringify(fresh({ savedAt: Date.now() - MAX_AGE_MS - 1 })));
  assert.equal(loadPlaybackSession(), null);
  console.log('  ✓ returns null when expired');
}

// 4. corrupt JSON
{
  sessionStorage.clear();
  sessionStorage.setItem('playbackSession', '{not-json');
  assert.equal(loadPlaybackSession(), null);
  console.log('  ✓ returns null on corrupt JSON');
}

// 5. missing fields
{
  sessionStorage.clear();
  sessionStorage.setItem('playbackSession', JSON.stringify({ classroomId: 'x' }));
  assert.equal(loadPlaybackSession(), null);
  console.log('  ✓ returns null when fields missing');
}

// 6. clear
{
  sessionStorage.clear();
  savePlaybackSession(fresh());
  clearPlaybackSession();
  assert.equal(loadPlaybackSession(), null);
  console.log('  ✓ clear removes entry');
}

// 7. clear(id) accepted
{
  sessionStorage.clear();
  savePlaybackSession(fresh({ classroomId: 'c-1' }));
  clearPlaybackSession('c-1');
  assert.equal(loadPlaybackSession(), null);
  console.log('  ✓ clear(id) accepted');
}

// 8. storage throws
{
  sessionStorage.clear();
  const orig = sessionStorage.setItem;
  sessionStorage.setItem = () => { throw new Error('quota'); };
  sessionStorage.getItem = () => { throw new Error('blocked'); };
  sessionStorage.removeItem = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => savePlaybackSession(fresh()));
  assert.doesNotThrow(() => clearPlaybackSession());
  assert.equal(loadPlaybackSession(), null);
  sessionStorage.setItem = orig;
  console.log('  ✓ degrades silently on storage errors');
}

console.log('\n8 tests passed.');
