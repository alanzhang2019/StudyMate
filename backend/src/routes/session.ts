import { analyzeSession } from "../workflows/diagnoseMistake.js";
import type { ProblemInput } from "../domain/types.js";

function isOptionalString(value: unknown): value is string | undefined {
  return typeof value === "undefined" || typeof value === "string";
}

function isSupportedGrade(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 4 && value <= 6;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateProblemInput(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return "请求体必须是对象";
  }

  const candidate = value as Record<string, unknown>;

  if (!isSupportedGrade(candidate.grade)) {
    return "grade 必须是 4-6 的整数";
  }

  if (candidate.subject !== "math") {
    return "subject 必须是 math";
  }

  if (candidate.source !== "photo" && candidate.source !== "manual") {
    return "source 必须是 photo 或 manual";
  }

  if (!isNonEmptyString(candidate.problemText)) {
    return "problemText 不能为空";
  }

  if (!isOptionalString(candidate.studentAnswer)) {
    return "studentAnswer 必须是字符串";
  }

  if (!isOptionalString(candidate.correctAnswer)) {
    return "correctAnswer 必须是字符串";
  }

  return null;
}

export async function handleSessionAnalyze(req: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 });
  }

  try {
    const validationError = validateProblemInput(body);
    if (validationError) {
      return Response.json(
        {
          error: validationError,
        },
        { status: 400 },
      );
    }

    const result = analyzeSession(body as ProblemInput);
    return Response.json(result);
  } catch {
    return Response.json({ error: "错题分析失败，请稍后重试" }, { status: 500 });
  }
}
