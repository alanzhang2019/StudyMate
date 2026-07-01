import { describe, expect, it } from 'vitest';
import { cppMistakeTaxonomy } from './cpp-taxonomy';
import { getMistakeLabel } from './index';
import type { CppMistakeCode, MathMistakeCode } from '@/lib/mistake/domain/types';

describe('cppMistakeTaxonomy', () => {
  const codes: CppMistakeCode[] = [
    'compile_error', 'wrong_answer', 'runtime_error',
    'time_limit', 'memory_limit', 'output_format', 'concept_gap',
  ];

  it('covers every CppMistakeCode', () => {
    for (const code of codes) {
      expect(cppMistakeTaxonomy[code]).toBeDefined();
      expect(cppMistakeTaxonomy[code].name).toBeTruthy();
      expect(cppMistakeTaxonomy[code].triggers.length).toBeGreaterThan(0);
    }
  });
});

describe('getMistakeLabel dispatcher', () => {
  it('returns math label for math codes', () => {
    const label = getMistakeLabel('carry_mistake' as MathMistakeCode);
    expect(label.name).toBe('进位错误');
  });
  it('returns cpp label for cpp codes', () => {
    const label = getMistakeLabel('compile_error' as CppMistakeCode);
    expect(label.name).toBe('编译错误');
  });
});
