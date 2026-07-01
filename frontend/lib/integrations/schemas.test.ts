import { z } from 'zod';
import {
  createMistakeJobSchema,
  MAX_PROBLEM_CHARS,
  MAX_ANSWER_CHARS,
  MAX_TITLE_CHARS,
  MAX_SOURCE_CHARS,
} from './schemas';

describe('createMistakeJobSchema', () => {
  it('accepts a minimal valid request', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA',
      problemText: '给定数组求最大子段和。',
    });
    expect(r.success).toBe(true);
  });

  it('rejects math subject (MVP scope: cpp only)', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'math', grade: 4, verdict: 'WA',
      problemText: '36 + 27',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty problemText', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA', problemText: '',
    });
    expect(r.success).toBe(false);
  });

  it('rejects problemText over MAX_PROBLEM_CHARS', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA',
      problemText: 'a'.repeat(MAX_PROBLEM_CHARS + 1),
    });
    expect(r.success).toBe(false);
  });

  it('rejects answer over MAX_ANSWER_CHARS', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA',
      problemText: 'x',
      studentAnswer: 'a'.repeat(MAX_ANSWER_CHARS + 1),
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown verdict', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'XX', problemText: 'x',
    });
    expect(r.success).toBe(false);
  });

  it('accepts problemType and title as optional', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA', problemText: 'x',
      problemType: 'dp', title: 'P1115',
    });
    expect(r.success).toBe(true);
  });

  it('rejects title over MAX_TITLE_CHARS', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA', problemText: 'x',
      title: 'a'.repeat(MAX_TITLE_CHARS + 1),
    });
    expect(r.success).toBe(false);
  });

  it('rejects source over MAX_SOURCE_CHARS', () => {
    const r = createMistakeJobSchema.safeParse({
      subject: 'cpp', grade: 8, verdict: 'WA', problemText: 'x',
      source: 'a'.repeat(MAX_SOURCE_CHARS + 1),
    });
    expect(r.success).toBe(false);
  });
});

// Zod is in the project, this import keeps tree-shaker honest.
void z;
