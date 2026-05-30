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
                '你是数学错题图片识别专家。请仔细识别图片中的数学题目，提取以下字段：problemText（题目内容）、studentAnswer（学生答案）、correctAnswerCandidate（正确答案）、confidence（置信度）。\n\n重要规则：\n1. 只提取数学题目相关内容，绝对不要提取学生姓名、班级、学号、批改痕迹、鼓励语等与数学无关的内容。\n2. 对于数学公式和分数，请使用纯文本格式，易于学生阅读：\n   - 分数使用斜杠格式：如 7/16 写作 7/16，(7/16 - 5/24) 写作 (7/16 - 5/24)\n   - 方程中的未知数保持原样，如 x、y\n   - 等号使用 =，不要遗漏\n   - 乘号使用 ×，除号使用 ÷\n3. 仔细识别图片中的每一个数字、符号和运算符，确保准确无误。\n4. 如果题目是解方程，请完整提取方程表达式。\n5. 只返回纯JSON字符串，不要任何额外的说明、换行符或 Markdown 代码块标识符（如 ``` json）。\n6. 如果看不清可以留空，不要编造。\n7. confidence必须是0到1之间的数字类型（如 0.95，绝对不能带引号或百分号）。\n\n示例输出格式：{"problemText":"解方程：x - (7/16 - 5/24) = 7/24","studentAnswer":"","correctAnswerCandidate":"","confidence":0.95}',
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
