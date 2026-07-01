import type {
  CppMistakeCode,
  DiagnosisResult,
  ProblemInput,
} from '@/lib/mistake/domain/types';
import { cppMistakeTaxonomy } from '@/lib/mistake/taxonomy/cpp-taxonomy';

type DiagnosisSummary = Pick<
  DiagnosisResult,
  'normalizedProblemText' | 'guessedMistake' | 'confidence' | 'knowledgePoint' | 'parentSummary'
>;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function inferCppMistakeCode(
  input: ProblemInput,
): { code: CppMistakeCode; confidence: number } {
  const text = normalizeText(input.problemText);

  if (input.verdict === 'CE') return { code: 'compile_error', confidence: 0.95 };

  if (input.verdict === 'TLE' || /(超时|tle|复杂度过高)/i.test(text)) {
    return { code: 'time_limit', confidence: 0.85 };
  }

  if (input.verdict === 'MLE' || /(内存超限|mle|数组过大)/i.test(text)) {
    return { code: 'memory_limit', confidence: 0.85 };
  }

  if (input.verdict === 'RE' || /(段错误|越界|除零|爆栈|空指针)/i.test(text)) {
    return { code: 'runtime_error', confidence: 0.85 };
  }

  if (input.verdict === 'PE' || /(输出格式|换行|空格|忘了 flush)/i.test(text)) {
    return { code: 'output_format', confidence: 0.8 };
  }

  if (input.verdict === 'WA' && input.problemType === 'dp') {
    return { code: 'concept_gap', confidence: 0.65 };
  }

  if (input.verdict === 'WA') return { code: 'wrong_answer', confidence: 0.7 };

  if (input.verdict === 'AC') return { code: 'concept_gap', confidence: 0.4 };

  return { code: 'concept_gap', confidence: 0.5 };
}

export function diagnoseCppMistake(input: ProblemInput): DiagnosisSummary {
  const normalizedProblemText = normalizeText(input.problemText);
  const { code, confidence } = inferCppMistakeCode({
    ...input,
    problemText: normalizedProblemText,
  });
  const label = cppMistakeTaxonomy[code];

  return {
    normalizedProblemText,
    guessedMistake: code,
    confidence,
    knowledgePoint: label.name,
    parentSummary: {
      headline: `本次 C++ 错题更接近"${label.name}"。`,
      nextStep: `优先复习"${label.name}"相关知识点，并完成 2 道同类题验证。`,
    },
  };
}
