// Simulates the canvas-area save effect's behavior in isolation.
// Verifies that:
//   1. First run with scene X does NOT save (X is the initial scene)
//   2. Switching to scene Y saves
//   3. Effect re-run with same scene (e.g. isPlaying toggle) does NOT save
//   4. Refresh resets state: first run again is "initial scene", no save

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Polyfill sessionStorage
class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
globalThis.sessionStorage = new MemoryStorage();

// Load storage module
const srcPath = join(__dirname, '..', '..', 'lib', 'mistake', 'ui', 'playback-session-storage.ts');
const src = readFileSync(srcPath, 'utf-8');
const out = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const storageMod = { exports: {} };
new Function('module', 'exports', 'require', 'sessionStorage', out)(
  storageMod,
  storageMod.exports,
  require,
  globalThis.sessionStorage,
);
const { savePlaybackSession, loadPlaybackSession, clearPlaybackSession } = storageMod.exports;

// Replicate the canvas-area save effect's gate logic (without React).
function makeSaveGate() {
  const isFirstSaveRunRef = { current: true };
  const lastSavedSceneIdRef = { current: null };
  return function shouldSave(stageId, currentScene, currentSceneIndex) {
    if (!stageId || !currentScene) return false;
    if (currentScene.type !== 'slide') return false;
    if (typeof currentSceneIndex !== 'number') return false;
    if (isFirstSaveRunRef.current) {
      isFirstSaveRunRef.current = false;
      lastSavedSceneIdRef.current = currentScene.id;
      return false;
    }
    if (lastSavedSceneIdRef.current === currentScene.id) return false;
    lastSavedSceneIdRef.current = currentScene.id;
    return true;
  };
}

const classroomId = 'c-1';
const sceneA = { id: 'scene-A', type: 'slide' };
const sceneB = { id: 'scene-B', type: 'slide' };
const sceneQ = { id: 'scene-Q', type: 'quiz' };

// === Scenario 1: fresh page mount, scene A is initial ===
sessionStorage.clear();
clearPlaybackSession();
savePlaybackSession({
  classroomId, sceneId: 'scene-B', sceneIndex: 1, isPlaying: true, savedAt: Date.now(),
});
const savedBefore = loadPlaybackSession();
assert.equal(savedBefore.sceneIndex, 1, 'precondition: saved session is page 2');

const gate = makeSaveGate();
// Mount: effect runs with scene A (default)
const r1 = gate(classroomId, sceneA, 0);
assert.equal(r1, false, '1. first mount with default scene A → no save');
const savedAfter1 = loadPlaybackSession();
assert.equal(savedAfter1.sceneIndex, 1, '1. saved session unchanged after first mount');

// User navigates to scene B
const r2 = gate(classroomId, sceneB, 1);
assert.equal(r2, true, '2. switch to scene B → save allowed');
savePlaybackSession({ classroomId, sceneId: sceneB.id, sceneIndex: 1, isPlaying: true, savedAt: Date.now() });

// Effect re-runs for non-scene reason (e.g. isPlaying toggles). Scene is still B.
const r3 = gate(classroomId, sceneB, 1);
assert.equal(r3, false, '3. effect re-run, same scene → no save (no clobber)');
const savedAfter3 = loadPlaybackSession();
assert.equal(savedAfter3.sceneIndex, 1, '3. saved session still page 2');

// Effect re-runs with scene A (e.g. user navigated back). Save fires.
const r4 = gate(classroomId, sceneA, 0);
assert.equal(r4, true, '4. switch back to scene A → save allowed');

// === Scenario 2: refresh — gate must be reset to first-run state ===
sessionStorage.clear();
savePlaybackSession({ classroomId, sceneId: 'scene-B', sceneIndex: 1, isPlaying: true, savedAt: Date.now() });
const gate2 = makeSaveGate();
// Simulate page refresh: a NEW component instance. gate starts fresh.
const r5 = gate2(classroomId, sceneA, 0);
assert.equal(r5, false, '5. after refresh, first mount with default scene A → no save (critical)');
const savedAfter5 = loadPlaybackSession();
assert.equal(savedAfter5.sceneIndex, 1, '5. CRITICAL: saved session still page 2 after refresh');

// Even after waiting (effect re-runs for isPlaying, chat updates, etc.), still no save
const r6 = gate2(classroomId, sceneA, 0);
assert.equal(r6, false, '6. re-runs after refresh don\'t clobber');
const r7 = gate2(classroomId, sceneA, 0);
assert.equal(r7, false, '7. more re-runs after refresh don\'t clobber');
const savedAfter7 = loadPlaybackSession();
assert.equal(savedAfter7.sceneIndex, 1, '7. saved session still page 2 after many re-runs');

// === Scenario 3: quiz scene should never save ===
sessionStorage.clear();
clearPlaybackSession();
const gate3 = makeSaveGate();
assert.equal(gate3(classroomId, sceneQ, 0), false, '8. first mount on quiz → no save');
assert.equal(gate3(classroomId, sceneQ, 0), false, '9. re-runs on quiz → no save');

console.log('9 save-gate tests passed.');
