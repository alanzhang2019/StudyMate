import { NextRequest } from 'next/server';
import { z } from 'zod';

import { extractFromImage } from '@/lib/mistake/ocr/extract-from-image';
import { normalizeExtraction } from '@/lib/mistake/ocr/normalize-extraction';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { normalizeAiErrorMessage } from '@/lib/server/normalize-ai-error';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';

const bodySchema = z.object({
  subject: z.literal('math'),
  grade: z.number().int().min(1).max(12).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');
    const additionalImages = formData.getAll('additionalImages');
    const imageCount = Number(formData.get('imageCount') || '1');

    if (!(image instanceof File)) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Image file is required');
    }

    if (!image.type.startsWith('image/')) {
      return apiError('INVALID_REQUEST', 400, 'Only image uploads are supported');
    }

    const parsed = bodySchema.safeParse({
      subject: (formData.get('subject') as string | null) || 'math',
      grade: formData.get('grade') ? Number(formData.get('grade')) : undefined,
    });

    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Invalid extract request');
    }

    const hasModelHeaders = Boolean(
      request.headers.get('x-model') ||
        request.headers.get('x-api-key') ||
        request.headers.get('x-base-url') ||
        request.headers.get('x-provider-type'),
    );
    const resolvedFromHeaders = hasModelHeaders
      ? await resolveModelFromHeaders(request).catch(() => null)
      : null;

    // Process primary image
    let extraction = await extractFromImage(image, parsed.data, {
      resolvedModel: resolvedFromHeaders ?? undefined,
    });

    // Process additional images if present
    const validAdditionalImages = additionalImages.filter(
      (img): img is File => img instanceof File && img.type.startsWith('image/')
    );

    if (validAdditionalImages.length > 0) {
      // Extract text from additional images and append
      const additionalTexts: string[] = [];
      
      for (const additionalImage of validAdditionalImages) {
        try {
          const additionalExtraction = await extractFromImage(additionalImage, parsed.data, {
            resolvedModel: resolvedFromHeaders ?? undefined,
          });
          if (additionalExtraction.problemText && additionalExtraction.problemText.trim()) {
            additionalTexts.push(additionalExtraction.problemText.trim());
          }
        } catch (err) {
          console.warn('[Extract] Failed to process additional image:', err);
        }
      }

      // Merge problem texts from all images
      if (additionalTexts.length > 0) {
        const mergedProblemText = [extraction.problemText, ...additionalTexts]
          .filter(Boolean)
          .join('\n\n');
        
        extraction = {
          ...extraction,
          problemText: mergedProblemText,
          confidence: Math.min(extraction.confidence + 0.1, 1.0), // Slight confidence boost for multi-image
        };
      }
    }

    if (extraction.confidence === 0 && extraction.rawModelText?.includes('ocr-error')) {
      return apiSuccess({ extraction });
    }

    return apiSuccess({ extraction });
  } catch (error) {
    const details = normalizeAiErrorMessage(error);
    const extraction = normalizeExtraction({
      confidence: 0,
      rawModelText: `[ocr-error] ${details}`,
    });

    return apiSuccess({ extraction });
  }
}
