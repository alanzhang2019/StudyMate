import { Buffer } from 'node:buffer';
import { z } from 'zod';

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveModel } from '@/lib/server/resolve-model';
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
}

async function callVisionModel(input: {
  image: File;
  options: ExtractImageOptions;
}): Promise<string> {
  const resolved = await resolveModel({
    modelString: process.env.MISTAKE_OCR_MODEL || 'openai/gpt-4o-mini',
  });

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
                '你是数学错题图片提取器。只处理单题单图。请提取 problemText、studentAnswer、correctAnswerCandidate、confidence。重要规则：1. 绝对不要提取图片中的学生姓名、班级、学号、批改痕迹（如打分）、鼓励语（如"加油"、"进步的阶梯"等）以及任何与数学题目无关的内容。2. 只返回纯JSON字符串，不要任何额外的说明、换行符或 Markdown 代码块标识符（如 ```json）。如果看不清可以留空，不要编造。3. confidence必须是0到1之间的数字类型（如 0.95，绝对不能带引号或百分号）。',
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
  const rawModelText = await (dependencies.callModel ?? callVisionModel)({
    image,
    options,
  });
  const parsed = parseExtractionJson(rawModelText);

  return normalizeExtraction({
    ...parsed,
    rawModelText,
  });
}
