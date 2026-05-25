import type { DiagnosisResult, MistakeCode, ProblemInput } from '@/lib/mistake/domain/types';
import { getMistakeLabel } from '@/lib/mistake/taxonomy/mistake-taxonomy';

type DiagnosisSummary = Pick<
  DiagnosisResult,
  'normalizedProblemText' | 'guessedMistake' | 'confidence' | 'knowledgePoint' | 'parentSummary'
>;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function toNumber(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function hasCarryCondition(text: string): boolean {
  const match = text.match(/(\d+)\s*\+\s*(\d+)/);

  if (!match) {
    return false;
  }

  const [, left, right] = match;
  const leftDigits = left.split('').reverse();
  const rightDigits = right.split('').reverse();
  const maxLength = Math.max(leftDigits.length, rightDigits.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftDigit = Number(leftDigits[index] ?? '0');
    const rightDigit = Number(rightDigits[index] ?? '0');

    if (leftDigit + rightDigit >= 10) {
      return true;
    }
  }

  return false;
}

function isUnitConversionContext(text: string, lower: string): boolean {
  const units = text.match(/厘米|米|千米|克|千克|小时|分钟/g) ?? [];
  const distinctUnits = new Set(units);
  const hasConversionMeaning =
    lower.includes('换算') || lower.includes('等于') || lower.includes('化成') || lower.includes('转换');

  return hasConversionMeaning || distinctUnits.size >= 2;
}

function inferMistakeCode(input: ProblemInput): { code: MistakeCode; confidence: number } {
  const text = normalizeText(input.problemText);
  const lower = text.toLowerCase();
  const studentAnswer = toNumber(input.studentAnswer);
  const correctAnswer = toNumber(input.correctAnswer);

  if (
    lower.includes('进位') ||
    (hasCarryCondition(text) &&
      studentAnswer !== null &&
      correctAnswer !== null &&
      correctAnswer - studentAnswer === 10)
  ) {
    return { code: 'carry_mistake', confidence: 0.88 };
  }

  if (isUnitConversionContext(text, lower)) {
    return { code: 'unit_conversion_error', confidence: 0.73 };
  }

  return { code: 'concept_gap', confidence: 0.6 };
}

export function diagnoseMistake(input: ProblemInput): DiagnosisSummary {
  const normalizedProblemText = normalizeText(input.problemText);
  const { code, confidence } = inferMistakeCode({
    ...input,
    problemText: normalizedProblemText,
  });
  const mistakeLabel = getMistakeLabel(code);

  return {
    normalizedProblemText,
    guessedMistake: code,
    confidence,
    knowledgePoint: mistakeLabel.name,
    parentSummary: {
      headline: `本次错题更接近“${mistakeLabel.name}”。`,
      nextStep: `优先复习“${mistakeLabel.name}”，并完成 2 道同类题验证是否真正改正。`,
    },
  };
}
