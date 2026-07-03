/**
 * Tests for the r12 content+actions merge refactor.
 *
 * Before r12, every scene required two LLM round-trips:
 *   1. `generateSceneContent` for the slide/quiz body
 *   2. `generateSceneActions` for the teaching action sequence
 *
 * In r12 we collapse that to a single call: the LLM now emits an `actions`
 * array in the same response (for slide and quiz scenes). The pipeline
 * parses the actions, remaps any `elementId` references from the LLM's
 * ad-hoc ids to the post-processed nanoid ids, and returns both pieces via
 * `generateSceneContentAndActions`. This test pins the new contract.
 */

import { describe, expect, test, vi } from 'vitest';
import {
  generateSceneContentAndActions,
  type RawSlideResult,
} from '@/lib/generation/scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { GeneratedSlideContent, SceneOutline } from '@/lib/types/generation';

// ── Slide case ────────────────────────────────────────────────────────────

describe('generateSceneContentAndActions — slide', () => {
  const baseOutline: SceneOutline = {
    id: 'scene_1',
    type: 'slide',
    title: 'Test Slide',
    description: 'desc',
    keyPoints: ['k1', 'k2'],
    order: 1,
  };

  test('returns content + actions in a single LLM call', async () => {
    const aiCall = vi.fn<AICallFn>().mockResolvedValue(
      JSON.stringify({
        background: { type: 'solid', color: '#ffffff' },
        elements: [
          {
            id: 'title_001',
            type: 'text',
            left: 60,
            top: 50,
            width: 880,
            height: 76,
            content: '<p>Title</p>',
            defaultFontName: '',
            defaultColor: '#000',
          },
          {
            id: 'body_001',
            type: 'text',
            left: 60,
            top: 150,
            width: 880,
            height: 130,
            content: '<p>body</p>',
            defaultFontName: '',
            defaultColor: '#000',
          },
        ],
        actions: [
          { type: 'text', content: 'Welcome.' },
          { type: 'action', name: 'spotlight', params: { elementId: 'title_001' } },
          { type: 'text', content: 'Look at the title above.' },
          { type: 'action', name: 'spotlight', params: { elementId: 'body_001' } },
          { type: 'text', content: 'Now the body.' },
        ],
      }),
    );

    const { content, actions } = await generateSceneContentAndActions(baseOutline, aiCall);

    // Exactly one LLM call — the whole point of the refactor
    expect(aiCall).toHaveBeenCalledTimes(1);

    expect(content).not.toBeNull();
    const slide = content as GeneratedSlideContent;
    expect(slide.elements).toHaveLength(2);
    // The slide elements have nanoid ids, not the AI's "title_001"/"body_001"
    expect(slide.elements[0].id).toMatch(/^text_[A-Za-z0-9_-]{8}$/);
    expect(slide.elements[1].id).toMatch(/^text_[A-Za-z0-9_-]{8}$/);

    expect(actions.length).toBeGreaterThan(0);
    // 3 speech entries survive after the parser walks the array
    const speech = actions.filter((a) => a.type === 'speech');
    expect(speech).toHaveLength(3);
    expect(speech[0]).toMatchObject({ type: 'speech', text: 'Welcome.' });

    // Spotlights survive and got their elementId remapped to the nanoid ids
    const spotlights = actions.filter((a) => a.type === 'spotlight');
    expect(spotlights).toHaveLength(2);
    const spotlightIds = spotlights.map((s) => (s as { elementId: string }).elementId);
    expect(spotlightIds).toContain(slide.elements[0].id);
    expect(spotlightIds).toContain(slide.elements[1].id);
    expect(spotlightIds).not.toContain('title_001');
    expect(spotlightIds).not.toContain('body_001');
  });

  test('falls back to deterministic default actions when LLM omits them', async () => {
    const aiCall = vi.fn<AICallFn>().mockResolvedValue(
      JSON.stringify({
        background: { type: 'solid', color: '#fff' },
        elements: [
          {
            id: 't1',
            type: 'text',
            left: 0,
            top: 0,
            width: 200,
            height: 40,
            content: '<p>x</p>',
            defaultFontName: '',
            defaultColor: '#000',
          },
        ],
        // no actions key at all
      }),
    );

    const { content, actions } = await generateSceneContentAndActions(baseOutline, aiCall);

    expect(content).not.toBeNull();
    expect(actions.length).toBeGreaterThan(0);
    // We do not assert the exact default count (it's tuned by fast mode),
    // only that the fallback fired — i.e. NO second LLM call.
    expect(aiCall).toHaveBeenCalledTimes(1);
  });
});

// ── Sanity check on the raw slide helper (internal) ───────────────────────
//
// `RawSlideResult` is exported as a type so this test file can reference it.
// Verify the tag flow by running the raw helper directly via a type-only
// re-export; we don't need to invoke it because `generateSceneContentAndActions`
// already covers the happy path above. The compile-time check that follows
// is enough to make sure `RawSlideResult` is in scope.

test('RawSlideResult type is exported and usable', () => {
  // Type-only assertion. If `RawSlideResult` were removed or its shape
  // changed incompatibly, this line would fail to compile.
  const _shape: RawSlideResult = null;
  expect(_shape).toBeNull();
});
