// Classroom ZIP importer
//
// Accepts the OpenMAIC `.maic.zip` export format and re-hydrates it
// into StudyMate's filesystem-based classroom storage layout:
//
//   data/classrooms/<id>.json          (PersistedClassroomData)
//   data/classrooms/<id>/audio/...     (TTS blobs, served by /api/classroom-media)
//   data/classrooms/<id>/media/...     (generated images / videos / posters)
//
// Reusing the same layout as the existing mistake-session generator
// means the existing /classroom/[id] viewer and the
// /api/classroom-media/[classroomId]/[...path] static server pick up
// imported classrooms with no extra wiring.

import JSZip from 'jszip';
import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

import {
  CLASSROOMS_DIR,
  writeJsonFileAtomic,
} from './classroom-storage';
import type { Stage, Scene, SceneContent } from '@/lib/types/stage';
import type { Action, SpeechAction } from '@/lib/types/action';
import {
  ClassroomImportError,
  type ClassroomManifest,
  type ManifestAction,
  type MediaIndexEntry,
} from './classroom-zip-types';

const MAX_ZIP_BYTES = 1024 * 1024 * 1024; // 1 GB hard cap

export interface ImportResult {
  id: string;
  title: string;
  sceneCount: number;
  mediaCount: number;
  warnings: string[];
}

export interface ImportOptions {
  /** Optional pre-supplied classroom id; defaults to a fresh `cm_imp_` id. */
  id?: string;
  /**
   * Optional collection key, e.g. "csp-lecture". When set, the
   * classroom is tagged with this key in its persisted JSON so that
   * the list API can filter and a dedicated module page can render
   * only the classrooms belonging to that collection. Omitted /
   * empty string means "default pool" (no collection tag).
   */
  collection?: string;
}

function newClassroomId(): string {
  return `cm_imp_${randomBytes(8).toString('hex')}`;
}

/**
 * Import a `.maic.zip` buffer into the classroom storage layout.
 *
 * Throws {@link ClassroomImportError} on validation / parse failures
 * so the calling API route can map the error to a clean 4xx response.
 */
