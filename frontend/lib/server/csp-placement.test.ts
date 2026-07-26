import { describe, expect, it } from 'vitest';
import { scoreToLevel, levelLabel } from './csp-placement';

describe('scoreToLevel', () => {
  it('returns beginner for 0-30', () => {
    expect(scoreToLevel(0)).toBe('beginner');
    expect(scoreToLevel(15)).toBe('beginner');
    expect(scoreToLevel(30)).toBe('beginner');
  });

  it('returns intermediate for 31-70', () => {
    expect(scoreToLevel(31)).toBe('intermediate');
    expect(scoreToLevel(50)).toBe('intermediate');
    expect(scoreToLevel(70)).toBe('intermediate');
  });

  it('returns advanced for 71-100', () => {
    expect(scoreToLevel(71)).toBe('advanced');
    expect(scoreToLevel(85)).toBe('advanced');
    expect(scoreToLevel(100)).toBe('advanced');
  });

  it('clamps out-of-range', () => {
    expect(scoreToLevel(-5)).toBe('beginner');
    expect(scoreToLevel(150)).toBe('advanced');
  });
});

describe('levelLabel', () => {
  it('returns Chinese labels', () => {
    expect(levelLabel('beginner')).toBe('入门');
    expect(levelLabel('intermediate')).toBe('中级');
    expect(levelLabel('advanced')).toBe('高级');
  });
});
