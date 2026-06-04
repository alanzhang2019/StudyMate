import { getMistakeLabel } from "../data/taxonomy.js";
import type {
  AnalyzeSessionResponse,
  MistakeCode,
  PracticeSuggestion,
  ProblemInput,
} from "../domain/types.js";

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function toNumber(value?: string): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function inferMistakeCode(input: ProblemInput): { code: MistakeCode; confidence: number } {
  const text = normalizeText(input.problemText);
  const studentAnswer = toNumber(input.studentAnswer);
  const correctAnswer = toNumber(input.correctAnswer);
  const lower = text.toLowerCase();

  if (
    lower.includes("进位") ||
    /(\d+)\s*\+\s*(\d+)/.test(text) && studentAnswer !== null && correctAnswer !== null && correctAnswer - studentAnswer === 10
  ) {
    return { code: "carry_mistake", confidence: 0.88 };
  }

  if (
    lower.includes("退位") ||
    lower.includes("借位") ||
    /(\d+)\s*-\s*(\d+)/.test(text) && studentAnswer !== null && correctAnswer !== null && Math.abs(correctAnswer - studentAnswer) === 10
  ) {
    return { code: "borrow_mistake", confidence: 0.84 };
  }

  if (/[()（）]/.test(text) || lower.includes("括号") || lower.includes("顺序")) {
    return { code: "bracket_order_error", confidence: 0.75 };
  }

  if (
    /(厘米|米|千米|克|千克|小时|分钟)/.test(text) ||
    lower.includes("单位")
  ) {
    return { code: "unit_conversion_error", confidence: 0.73 };
  }

  if (
    /(加成减|减成加|乘成加|除成乘|运算符)/.test(text) ||
    lower.includes("混淆")
  ) {
    return { code: "operator_confusion", confidence: 0.72 };
  }

  return { code: "concept_gap", confidence: 0.6 };
}

function buildPracticeSuggestions(code: MistakeCode): PracticeSuggestion[] {
  const map: Record<MistakeCode, PracticeSuggestion[]> = {
    carry_mistake: [
      { prompt: "试一试：48 + 27 = ?", answer: "75" },
      { prompt: "再做一道：56 + 18 = ?", answer: "74" },
    ],
    borrow_mistake: [
      { prompt: "试一试：72 - 38 = ?", answer: "34" },
      { prompt: "再做一道：61 - 26 = ?", answer: "35" },
    ],
    operator_confusion: [
      { prompt: "判断：12 - 5 和 12 + 5 的结果一样吗？", answer: "不一样" },
      { prompt: "计算：9 x 3 = ?", answer: "27" },
    ],
    bracket_order_error: [
      { prompt: "先算括号：(8 + 4) x 2 = ?", answer: "24" },
      { prompt: "再试：18 - (6 + 3) = ?", answer: "9" },
    ],
    unit_conversion_error: [
      { prompt: "1 米 = ? 厘米", answer: "100" },
      { prompt: "2 小时 = ? 分钟", answer: "120" },
    ],
    concept_gap: [
      { prompt: "把题目中的已知条件和问题各说一遍。", answer: "按题意复述即可" },
      { prompt: "再做一道同知识点基础题。", answer: "根据老师或系统推荐题目完成" },
    ],
  };

  return map[code];
}

function buildExplanation(code: MistakeCode): { explanation: string; knowledgePoint: string } {
  const label = getMistakeLabel(code);

  const explanationMap: Record<MistakeCode, { explanation: string; knowledgePoint: string }> = {
    carry_mistake: {
      explanation: "这道题像是在加法进位时漏掉了前一位要多加 1。先把个位相加，满十以后把 1 送到十位，再算十位会更稳。",
      knowledgePoint: "两位数加法进位",
    },
    borrow_mistake: {
      explanation: "这道题可能是在减法退位时忘了先借 1。先看看个位够不够减，不够就向前一位借，再继续算。",
      knowledgePoint: "两位数减法退位",
    },
    operator_confusion: {
      explanation: "你可能把要用的运算看混了。先判断题目是在求一共、剩下、几倍还是平均分，再选加减乘除。",
      knowledgePoint: "四则运算含义",
    },
    bracket_order_error: {
      explanation: "这道题要先算括号里面，或者先按正确顺序算。把第一步圈出来，再一步一步往后做，就不容易乱。",
      knowledgePoint: "括号与运算顺序",
    },
    unit_conversion_error: {
      explanation: "这道题更像是单位换算出了问题。先把单位统一，再开始算，这样结果会更准确。",
      knowledgePoint: "常见单位换算",
    },
    concept_gap: {
      explanation: "这道题不只是算错，更像是知识点还没完全弄懂。先把题目在问什么、已知什么说清楚，再开始列式。",
      knowledgePoint: label.name,
    },
  };

  return explanationMap[code];
}

export function analyzeSession(input: ProblemInput): AnalyzeSessionResponse {
  const normalizedProblemText = normalizeText(input.problemText);
  const { code, confidence } = inferMistakeCode({
    ...input,
    problemText: normalizedProblemText,
  });
  const { explanation, knowledgePoint } = buildExplanation(code);
  const mistakeLabel = getMistakeLabel(code);

  return {
    input: {
      ...input,
      problemText: normalizedProblemText,
    },
    diagnosis: {
      normalizedProblemText,
      guessedMistake: code,
      confidence,
      explanationForChild: explanation,
      knowledgePoint,
      practiceSuggestions: buildPracticeSuggestions(code),
      parentSummary: {
        headline: `本次错题更接近“${mistakeLabel.name}”问题。`,
        nextStep: `优先复习“${knowledgePoint}”，并完成 2 道同类题验证是否真正改正。`,
      },
    },
  };
}