export async function importClassroomZip(
  buffer: Buffer,
  options: ImportOptions = {},
): Promise<ImportResult> {
  if (buffer.byteLength === 0) {
    throw new ClassroomImportError('EMPTY_ZIP', 'ZIP file is empty');
  }
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    throw new ClassroomImportError(
      'ZIP_TOO_LARGE',
      `ZIP file exceeds ${MAX_ZIP_BYTES / 1024 / 1024}MB cap`,
    );
  }

  // 1. Open ZIP
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new ClassroomImportError(
      'INVALID_ZIP',
      `not a valid zip: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 2. Parse manifest
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new ClassroomImportError('NO_MANIFEST', 'manifest.json not found in ZIP');
  }
  let manifest: ClassroomManifest;
  try {
    const raw = await manifestFile.async('text');
    manifest = JSON.parse(raw) as ClassroomManifest;
  } catch (err) {
    throw new ClassroomImportError(
      'INVALID_MANIFEST',
      `manifest.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!manifest || typeof manifest !== 'object') {
    throw new ClassroomImportError('INVALID_MANIFEST', 'manifest must be a JSON object');
  }
  if (manifest.formatVersion !== 1) {
    throw new ClassroomImportError(
      'UNSUPPORTED_VERSION',
      `unsupported formatVersion ${manifest.formatVersion}; expected 1`,
    );
  }
  if (!manifest.stage || !Array.isArray(manifest.scenes)) {
    throw new ClassroomImportError('INVALID_MANIFEST', 'manifest missing stage or scenes');
  }
  if (manifest.scenes.length === 0) {
    throw new ClassroomImportError('NO_SCENES', 'manifest contains no scenes');
  }

  // 3. Generate a fresh classroom id (never reuse IDs from the source)
  const id = options.id ?? newClassroomId();
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new ClassroomImportError('INVALID_ID', 'classroom id must match [a-zA-Z0-9_-]+');
  }
  const classroomDir = path.join(CLASSROOMS_DIR, id);

  // 4. Reject if a classroom with that id already exists — refusing to
  //    silently overwrite existing media keeps the admin click safely
  //    idempotent only when the operation actually succeeds.
  if (await pathExists(path.join(CLASSROOMS_DIR, `${id}.json`))) {
    throw new ClassroomImportError(
      'ID_COLLISION',
      `classroom with id ${id} already exists`,
    );
  }

  // 5. Extract media into the on-disk layout. We do this *before* the
  //    audioUrl rewrite so the rewrite can verify the referenced files
  //    actually made it into the ZIP.
  const warnings: string[] = [];
  const audioFiles: { zipPath: string; basename: string; audioId: string }[] = [];
  const mediaFiles: { zipPath: string; elementId: string; ext: string }[] = [];

  await fs.mkdir(classroomDir, { recursive: true });
  await fs.mkdir(path.join(classroomDir, 'audio'), { recursive: true });
  await fs.mkdir(path.join(classroomDir, 'media'), { recursive: true });

  for (const [filename, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (!filename.startsWith('audio/') && !filename.startsWith('media/')) continue;
    if (filename.includes('..') || filename.includes('\0')) {
      warnings.push(`skipped suspicious path: ${filename}`);
      continue;
    }
    const destPath = path.join(classroomDir, filename);
    // Re-resolve to defend against any zip-slip attempts the path
    // check above might miss (e.g. mixed separators on Windows).
    const resolved = path.resolve(destPath);
    if (!resolved.startsWith(path.resolve(classroomDir) + path.sep)) {
      warnings.push(`skipped path traversal: ${filename}`);
      continue;
    }
    const blob = await entry.async('nodebuffer');
    await fs.writeFile(resolved, blob);

    if (filename.startsWith('audio/')) {
      const basename = path.basename(filename);
      const ext = path.extname(basename);
      const audioId = basename.slice(0, -ext.length);
      audioFiles.push({ zipPath: filename, basename, audioId });
    } else {
      const basename = path.basename(filename);
      const ext = path.extname(basename);
      const elementId = basename.slice(0, -ext.length);
      mediaFiles.push({ zipPath: filename, elementId, ext });
    }
  }

  // 6. Build agent registry. Each manifest agent gets a stable id
  //    derived from the new classroom id so a re-import (with a new
  //    classroom id) won't reuse stale agent ids by accident.
  const generatedAgentConfigs = (manifest.agents ?? []).map((a, i) => ({
    id: `imp_agent_${id.slice(-6)}_${i}`,
    name: a.name,
    role: a.role,
    persona: a.persona,
    avatar: a.avatar,
    color: a.color,
    priority: a.priority,
  }));
  const agentIdByIndex = generatedAgentConfigs.map((a) => a.id);

  // 7. Build Stage
  const stage: Stage = {
    id,
    name: manifest.stage.name || 'Imported classroom',
    description: manifest.stage.description,
    languageDirective: manifest.stage.language,
    style: manifest.stage.style,
    createdAt: manifest.stage.createdAt || Date.now(),
    updatedAt: manifest.stage.updatedAt || Date.now(),
    generatedAgentConfigs: generatedAgentConfigs.length > 0 ? generatedAgentConfigs : undefined,
    agentIds: generatedAgentConfigs.length > 0 ? generatedAgentConfigs.map((a) => a.id) : undefined,
  };

  // 8. Build Scenes
  const audioPathToId = new Map<string, string>();
  for (const af of audioFiles) audioPathToId.set(af.zipPath, af.audioId);

  const scenes: Scene[] = manifest.scenes.map((ms, idx) => {
    const sceneId = `sc_imp_${id.slice(-6)}_${idx}`;
    const actions = ms.actions?.map((a) =>
      convertAction(a, audioPathToId, agentIdByIndex),
    );
    return {
      id: sceneId,
      stageId: id,
      type: ms.type,
      title: ms.title || `Scene ${ms.order + 1}`,
      order: ms.order,
      content: normalizeSceneContent(ms.content),
      actions,
      whiteboards: ms.whiteboards,
      multiAgent: ms.multiAgent
        ? {
            enabled: ms.multiAgent.enabled,
            agentIds: (ms.multiAgent.agentIndices || [])
              .map((i) => agentIdByIndex[i])
              .filter((v): v is string => typeof v === 'string'),
            directorPrompt: ms.multiAgent.directorPrompt,
          }
        : undefined,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
    };
  });

  // 9. Sanity-check audioRef coverage
  for (const scn of scenes) {
    for (const action of scn.actions ?? []) {
      if (action.type === 'speech' && !action.audioUrl) {
        const ref = (action as SpeechAction & { audioRef?: string }).audioRef;
        if (ref) {
          warnings.push(`audioRef not extracted: ${ref} (scene ${scn.order})`);
        }
      }
    }
  }
  // Also surface mediaIndex entries flagged `missing: true`
  for (const [path_, entry] of Object.entries(manifest.mediaIndex ?? {})) {
    if ((entry as MediaIndexEntry).missing) {
      warnings.push(`source ZIP marked media missing: ${path_}`);
    }
  }

  // 10. Persist
  const collection = options.collection?.trim() || undefined;
  const classroomData: Record<string, unknown> = {
    id,
    stage,
    scenes,
    createdAt: new Date().toISOString(),
  };
  if (collection) classroomData.collection = collection;
  await writeJsonFileAtomic(path.join(CLASSROOMS_DIR, `${id}.json`), classroomData);

  return {
    id,
    title: stage.name,
    sceneCount: scenes.length,
    mediaCount: audioFiles.length + mediaFiles.length,
    warnings,
  };
}

