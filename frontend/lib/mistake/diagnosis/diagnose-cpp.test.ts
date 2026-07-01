import { describe, expect, it } from 'vitest';
import { diagnoseCppMistake } from './diagnose-cpp';
import type { ProblemInput } from '@/lib/mistake/domain/types';

const base: ProblemInput = {
  grade: 8,
  subject: 'cpp',
  source: 'integration',
  problemText: '给定长度为 n 的数组，求最大子段和。',
};

describe('diagnoseCppMistake', () => {
  it('CE -> compile_error', () => {
    const r = diagnoseCppMistake({ ...base, verdict: 'CE' });
    expect(r.guessedMistake).toBe('compile_error');
    expect(r.confidence).toBeGreaterThan(0.9);
  });
  it('TLE -> time_limit', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'TLE' }).guessedMistake).toBe('time_limit');
  });
  it('MLE -> memory_limit', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'MLE' }).guessedMistake).toBe('memory_limit');
  });
  it('RE -> runtime_error', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'RE' }).guessedMistake).toBe('runtime_error');
  });
  it('PE -> output_format', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'PE' }).guessedMistake).toBe('output_format');
  });
  it('WA + dp -> concept_gap', () => {
    expect(
      diagnoseCppMistake({ ...base, verdict: 'WA', problemType: 'dp' }).guessedMistake,
    ).toBe('concept_gap');
  });
  it('WA alone -> wrong_answer', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'WA' }).guessedMistake).toBe('wrong_answer');
  });
  it('AC -> concept_gap', () => {
    expect(diagnoseCppMistake({ ...base, verdict: 'AC' }).guessedMistake).toBe('concept_gap');
  });
  it('default -> concept_gap', () => {
    expect(diagnoseCppMistake({ ...base }).guessedMistake).toBe('concept_gap');
  });
  it('keyword 段错误 overrides WA verdict -> runtime_error', () => {
    const r = diagnoseCppMistake({
      ...base,
      verdict: 'WA',
      problemText: '运行时出现段错误',
    });
    expect(r.guessedMistake).toBe('runtime_error');
  });
});
