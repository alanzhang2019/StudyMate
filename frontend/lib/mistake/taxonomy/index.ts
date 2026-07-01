import type { MistakeCode } from '@/lib/mistake/domain/types';
import { type MistakeLabel, mathMistakeTaxonomy } from './math-taxonomy';
import { cppMistakeTaxonomy } from './cpp-taxonomy';

export type { MistakeLabel };

const MATH_CODES: ReadonlySet<string> = new Set(Object.keys(mathMistakeTaxonomy));
const CPP_CODES: ReadonlySet<string> = new Set(Object.keys(cppMistakeTaxonomy));

export class UnknownMistakeCodeError extends Error {
  constructor(public code: string) {
    super(`Unknown mistake code: ${code}`);
    this.name = 'UnknownMistakeCodeError';
  }
}

export function getMistakeLabel(code: MistakeCode): MistakeLabel {
  if (MATH_CODES.has(code)) {
    return mathMistakeTaxonomy[code as keyof typeof mathMistakeTaxonomy];
  }
  if (CPP_CODES.has(code)) {
    return cppMistakeTaxonomy[code as keyof typeof cppMistakeTaxonomy];
  }
  throw new UnknownMistakeCodeError(code);
}

export function getMistakeLabelOrUnknown(code: string): MistakeLabel | null {
  try {
    return getMistakeLabel(code as MistakeCode);
  } catch {
    return null;
  }
}
