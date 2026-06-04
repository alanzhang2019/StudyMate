import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/stage-storage', () => ({
  loadStageData: vi.fn(),
  saveStageData: vi.fn(),
}));

vi.mock('@/lib/utils/database', () => ({
  db: {
    stageOutlines: {
      get: vi.fn(),
      put: vi.fn(),
    },
  },
}));

import { useStageStore } from '@/lib/store/stage';
import type { Stage, Scene } from '@/lib/types/stage';
import { loadStageData } from '@/lib/utils/stage-storage';
import { db } from '@/lib/utils/database';

const loadStageDataMock = vi.mocked(loadStageData);
const stageOutlinesGetMock = vi.mocked(db.stageOutlines.get);

function createStage(id: string): Stage {
  return {
    id,
    name: '题目长什么样',
    description: '错题讲解',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    style: 'professional',
    interactiveMode: false,
  };
}

function createScene(stageId: string, sceneId: string, title: string, order: number): Scene {
  return {
    id: sceneId,
    stageId,
    type: 'slide',
    title,
    order,
    content: {
      type: 'slide',
      canvas: {
        id: `${sceneId}-canvas`,
        viewportSize: 1000,
        viewportRatio: 0.5625,
        theme: {
          backgroundColor: '#ffffff',
          themeColors: ['#5b9bd5'],
          fontColor: '#333333',
          fontName: 'Microsoft YaHei',
          outline: { color: '#d14424', width: 2, style: 'solid' },
          shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
        },
        elements: [],
        background: { type: 'solid', color: '#ffffff' },
      },
    },
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('stage store loadFromStorage', () => {
  beforeEach(() => {
    useStageStore.getState().clearStore();
    loadStageDataMock.mockReset();
    stageOutlinesGetMock.mockReset();
    stageOutlinesGetMock.mockResolvedValue(undefined);
  });

  it('reloads persisted classroom data even when the same stage is already in memory', async () => {
    const stageId = 'classroom-1';
    const inMemoryStage = createStage(stageId);
    const persistedStage = {
      ...createStage(stageId),
      name: '真正的课件',
    };
    const inMemoryScene = createScene(stageId, 'scene-memory', '内存里的半成品', 1);
    const persistedScene = createScene(stageId, 'scene-persisted', '持久化后的真课件', 1);

    useStageStore.setState({
      stage: inMemoryStage,
      scenes: [inMemoryScene],
      currentSceneId: inMemoryScene.id,
      chats: [],
      outlines: [],
      generatingOutlines: [],
    });

    loadStageDataMock.mockResolvedValue({
      stage: persistedStage,
      scenes: [persistedScene],
      currentSceneId: persistedScene.id,
      chats: [],
    });

    const loadFromStorage = useStageStore.getState()
      .loadFromStorage as (stageId: string, options?: { force?: boolean }) => Promise<void>;

    await loadFromStorage(stageId, { force: true });

    expect(loadStageDataMock).toHaveBeenCalledWith(stageId);
    expect(useStageStore.getState().stage?.name).toBe('真正的课件');
    expect(useStageStore.getState().scenes).toEqual([persistedScene]);
    expect(useStageStore.getState().currentSceneId).toBe(persistedScene.id);
  });

  it('hydrates a playable classroom snapshot without emitting an empty scenes transition', () => {
    const stageId = 'classroom-atomic';
    const stage = createStage(stageId);
    const scene = createScene(stageId, 'scene-1', '首屏课件', 1);
    const transitions: number[] = [];

    useStageStore.getState().clearStore();

    const unsubscribe = useStageStore.subscribe((state) => {
      transitions.push(state.scenes.length);
    });

    useStageStore.getState().replaceStageSnapshot({
      stage,
      scenes: [scene],
      currentSceneId: scene.id,
      chats: [],
    });

    unsubscribe();

    expect(useStageStore.getState().stage?.id).toBe(stageId);
    expect(useStageStore.getState().scenes).toEqual([scene]);
    expect(useStageStore.getState().currentSceneId).toBe(scene.id);
    expect(transitions).toEqual([1]);
  });
});
