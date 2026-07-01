import type { DiagnosisResult, ProblemInput } from '@/lib/mistake/domain/types';
import { diagnoseMathMistake } from './diagnose-math';
import { diagnoseCppMistake } from './diagnose-cpp';

export type DiagnosisSummary = Pick<
  DiagnosisResult,
  'normalizedProblemText' | 'guessedMistake' | 'confidence' | 'knowledgePoint' | 'parentSummary'
>;

export function diagnoseMistake(input: ProblemInput): DiagnosisSummary {
  return input.subject === 'cpp' ? diagnoseCppMistake(input) : diagnoseMathMistake(input);
}

export { diagnoseMathMistake, diagnoseCppMistake };
