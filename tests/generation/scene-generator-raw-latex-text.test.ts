import { describe, expect, it } from 'vitest';

import { sanitizeRawLatexInTextElements } from '@/lib/generation/scene-generator';

describe('sanitizeRawLatexInTextElements', () => {
  it('converts raw fraction latex inside text elements into student-readable plain text', () => {
    const output = sanitizeRawLatexInTextElements([
      {
        id: 'text_1',
        type: 'text',
        left: 0,
        top: 0,
        width: 300,
        height: 80,
        rotate: 0,
        content: '<p>甲干8天完成 \\frac{1}{2}</p><p>一共完成 \\frac{5}{6}</p>',
        defaultFontName: '',
        defaultColor: '#000000',
      },
    ]);

    expect(output).toHaveLength(1);
    expect(output[0].type).toBe('text');
    if (output[0].type === 'text') {
      expect(output[0].content).toContain('1/2');
      expect(output[0].content).toContain('5/6');
      expect(output[0].content).not.toContain('\\frac');
    }
  });
});
