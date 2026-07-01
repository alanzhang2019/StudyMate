import type { CppMistakeCode, MistakeCode } from '@/lib/mistake/domain/types';
import { explainMathForChild } from './math-explain';
import { explainCppForChild } from './cpp-explain';
import type { MathMistakeCode } from '@/lib/mistake/domain/types';

const CPP_CODES: ReadonlySet<string> = new Set([
  'compile_error', 'wrong_answer', 'runtime_error',
  'time_limit', 'memory_limit', 'output_format',
]);

export function explainForChild(code: MistakeCode, problemText?: string): string {
  if (CPP_CODES.has(code)) {
    return explainCppForChild(code as CppMistakeCode, problemText);
  }
  return explainMathForChild(code as MathMistakeCode, problemText);
}
