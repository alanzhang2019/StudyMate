import type {
  CppMistakeCode,
  MathMistakeCode,
  MistakeCode,
  PracticeSuggestion,
} from '@/lib/mistake/domain/types';
import { generateMathPractice } from './math-practice';
import { generateCppPractice } from './cpp-practice';

const CPP_CODES: ReadonlySet<string> = new Set([
  'compile_error', 'wrong_answer', 'runtime_error',
  'time_limit', 'memory_limit', 'output_format',
]);

export function generatePractice(code: MistakeCode): PracticeSuggestion[] {
  if (CPP_CODES.has(code)) {
    return generateCppPractice(code as CppMistakeCode);
  }
  return generateMathPractice(code as MathMistakeCode);
}
