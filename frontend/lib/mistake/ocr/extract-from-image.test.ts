import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('extractFromImage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('normalizes structured JSON returned by the model', async () => {
    const { extractFromImage } = await import('./extract-from-image');
    const image = new File(['fake-image'], 'math.png', { type: 'image/png' });
    const callModel = vi.fn().mockResolvedValue(
      JSON.stringify({
        problemText: ' 36 + 27 = ? ',
        studentAnswer: ' 53 ',
        correctAnswerCandidate: ' 63 ',
        confidence: 0.88,
      }),
    );

    const result = await extractFromImage(
      image,
      { subject: 'math', grade: 4 },
      {
        callModel,
      },
    );

    expect(result).toEqual({
      problemText: '36 + 27 = ?',
      studentAnswer: '53',
      correctAnswerCandidate: '63',
      confidence: 0.88,
      needsUserConfirmation: true,
      rawModelText: JSON.stringify({
        problemText: ' 36 + 27 = ? ',
        studentAnswer: ' 53 ',
        correctAnswerCandidate: ' 63 ',
        confidence: 0.88,
      }),
    });
  });

  it('returns an empty confirmation draft when the model does not return problemText', async () => {
    const { extractFromImage } = await import('./extract-from-image');
    const image = new File(['fake-image'], 'math.png', { type: 'image/png' });

    await expect(
      extractFromImage(
        image,
        { subject: 'math' },
        {
          callModel: vi.fn().mockResolvedValue(JSON.stringify({ confidence: 0.2 })),
        },
      ),
    ).resolves.toEqual({
      problemText: '',
      confidence: 0.2,
      needsUserConfirmation: true,
      rawModelText: JSON.stringify({ confidence: 0.2 }),
    });
  });

  it('accepts JSON wrapped in markdown code fences', async () => {
    const { extractFromImage } = await import('./extract-from-image');
    const image = new File(['fake-image'], 'math.png', { type: 'image/png' });

    const result = await extractFromImage(
      image,
      { subject: 'math' },
      {
        callModel: vi.fn().mockResolvedValue(`\`\`\`json
{
  "problemText": "18 + 24 = ?",
  "studentAnswer": "32",
  "correctAnswerCandidate": "42",
  "confidence": 0.76
}
\`\`\``),
      },
    );

    expect(result.problemText).toBe('18 + 24 = ?');
    expect(result.studentAnswer).toBe('32');
    expect(result.correctAnswerCandidate).toBe('42');
    expect(result.confidence).toBe(0.76);
  });

  it('repairs non-standard JSON returned by the OCR model', async () => {
    const { extractFromImage } = await import('./extract-from-image');
    const image = new File(['fake-image'], 'math.png', { type: 'image/png' });

    const result = await extractFromImage(
      image,
      { subject: 'math' },
      {
        callModel: vi.fn().mockResolvedValue(`好的，提取结果如下：
{
  'problemText': '18 + 24 = ?',
  'studentAnswer': '32',
  'correctAnswerCandidate': '42',
  'confidence': 0.76,
}`),
      },
    );

    expect(result.problemText).toBe('18 + 24 = ?');
    expect(result.studentAnswer).toBe('32');
    expect(result.correctAnswerCandidate).toBe('42');
    expect(result.confidence).toBe(0.76);
  });

  it('keeps math text when OCR JSON includes LaTeX-style backslashes', async () => {
    const { extractFromImage } = await import('./extract-from-image');
    const image = new File(['fake-image'], 'math.png', { type: 'image/png' });

    const result = await extractFromImage(
      image,
      { subject: 'math' },
      {
        callModel: vi.fn().mockResolvedValue(`提取结果：
\`\`\`json
{
  "problemText": "解方程：x - \\\\frac{7}{16} = \\\\frac{5}{24}",
  "studentAnswer": "",
  "correctAnswerCandidate": "x = \\\\frac{31}{48}",
  "confidence": 0.81
}
\`\`\``),
      },
    );

    expect(result.problemText).toContain('\\frac{7}{16}');
    expect(result.correctAnswerCandidate).toContain('\\frac{31}{48}');
    expect(result.confidence).toBe(0.81);
  });

  it('sends the uploaded image using AI SDK image content parts', async () => {
    const callLLM = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        problemText: '识别到一张图',
        confidence: 0.2,
      }),
    });
    const resolveModel = vi.fn().mockResolvedValue({
      model: { provider: 'kimi', modelId: 'moonshotai/kimi-k2.6' },
      modelInfo: { capabilities: { vision: true } },
    });

    vi.doMock('@/lib/ai/llm', () => ({ callLLM }));
    vi.doMock('@/lib/server/resolve-model', () => ({ resolveModel }));

    const { extractFromImage } = await import('./extract-from-image');
    const image = new File(['fake-image'], 'math.png', { type: 'image/png' });

    await extractFromImage(image, { subject: 'math' });

    expect(callLLM).toHaveBeenCalledTimes(1);
    const [params] = callLLM.mock.calls[0];
    const content = params.messages[0].content as Array<Record<string, unknown>>;
    const imagePart = content.find((part) => part.type === 'image');
    const filePart = content.find((part) => part.type === 'file');

    expect(imagePart).toMatchObject({
      type: 'image',
      mimeType: 'image/png',
    });
    expect(imagePart?.image).toBeDefined();
    expect(filePart).toBeUndefined();
  });

  it('prefers DEFAULT_MODEL when MISTAKE_OCR_MODEL is not set', async () => {
    const originalOcr = process.env.MISTAKE_OCR_MODEL;
    const originalDefault = process.env.DEFAULT_MODEL;

    process.env.MISTAKE_OCR_MODEL = '';
    process.env.DEFAULT_MODEL = 'kimi:kimi-k2.6';

    const callLLM = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        problemText: '36 + 27 = ?',
        confidence: 0.2,
      }),
    });
    const resolveModel = vi.fn().mockResolvedValue({
      model: { provider: 'kimi', modelId: 'kimi-k2.6' },
      modelInfo: { capabilities: { vision: true } },
    });

    vi.doMock('@/lib/ai/llm', () => ({ callLLM }));
    vi.doMock('@/lib/server/resolve-model', () => ({ resolveModel }));

    const { extractFromImage } = await import('./extract-from-image');
    const image = new File(['fake-image'], 'math.png', { type: 'image/png' });
    await extractFromImage(image, { subject: 'math' });

    expect(resolveModel).toHaveBeenCalledTimes(1);
    expect(resolveModel).toHaveBeenCalledWith({ modelString: 'kimi:kimi-k2.6' });

    process.env.MISTAKE_OCR_MODEL = originalOcr;
    process.env.DEFAULT_MODEL = originalDefault;
  });
});
