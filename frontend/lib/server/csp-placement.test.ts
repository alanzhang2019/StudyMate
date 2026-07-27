import { describe, expect, it } from 'vitest';
import {
  scoreToLevelJ1,
  combinedLevel,
  FALLBACK_RECOMMENDATIONS,
} from './csp-placement';

describe('scoreToLevelJ1', () => {
  it('returns beginner for score < 40', () => {
    expect(scoreToLevelJ1(0)).toBe('beginner');
    expect(scoreToLevelJ1(20)).toBe('beginner');
    expect(scoreToLevelJ1(39)).toBe('beginner');
  });

  it('returns intermediate for score 40-69', () => {
    expect(scoreToLevelJ1(40)).toBe('intermediate');
    expect(scoreToLevelJ1(55)).toBe('intermediate');
    expect(scoreToLevelJ1(69)).toBe('intermediate');
  });

  it('returns advanced for score >= 70', () => {
    expect(scoreToLevelJ1(70)).toBe('advanced');
    expect(scoreToLevelJ1(100)).toBe('advanced');
  });
});

describe('combinedLevel', () => {
  const baseAnswers = {
    grade: '初二',
    studyMonths: '6-12' as const,
    selfRating: 'mid' as const,
    goal: 'pass-j1' as const,
    hoursPerWeek: '2-5' as const,
    province: null,
    cspJ1: null,
    cspS1: null,
    cspJ2: null,
    cspS2: null,
    gesp: null,
    otherContests: null,
  };

  it('returns advanced when CSP-J2 province-1 reported', () => {
    expect(combinedLevel({
      ...baseAnswers,
      cspJ2: { year: 2024, rank: '省一' },
    })).toBe('advanced');
  });

  it('returns intermediate when GESP 6+ passed', () => {
    expect(combinedLevel({
      ...baseAnswers,
      gesp: { year: 2024, level: 6, passed: true },
    })).toBe('intermediate');
  });

  it('returns advanced when GESP 8 passed', () => {
    expect(combinedLevel({
      ...baseAnswers,
      gesp: { year: 2024, level: 8, passed: true },
    })).toBe('advanced');
  });

  it('returns intermediate when CSP-J1 score >= 50', () => {
    expect(combinedLevel({
      ...baseAnswers,
      cspJ1: { year: 2024, score: 55 },
    })).toBe('intermediate');
  });

  it('falls back to selfRating when no contest data', () => {
    expect(combinedLevel({ ...baseAnswers, selfRating: 'low' })).toBe('beginner');
    expect(combinedLevel({ ...baseAnswers, selfRating: 'mid' })).toBe('intermediate');
    expect(combinedLevel({ ...baseAnswers, selfRating: 'high' })).toBe('advanced');
  });

  it('combines multiple signals: low self-rating + CSP-J2 省二 → advanced', () => {
    expect(combinedLevel({
      ...baseAnswers,
      selfRating: 'low',
      cspJ2: { year: 2024, rank: '省二' },
    })).toBe('advanced');
  });
});

describe('FALLBACK_RECOMMENDATIONS', () => {
  it('has 3 level keys', () => {
    expect(Object.keys(FALLBACK_RECOMMENDATIONS).sort()).toEqual([
      'advanced', 'beginner', 'intermediate',
    ]);
  });

  it('every level has at least 1 recommendation', () => {
    expect(FALLBACK_RECOMMENDATIONS.beginner.length).toBeGreaterThan(0);
    expect(FALLBACK_RECOMMENDATIONS.intermediate.length).toBeGreaterThan(0);
    expect(FALLBACK_RECOMMENDATIONS.advanced.length).toBeGreaterThan(0);
  });

  it('all recommendations reference real csp-lecture classroom ids', () => {
    const all = [
      ...FALLBACK_RECOMMENDATIONS.beginner,
      ...FALLBACK_RECOMMENDATIONS.intermediate,
      ...FALLBACK_RECOMMENDATIONS.advanced,
    ];
    expect(all).toContain('cm_imp_a39914d3af5c64d6');
    expect(all).toContain('cm_imp_cspj2024j_v1');
  });
});
