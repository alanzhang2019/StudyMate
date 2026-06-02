import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startMistakePreview } from '@/lib/mistake/ui/start-mistake-preview';

const { createMistakeSession, saveGenerationPreviewSession } = vi.hoisted(() => ({
  createMistakeSession: vi.fn(),
  saveGenerationPreviewSession: vi.fn(),
}));

vi.mock('@/lib/mistake/session/client', () => ({
  createMistakeSession,
}));

vi.mock('@/lib/mistake/ui/generation-preview-storage', () => ({
  saveGenerationPreviewSession,
}));

describe('startMistakePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a generic generation preview session while preserving mistakeSessionId linkage', async () => {
    createMistakeSession.mockResolvedValue({
      session: { id: 'mistake-1' },
      liveUrl: null,
    });

    const sessionId = await startMistakePreview({
      extraction: {
        imageUrl: 'blob:test',
        problemText: '36 + 27 = ?',
        confidence: 0.9,
      },
      problemText: '36 + 27 = ?',
      studentAnswer: '53',
      correctAnswer: '63',
      studentName: '小明',
      grade: 4,
      teachingStyle: '清晰易懂',
      studentProfileId: 'profile-1',
    });

    expect(sessionId).toBe('mistake-1');
    expect(saveGenerationPreviewSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'mistake-1',
        currentStep: 'generating',
        previewPhase: 'preparing',
        mistakeSessionId: 'mistake-1',
        requirements: expect.objectContaining({
          webSearch: false,
          interactiveMode: false,
          userNickname: '小明',
          requirement: expect.stringContaining('36 + 27 = ?'),
        }),
      }),
    );

    const savedSession = saveGenerationPreviewSession.mock.calls[0]?.[0];
    expect(savedSession.requirements.requirement).toContain('讲解这道作业题');
    expect(savedSession.requirements.requirement).not.toContain('讲解这道错题');
  });
});
