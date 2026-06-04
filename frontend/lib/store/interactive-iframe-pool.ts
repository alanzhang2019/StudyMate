import { create } from 'zustand';

export const IFRAME_POOL_CAP = 3;

export interface IframeRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface IframePoolEntry {
  readonly srcDoc?: string;
  readonly src?: string;
  readonly rect: IframeRect | null;
  readonly owner: string | null;
  readonly tick: number;
}

interface MountInput {
  readonly srcDoc?: string;
  readonly src?: string;
}

interface InteractiveIframePoolState {
  entries: Record<string, IframePoolEntry>;
  activeSceneId: string | null;
  tick: number;
  mount: (sceneId: string, input: MountInput) => void;
  setRect: (sceneId: string, rect: IframeRect) => void;
  claim: (sceneId: string, owner: string) => void;
  release: (sceneId: string, owner: string) => void;
  setActive: (sceneId: string) => void;
  evict: (sceneId: string) => void;
  reset: () => void;
}

function evictLru(
  entries: Record<string, IframePoolEntry>,
  activeSceneId: string | null,
): Record<string, IframePoolEntry> {
  const ids = Object.keys(entries);
  if (ids.length <= IFRAME_POOL_CAP) return entries;

  const evictable = ids
    .filter((id) => id !== activeSceneId)
    .sort((a, b) => entries[a].tick - entries[b].tick);

  const next = { ...entries };
  let overflow = ids.length - IFRAME_POOL_CAP;

  for (const id of evictable) {
    if (overflow <= 0) break;
    delete next[id];
    overflow--;
  }

  return next;
}

export const useInteractiveIframePool = create<InteractiveIframePoolState>((set) => ({
  entries: {},
  activeSceneId: null,
  tick: 0,
  mount: (sceneId, input) =>
    set((state) => {
      const tick = state.tick + 1;
      const existing = state.entries[sceneId];

      if (existing && existing.srcDoc === input.srcDoc && existing.src === input.src) {
        return {
          entries: { ...state.entries, [sceneId]: { ...existing, tick } },
          tick,
        };
      }

      const entry: IframePoolEntry = {
        srcDoc: input.srcDoc,
        src: input.src,
        rect: existing?.rect ?? null,
        owner: existing?.owner ?? null,
        tick,
      };

      return {
        entries: evictLru({ ...state.entries, [sceneId]: entry }, state.activeSceneId),
        tick,
      };
    }),
  setRect: (sceneId, rect) =>
    set((state) => {
      const existing = state.entries[sceneId];
      if (!existing) return {};

      const current = existing.rect;
      if (
        current &&
        current.left === rect.left &&
        current.top === rect.top &&
        current.width === rect.width &&
        current.height === rect.height
      ) {
        return {};
      }

      return { entries: { ...state.entries, [sceneId]: { ...existing, rect } } };
    }),
  claim: (sceneId, owner) =>
    set((state) => {
      const existing = state.entries[sceneId];
      if (!existing || existing.owner === owner) return {};
      return { entries: { ...state.entries, [sceneId]: { ...existing, owner } } };
    }),
  release: (sceneId, owner) =>
    set((state) => {
      const existing = state.entries[sceneId];
      if (!existing || existing.owner !== owner) return {};
      return { entries: { ...state.entries, [sceneId]: { ...existing, owner: null } } };
    }),
  setActive: (sceneId) => set({ activeSceneId: sceneId }),
  evict: (sceneId) =>
    set((state) => {
      if (!state.entries[sceneId]) return {};

      const entries = { ...state.entries };
      delete entries[sceneId];

      return {
        entries,
        activeSceneId: state.activeSceneId === sceneId ? null : state.activeSceneId,
      };
    }),
  reset: () => set({ entries: {}, activeSceneId: null, tick: 0 }),
}));
