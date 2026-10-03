import { beforeEach, describe, expect, it } from 'vitest';

import {
  limitSceneOutlines,
  resolveClassroomModelString,
  selectAssignedImages,
  shouldPersistPlayableClassroom,
} from '@/lib/server/classroom-generation';
import type { PdfImage } from '@/lib/types/generation';

describe('classroom live generation helpers', () => {
  beforeEach(() => {
    delete process.env.MISTAKE_CLASSROOM_MODEL;
    delete process.env.MISTAKE_OCR_MODEL;
    delete process.env.DEFAULT_MODEL;
  });

  it('prefers explicit modelString before env fallbacks', () => {
    process.env.MISTAKE_CLASSROOM_MODEL = 'kimi:env-classroom';
    process.env.MISTAKE_OCR_MODEL = 'kimi:env-ocr';
    process.env.DEFAULT_MODEL = 'openai:gpt-5.4-mini';

    expect(resolveClassroomModelString({ requirement: 'test', modelString: 'kimi:request-model' })).toBe(
      'kimi:request-model',
    );
  });

  it('falls back to mistake env model before default', () => {
    process.env.MISTAKE_OCR_MODEL = 'kimi:moonshotai/kimi-k2.6';
    process.env.DEFAULT_MODEL = 'openai:gpt-5.4-mini';

    expect(resolveClassroomModelString({ requirement: 'test' })).toBe('kimi:moonshotai/kimi-k2.6');
  });

  it('marks the classroom playable once the first scene exists', () => {
    expect(shouldPersistPlayableClassroom(0, false)).toBe(false);
    expect(shouldPersistPlayableClassroom(1, false)).toBe(true);
    expect(shouldPersistPlayableClassroom(3, true)).toBe(false);
  });

  it('limits mistake classroom outlines to the configured max scene count', () => {
    const outlines = [
      { id: '1', title: 'scene-1', order: 1 },
      { id: '2', title: 'scene-2', order: 2 },
      { id: '3', title: 'scene-3', order: 3 },
      { id: '4', title: 'scene-4', order: 4 },
    ] as Array<{ id: string; title: string; order: number }>;

    expect(limitSceneOutlines(outlines, 2)).toEqual([
      { id: '1', title: 'scene-1', order: 1 },
      { id: '2', title: 'scene-2', order: 2 },
    ]);
    expect(limitSceneOutlines(outlines, undefined)).toHaveLength(4);
  });
});

describe('selectAssignedImages', () => {
  const pool: PdfImage[] = [
    { id: 'img_1', src: 'http://x/media/img_1.png', pageNumber: 0 },
    { id: 'img_2', src: 'http://x/media/img_2.png', pageNumber: 0 },
  ];

  it('returns undefined when there is no source-image pool', () => {
    expect(selectAssignedImages({}, undefined)).toBeUndefined();
    expect(selectAssignedImages({}, [])).toBeUndefined();
  });

  it('hands the whole pool to a scene that made no selection', () => {
    // Better to let the model decide than to withhold the only image it has.
    expect(selectAssignedImages({}, pool)).toBe(pool);
    expect(selectAssignedImages({ suggestedImageIds: [] }, pool)).toBe(pool);
  });

  it('narrows the pool to the ids the outline stage suggested', () => {
    expect(selectAssignedImages({ suggestedImageIds: ['img_2'] }, pool)).toEqual([pool[1]]);
  });

  it('falls back to the full pool when the suggestion names unknown ids', () => {
    // A hallucinated id must not leave the slide with no image at all.
    expect(selectAssignedImages({ suggestedImageIds: ['img_99'] }, pool)).toBe(pool);
  });
});
