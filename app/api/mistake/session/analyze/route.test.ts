import { describe, expect, it } from 'vitest';

import { POST } from './route';

describe('POST /api/mistake/session/analyze', () => {
  it('returns diagnosis, explanation, and practice suggestions', async () => {
    const request = new Request('http://localhost/api/mistake/session/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grade: 4,
        subject: 'math',
        source: 'manual',
        problemText: '36 + 27 = 53，我忘记进位了',
        studentAnswer: '53',
        correctAnswer: '63',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    const json = await response.json();

    expect(json).toMatchObject({
      input: {
        grade: 4,
        subject: 'math',
        source: 'manual',
        problemText: '36 + 27 = 53，我忘记进位了',
        studentAnswer: '53',
        correctAnswer: '63',
      },
      diagnosis: {
        guessedMistake: 'carry_mistake',
        explanationForChild:
          '这道题像是在加法进位时漏掉了前一位要多加 1。先把个位相加，满十以后把 1 送到十位，再算十位会更稳。',
        knowledgePoint: '进位错误',
      },
    });

    expect(json.diagnosis.practiceSuggestions).toHaveLength(2);
  });
});
