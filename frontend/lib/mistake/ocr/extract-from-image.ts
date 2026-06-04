import { Buffer } from 'node:buffer';
import { z } from 'zod';

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveModel, type ResolvedModel } from '@/lib/server/resolve-model';
import { createLogger } from '@/lib/logger';

import { normalizeExtraction } from './normalize-extraction';
import type { ExtractImageOptions, MistakeImageExtraction } from './types';

const log = createLogger('OCR');

const extractionSchema = z.object({
  problemText: z.string().optional(),
  studentAnswer: z.string().optional(),
  correctAnswerCandidate: z.string().optional(),
  confidence: z.preprocess((val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/[^0-9.]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return undefined;
  }, z.number().optional()),
});

function parseExtractionJson(rawModelText: string) {
  try {
    const parsed = parseJsonResponse<unknown>(rawModelText);
    if (!parsed) {
      throw new Error('Failed to parse OCR JSON');
    }
    return extractionSchema.parse(parsed);
  } catch (e) {
    console.error("=== OCR PARSE ERROR ===");
    console.error("Error:", e);
    console.error("Raw text:", rawModelText);
    console.error("=======================");
    log.error('JSON parse error in OCR:', e, 'Raw text:', rawModelText);
    throw e;
  }
}

export interface ExtractDependencies {
  callModel?: (input: { image: File; options: ExtractImageOptions }) => Promise<string>;
  resolvedModel?: ResolvedModel;
}

function uniqStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

async function resolveOcrModel(preferredResolvedModel?: ResolvedModel) {
  const candidates = uniqStrings([
    process.env.MISTAKE_OCR_MODEL,
    process.env.DEFAULT_MODEL,
    'kimi:kimi-k2.6',
    'openai:gpt-4o-mini',
  ]);

  const failures: string[] = [];

  if (preferredResolvedModel) {
    if (preferredResolvedModel.modelInfo?.capabilities?.vision === false) {
      failures.push(`${preferredResolvedModel.modelString}: vision_not_supported`);
    } else {
      return preferredResolvedModel;
    }
  }

  for (const modelString of candidates) {
    try {
      const resolved = await resolveModel({ modelString });
      if (resolved.modelInfo?.capabilities?.vision === false) {
        failures.push(`${modelString}: vision_not_supported`);
        continue;
      }
      return resolved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${modelString}: ${message}`);
    }
  }

  throw new Error(
    `OCR 模型不可用：没有找到可用的视觉模型。\n已尝试：${failures.join(' | ')}\n请配置 MISTAKE_OCR_MODEL 或 DEFAULT_MODEL 指向支持图片的模型（例如 kimi:kimi-k2.6 / openai:gpt-4o-mini），并确保对应的 *_API_KEY 已填写。`,
  );
}

async function callVisionModel(input: {
  image: File;
  options: ExtractImageOptions;
  preferredResolvedModel?: ResolvedModel;
}): Promise<string> {
  const resolved = await resolveOcrModel(input.preferredResolvedModel);

  const result = await callLLM(
    {
      model: resolved.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                '你是数学错题图片识别专家。请仔细识别图片中的数学题目，提取以下字段：problemText（题目内容）、studentAnswer（学生答案）、correctAnswerCandidate（正确答案）、confidence（置信度）。\n\n重要规则：\n1. 只提取数学题目相关内容，绝对不要提取学生姓名、班级、学号、批改痕迹、鼓励语等与数学无关的内容。\n2. 对于数学公式和分数，请使用纯文本格式，易于学生阅读：\n   - 分数使用斜杠格式：如 7/16 写作 7/16，(7/16 - 5/24) 写作 (7/16 - 5/24)\n   - 方程中的未知数保持原样，如 x、y\n   - 等号使用 =，不要遗漏\n   - 乘号使用 ×，除号使用 ÷\n3. 仔细识别图片中的每一个数字、符号和运算符，确保准确无误。\n4. 如果题目是解方程，请完整提取方程表达式。\n5. 只返回纯JSON字符串，不要任何额外的说明、换行符或 Markdown 代码块标识符（如 ``` json）。\n6. 如果看不清可以留空，不要编造。\n7. confidence必须是0到1之间的数字类型（如 0.95，绝对不能带引号或百分号）。\n8. 【关键】必须保持题目原始表述的一致性：\n   - 题目中使用的人物名称（如甲/乙/A/B/小明/小红等）必须与图片完全一致，不得替换或改写\n   - 题目中使用的专业术语和措辞（如工程/工作/项目等）必须与图片完全一致\n   - 不得将甲/乙改为A/B，也不得将工程改为工作等\n   - 必须逐字忠实提取题目原文，只做必要的格式规范化（如分数格式）\n\n示例输出格式：{"problemText":"解方程：x - (7/16 - 5/24) = 7/24","studentAnswer":"","correctAnswerCandidate":"","confidence":0.95}',
            },
            {
              type: 'text',
              text: `subject=${input.options.subject}; grade=${input.options.grade ?? 'unknown'}`,
            },
            {
              type: 'image',
              image: Buffer.from(await input.image.arrayBuffer()),
              mimeType: input.image.type,
            },
          ],
        },
      ],
    },
    'mistake-ocr-extract',
    { retries: 2 },
  );

  return result.text;
}

export async function extractFromImage(
  image: File,
  options: ExtractImageOptions,
  dependencies: ExtractDependencies = {},
): Promise<MistakeImageExtraction> {
  const rawModelText = await (dependencies.callModel ??
    ((input) =>
      callVisionModel({
        ...input,
        preferredResolvedModel: dependencies.resolvedModel,
      })))({ image, options });
  const parsed = parseExtractionJson(rawModelText);

  return normalizeExtraction({
    ...parsed,
    rawModelText,
  });
}