/**
 * Translate a manifest action to a StudyMate {@link Action}.
 *
 * Two fields need rewriting:
 *   - `audioRef` (relative path inside the ZIP) → no-op; the playback
 *     engine serves TTS via `audioUrl` which is filled in by the API
 *     route after extraction (the route knows its own baseUrl).
 *     Here we set `audioId` to the basename so the playback code can
 *     match a TTS entry.
 *   - `agentIndex` (index into `manifest.agents`) → `agentId` from the
 *     generated agent registry.
 *
 * Anything else is passed through verbatim — the runtime Action union
 * is a superset of the manifest's fields and ignores unknown keys.
 */
function convertAction(
  raw: ManifestAction,
  audioPathToId: Map<string, string>,
  agentIdByIndex: string[],
): Action {
  const out: Record<string, unknown> = { ...raw };
  // Drop the ZIP-only fields
  delete out.audioRef;
  delete out.agentIndex;

  if (raw.type === 'speech') {
    const audioRef = (raw as { audioRef?: string }).audioRef;
    const audioId = audioRef ? audioPathToId.get(audioRef) : undefined;
    if (audioId) {
      out.audioId = audioId;
    } else if (audioRef) {
      // No-op: keep the action but flag it as missing so the route
      // can surface a warning. The runtime will fall back to silent
      // narration if audioUrl is also absent.
      (out as Record<string, unknown>).__missingAudioRef = audioRef;
    }
  }
  if (raw.type === 'discussion') {
    const idx = (raw as { agentIndex?: number }).agentIndex;
    if (typeof idx === 'number' && agentIdByIndex[idx]) {
      out.agentId = agentIdByIndex[idx];
    }
  }
  return out as unknown as Action;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ─── Scene content normalization ───────────────────────────────────
//
// OpenMAIC exports and hand-crafted `.maic.zip` test fixtures don't
// always match StudyMate's `Slide` / `PPTElement` contract: position
// may use `x`/`y` instead of `left`/`top`, the canvas may omit
// `viewportSize` / `viewportRatio` / `theme`, and individual elements
// may be missing type-specific defaults like `defaultColor` or
// `rotate`. Without normalization, the screen renderer reads
// `undefined` for those fields and either crashes (e.g. `canvas.theme`
// is required by `ScreenElement`) or stacks every element at (0, 0).
//
// `normalizeSceneContent` is a defensive pass that:
//   - For slide content: fills in canvas defaults and normalizes
//     every element (position, rotate, type-specific defaults).
//   - For other scene kinds: returns the content unchanged.

const DEFAULT_VIEWPORT_SIZE = 1000;
const DEFAULT_VIEWPORT_RATIO = 0.5625; // 16:9

const DEFAULT_THEME = {
  backgroundColor: '#ffffff',
  fontColor: '#333333',
  fontName: 'Microsoft YaHei',
  themeColors: ['#5b9bd5'],
};

const DEFAULT_FONT_NAME = 'Microsoft YaHei';
const DEFAULT_FONT_COLOR = '#333333';
const DEFAULT_LINE_HEIGHT = 1.5;

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeElement(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const e = { ...(raw as Record<string, unknown>) };

  // Position: prefer left/top, fall back to x/y, then 0. Always set
  // both keys so downstream renderers can read either.
  const left = toFiniteNumber(e.left, toFiniteNumber(e.x, 0));
  const top = toFiniteNumber(e.top, toFiniteNumber(e.y, 0));
  e.left = left;
  e.top = top;
  e.width = toFiniteNumber(e.width, 0);
  e.height = toFiniteNumber(e.height, 0);
  e.rotate = toFiniteNumber(e.rotate, 0);

  const type = e.type as string | undefined;
  if (type === 'text') {
    e.defaultColor = typeof e.defaultColor === 'string' ? e.defaultColor : DEFAULT_FONT_COLOR;
    e.defaultFontName =
      typeof e.defaultFontName === 'string' ? e.defaultFontName : DEFAULT_FONT_NAME;
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
      const t = { ...(e.text as Record<string, unknown>) };
      t.defaultColor =
        typeof t.defaultColor === 'string' ? t.defaultColor : DEFAULT_FONT_COLOR;
      t.defaultFontName =
        typeof t.defaultFontName === 'string' ? t.defaultFontName : DEFAULT_FONT_NAME;
      t.content = typeof t.content === 'string' ? t.content : '';
      t.align = (t.align as string) || 'middle';
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

function normalizeCanvas(raw: unknown): Record<string, unknown> {
  const canvas =
    raw && typeof raw === 'object' ? ({ ...(raw as Record<string, unknown>) }) : {};

  canvas.viewportSize = toFiniteNumber(canvas.viewportSize, DEFAULT_VIEWPORT_SIZE);
  canvas.viewportRatio = toFiniteNumber(canvas.viewportRatio, DEFAULT_VIEWPORT_RATIO);

  if (!canvas.theme || typeof canvas.theme !== 'object') {
    canvas.theme = { ...DEFAULT_THEME };
  } else {
    const t = { ...DEFAULT_THEME, ...(canvas.theme as Record<string, unknown>) };
    canvas.theme = t;
  }

  if (!Array.isArray(canvas.elements)) {
    canvas.elements = [];
  } else {
    canvas.elements = (canvas.elements as unknown[]).map(normalizeElement);
  }

  return canvas;
}

function normalizeSceneContent(content: unknown): SceneContent {
  if (!content || typeof content !== 'object') {
    // No usable content; fall back to an empty slide so downstream code
    // can still read a `canvas` without crashing.
    return { type: 'slide', canvas: normalizeCanvas(undefined) } as unknown as SceneContent;
  }
  const c = content as { type?: string } & Record<string, unknown>;
  if (c.type === 'slide') {
    return { ...c, canvas: normalizeCanvas(c.canvas) } as unknown as SceneContent;
  }
  if (c.type === 'quiz' || c.type === 'interactive' || c.type === 'pbl') {
    return c as unknown as SceneContent;
  }
  // Unknown content type — wrap as a slide to keep the importer robust
  // against malformed manifests.
  return { type: 'slide', canvas: normalizeCanvas(c) } as unknown as SceneContent;
}
