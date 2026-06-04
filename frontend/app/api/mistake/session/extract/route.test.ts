import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mistake/ocr/extract-from-image', () => ({
  extractFromImage: vi.fn().mockResolvedValue({
    problemText: '36 + 27 = ?',
    studentAnswer: '53',
    correctAnswerCandidate: '63',
    confidence: 0.88,
    needsUserConfirmation: true,
    rawModelText: '{"problemText":"36 + 27 = ?"}',
  }),
}));

import { POST } from './route';

describe('POST /api/mistake/session/extract', () => {
  it('returns structured extraction data from an uploaded image', async () => {
    const formData = new FormData();
    formData.set('image', new File(['fake'], 'math.png', { type: 'image/png' }));
    formData.set('subject', 'math');
    formData.set('grade', '4');

    const request = new Request('http://localhost/api/mistake/session/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      extraction: {
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswerCandidate: '63',
        confidence: 0.88,
        needsUserConfirmation: true,
        rawModelText: '{"problemText":"36 + 27 = ?"}',
      },
    });
  });

  it('returns 400 when image is missing', async () => {
    const formData = new FormData();
    formData.set('subject', 'math');

    const request = new Request('http://localhost/api/mistake/session/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Image file is required');
  });

  it('returns a confirmation draft when OCR cannot extract problemText', async () => {
    const { extractFromImage } = await import('@/lib/mistake/ocr/extract-from-image');
    vi.mocked(extractFromImage).mockResolvedValueOnce({
      problemText: '',
      confidence: 0.2,
      needsUserConfirmation: true,
      rawModelText: '{"confidence":0.2}',
    });

    const formData = new FormData();
    formData.set('image', new File(['fake'], 'math.png', { type: 'image/png' }));
    formData.set('subject', 'math');

    const request = new Request('http://localhost/api/mistake/session/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      extraction: {
        problemText: '',
        confidence: 0.2,
        needsUserConfirmation: true,
        rawModelText: '{"confidence":0.2}',
      },
    });
  });

  it('degrades to a manual confirmation draft when OCR returns an ocr-error payload', async () => {
    const { extractFromImage } = await import('@/lib/mistake/ocr/extract-from-image');
    vi.mocked(extractFromImage).mockResolvedValueOnce({
      problemText: '',
      confidence: 0,
      needsUserConfirmation: true,
      rawModelText: '[ocr-error] rate limit reached for RPM',
    });

    const formData = new FormData();
    formData.set('image', new File(['fake'], 'math.png', { type: 'image/png' }));
    formData.set('subject', 'math');

    const request = new Request('http://localhost/api/mistake/session/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      extraction: {
        problemText: '',
        confidence: 0,
        needsUserConfirmation: true,
        rawModelText: '[ocr-error] rate limit reached for RPM',
      },
    });
  });

  it('falls back to a manual confirmation draft when OCR throws', async () => {
    const { extractFromImage } = await import('@/lib/mistake/ocr/extract-from-image');
    vi.mocked(extractFromImage).mockRejectedValueOnce(new Error('provider offline'));

    const formData = new FormData();
    formData.set('image', new File(['fake'], 'math.png', { type: 'image/png' }));
    formData.set('subject', 'math');

    const request = new Request('http://localhost/api/mistake/session/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request as never);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      extraction: {
        problemText: '',
        confidence: 0,
        needsUserConfirmation: true,
        rawModelText: '[ocr-error] provider offline',
      },
    });
  });
});
