/**
 * Scene Outlines Streaming API (SSE)
 *
 * Streams outline generation via Server-Sent Events.
 * Emits individual outline objects as they're parsed from the LLM response,
 * so the frontend can display them incrementally.
 *
 * SSE events:
 *   { type: 'languageDirective', data: string }
 *   { type: 'outline', data: SceneOutline, index: number }
 *   { type: 'done', outlines: SceneOutline[], languageDirective: string }
 *   { type: 'error', error: string }
 */

import { NextRequest } from 'next/server';
import { callLLM, streamLLM } from '@/lib/ai/llm';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import {
  formatImageDescription,
  formatImagePlaceholder,
  buildVisionUserContent,
  uniquifyMediaElementIds,
  formatTeacherPersonaForPrompt,
} from '@/lib/generation/generation-pipeline';
import type { AgentInfo } from '@/lib/generation/generation-pipeline';
import { DEFAULT_LANGUAGE_DIRECTIVE } from '@/lib/generation/outline-generator';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation';
import { nanoid } from 'nanoid';
import type {
  UserRequirements,
  PdfImage,
  SceneOutline,
  ImageMapping,
} from '@/lib/types/generation';
import { apiError } from '@/lib/server/api-response';
import { normalizeAiErrorMessage } from '@/lib/server/normalize-ai-error';
import { createLogger } from '@/lib/logger';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
const log = createLogger('Outlines Stream');

export const maxDuration = 300;

async function generateOutlinesFallback(params: {
  streamParams:
    | {
        model: unknown;
        system: string;
        prompt: string;
        maxOutputTokens?: number;
      }
    | {
        model: unknown;
        system: string;
        messages: Array<{ role: 'user'; content: unknown }>;
        maxOutputTokens?: number;
      };
  thinkingConfig?: unknown;
}): Promise<{ outlines: SceneOutline[]; languageDirective: string } | null> {
  const result = await callLLM(
    params.streamParams as Parameters<typeof callLLM>[0],
    'scene-outlines-fallback',
    undefined,
    params.thinkingConfig as Parameters<typeof callLLM>[3],
  );
  const parsed = parseJsonResponse<
    { languageDirective?: string; outlines?: SceneOutline[] } | SceneOutline[]
  >(result.text);

  const rawOutlines = Array.isArray(parsed) ? parsed : parsed?.outlines;
  if (!rawOutlines || !Array.isArray(rawOutlines) || rawOutlines.length === 0) {
    return null;
  }

  return {
    outlines: rawOutlines.map((outline, index) => ({
      ...outline,
      id: outline.id || nanoid(),
      order: index + 1,
    })),
    languageDirective:
      (Array.isArray(parsed) ? undefined : parsed?.languageDirective) || DEFAULT_LANGUAGE_DIRECTIVE,
  };
}

export function createSseWriter(params: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  signal?: AbortSignal;
  onClose?: () => void;
}) {
  const { controller, encoder, signal, onClose } = params;
  let closed = false;

  const close = () => {
    if (closed) return false;
    closed = true;
    if (signal) {
      signal.removeEventListener('abort', close);
    }
    onClose?.();
    try {
      controller.close();
    } catch {
      // Ignore duplicate close errors after the client disconnects.
    }
    return true;
  };

  const send = (payload: string) => {
    if (closed || signal?.aborted) return false;
    try {
      controller.enqueue(encoder.encode(payload));
      return true;
    } catch {
      close();
      return false;
    }
  };

  if (signal) {
    signal.addEventListener('abort', close, { once: true });
  }

  return {
    sendComment(comment: string) {
      return send(`:${comment}\n\n`);
    },
    sendEvent(event: unknown) {
      return send(`data: ${JSON.stringify(event)}\n\n`);
    },
    close,
    isClosed() {
      return closed || !!signal?.aborted;
    },
  };
}

/**
 * Extract the languageDirective from the streamed wrapper JSON.
 * Matches `"languageDirective":"<value>"` in partial JSON like:
 *   {"languageDirective":"用中文授课...","outlines":[...
 */
function extractLanguageDirective(buffer: string): string | null {
  const match = buffer.match(/"languageDirective"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

/**
 * Incremental JSON array parser.
 * Extracts complete top-level objects from a partially-streamed JSON array.
 * Supports both a flat array `[{...},{...}]` and a wrapper object
 * `{"languageDirective":"...","outlines":[{...},{...}]}`.
 * Returns newly found objects (skipping `alreadyParsed` count).
 */
function extractNewOutlines(buffer: string, alreadyParsed: number): SceneOutline[] {
  const results: SceneOutline[] = [];

  // Strip markdown fencing if present
  const stripped = buffer.replace(/^[\s\S]*?(?=[\[{])/, '');

  // Find the outlines array — either nested in {"outlines": [...]} or a flat array
  let arrayStart = -1;
  const outlinesKeyIdx = stripped.indexOf('"outlines"');
  if (outlinesKeyIdx >= 0) {
    // Wrapper format: find [ after "outlines":
    arrayStart = stripped.indexOf('[', outlinesKeyIdx);
  } else {
    // Flat array fallback
    arrayStart = stripped.indexOf('[');
  }

  if (arrayStart === -1) return results;

  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;
  let objectCount = 0;

  for (let i = arrayStart + 1; i < stripped.length; i++) {
    const char = stripped[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        objectCount++;
        if (objectCount > alreadyParsed) {
          try {
            const obj = JSON.parse(stripped.substring(objectStart, i + 1));
            results.push(obj);
          } catch {
            // Incomplete or invalid JSON — skip
          }
        }
        objectStart = -1;
      }
    }
  }

  return results;
}

export async function POST(req: NextRequest) {
  let requirementSnippet: string | undefined;
  let resolvedModelString: string | undefined;
  try {
    const body = await req.json();

    // Get API configuration from request headers/body
    const {
      model: languageModel,
      modelInfo,
      modelString,
      thinkingConfig,
    } = await resolveModelFromRequest(req, body);
    resolvedModelString = modelString;

    if (!body.requirements) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Requirements are required');
    }

    const { requirements, pdfText, pdfImages, imageMapping, researchContext, agents } = body as {
      requirements: UserRequirements;
      pdfText?: string;
      pdfImages?: PdfImage[];
      imageMapping?: ImageMapping;
      researchContext?: string;
      agents?: AgentInfo[];
    };
    requirementSnippet = requirements?.requirement?.substring(0, 60);

    // Build user profile string for language inference context
    const userProfileText =
      requirements.userNickname || requirements.userBio
        ? `## Student Profile\n\nStudent: ${requirements.userNickname || 'Unknown'}${requirements.userBio ? ` — ${requirements.userBio}` : ''}\n\nConsider this student's background when designing the course. Adapt difficulty, examples, and teaching approach accordingly.\n\n---`
        : '';

    // Detect vision capability
    const hasVision = !!modelInfo?.capabilities?.vision;

    // Build prompt (same logic as generateSceneOutlinesFromRequirements)
    let availableImagesText = 'No images available';
    let visionImages: Array<{ id: string; src: string }> | undefined;

    if (pdfImages && pdfImages.length > 0) {
      if (hasVision && imageMapping) {
        // Vision mode: split into vision images (first N) and text-only (rest)
        const allWithSrc = pdfImages.filter((img) => imageMapping[img.id]);
        const visionSlice = allWithSrc.slice(0, MAX_VISION_IMAGES);
        const textOnlySlice = allWithSrc.slice(MAX_VISION_IMAGES);
        const noSrcImages = pdfImages.filter((img) => !imageMapping[img.id]);

        const visionDescriptions = visionSlice.map((img) => formatImagePlaceholder(img));
        const textDescriptions = [...textOnlySlice, ...noSrcImages].map((img) =>
          formatImageDescription(img),
        );
        availableImagesText = [...visionDescriptions, ...textDescriptions].join('\n');

        visionImages = visionSlice.map((img) => ({
          id: img.id,
          src: imageMapping[img.id],
          width: img.width,
          height: img.height,
        }));
      } else {
        // Text-only mode: full descriptions
        availableImagesText = pdfImages.map((img) => formatImageDescription(img)).join('\n');
      }
    }

    // Build media snippet conditions based on enabled flags.
    const imageGenerationEnabled = req.headers.get('x-image-generation-enabled') === 'true';
    const videoGenerationEnabled = req.headers.get('x-video-generation-enabled') === 'true';
    const mediaGenerationEnabled = imageGenerationEnabled || videoGenerationEnabled;
    const hasSourceImages = (pdfImages?.length ?? 0) > 0;

    // Build teacher context from agents (if available)
    const teacherContext = formatTeacherPersonaForPrompt(agents);

    // Check if Interactive Mode is enabled
    const interactiveMode = requirements.interactiveMode ?? false;
    const promptId = interactiveMode
      ? PROMPT_IDS.INTERACTIVE_OUTLINES
      : PROMPT_IDS.REQUIREMENTS_TO_OUTLINES;

    const prompts = buildPrompt(promptId, {
      requirement: requirements.requirement,
      pdfContent: pdfText ? pdfText.substring(0, MAX_PDF_CONTENT_CHARS) : 'None',
      availableImages: availableImagesText,
      researchContext: researchContext || 'None',
      hasSourceImages,
      imageEnabled: imageGenerationEnabled,
      videoEnabled: videoGenerationEnabled,
      mediaEnabled: mediaGenerationEnabled,
      teacherContext,
      userProfile: userProfileText,
    });

    if (!prompts) {
      return apiError('INTERNAL_ERROR', 500, 'Prompt template not found');
    }

    log.info(
      `Generating outlines: "${requirements.requirement.substring(0, 50)}" [model=${modelString}]`,
    );

    // Create SSE stream with heartbeat to prevent connection timeout
    const encoder = new TextEncoder();
    const HEARTBEAT_INTERVAL_MS = 15_000;
    const signal = req.signal;
    const stream = new ReadableStream({
      async start(controller) {
        // Heartbeat: periodically send SSE comments to keep the connection alive.
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        const stopHeartbeat = () => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        };
        const writer = createSseWriter({
          controller,
          encoder,
          signal,
          onClose: stopHeartbeat,
        });
        const startHeartbeat = () => {
          stopHeartbeat();
          heartbeatTimer = setInterval(() => {
            if (!writer.sendComment('heartbeat')) {
              stopHeartbeat();
            }
          }, HEARTBEAT_INTERVAL_MS);
        };

        const MAX_STREAM_RETRIES = 2;

        try {
          startHeartbeat();

          const streamParams = visionImages?.length
            ? {
                model: languageModel,
                system: prompts.system,
                messages: [
                  {
                    role: 'user' as const,
                    content: buildVisionUserContent(prompts.user, visionImages),
                  },
                ],
                maxOutputTokens: modelInfo?.outputWindow,
              }
            : {
                model: languageModel,
                system: prompts.system,
                prompt: prompts.user,
                maxOutputTokens: modelInfo?.outputWindow,
              };

          let parsedOutlines: SceneOutline[] = [];
          let languageDirective: string | null = null;
          let lastError: string | undefined;

          for (let attempt = 1; attempt <= MAX_STREAM_RETRIES + 1; attempt++) {
            try {
              if (writer.isClosed()) break;
              let fullText = '';
              parsedOutlines = [];
              languageDirective = null;
              const textStream = streamLLM(
                streamParams,
                'scene-outlines-stream',
                thinkingConfig,
              ).textStream;

              for await (const chunk of textStream) {
                if (writer.isClosed()) break;
                fullText += chunk;

                // Try to extract language directive early
                if (!languageDirective) {
                  languageDirective = extractLanguageDirective(fullText);
                  if (languageDirective) {
                    if (
                      !writer.sendEvent({
                      type: 'languageDirective',
                      data: languageDirective,
                      })
                    ) {
                      break;
                    }
                  }
                }

                // Try to extract new outlines from the accumulated text
                const newOutlines = extractNewOutlines(fullText, parsedOutlines.length);
                for (const outline of newOutlines) {
                  // Ensure ID and order
                  const enriched = {
                    ...outline,
                    id: outline.id || nanoid(),
                    order: parsedOutlines.length + 1,
                  };
                  parsedOutlines.push(enriched);

                  if (
                    !writer.sendEvent({
                    type: 'outline',
                    data: enriched,
                    index: parsedOutlines.length - 1,
                    })
                  ) {
                    break;
                  }
                }
              }

              if (writer.isClosed()) break;

              // Validate: got outlines?
              if (parsedOutlines.length > 0) break;

              // Empty result — retry if we have attempts left
              lastError = fullText.trim()
                ? 'LLM response could not be parsed into outlines'
                : 'LLM returned empty response';
              log.warn(
                `Outlines attempt ${attempt} diagnostics: textLen=${fullText.length}, outlines=${parsedOutlines.length}, languageDirective=${languageDirective ? 'yes' : 'no'}, preview=${JSON.stringify(fullText.slice(0, 240))}`,
              );

              if (attempt <= MAX_STREAM_RETRIES) {
                log.warn(
                  `Empty outlines (attempt ${attempt}/${MAX_STREAM_RETRIES + 1}), retrying...`,
                );
                if (
                  !writer.sendEvent({
                  type: 'retry',
                  attempt,
                  maxAttempts: MAX_STREAM_RETRIES + 1,
                  })
                ) {
                  break;
                }
              }
            } catch (error) {
              lastError = normalizeAiErrorMessage(error);
              if (writer.isClosed()) break;
              log.warn(
                `Outlines stream error detail (attempt ${attempt}/${MAX_STREAM_RETRIES + 1}): ${lastError}`,
              );

              if (attempt <= MAX_STREAM_RETRIES) {
                log.warn(
                  `Stream error (attempt ${attempt}/${MAX_STREAM_RETRIES + 1}), retrying...`,
                  error,
                );
                if (
                  !writer.sendEvent({
                  type: 'retry',
                  attempt,
                  maxAttempts: MAX_STREAM_RETRIES + 1,
                  })
                ) {
                  break;
                }
                continue;
              }
            }
          }

          if (writer.isClosed()) {
            return;
          }

          if (parsedOutlines.length === 0 && !writer.isClosed()) {
            try {
              const fallback = await generateOutlinesFallback({
                streamParams,
                thinkingConfig,
              });
              if (fallback) {
                parsedOutlines = fallback.outlines;
                languageDirective = fallback.languageDirective;
              }
            } catch (fallbackError) {
              lastError = normalizeAiErrorMessage(fallbackError);
            }
          }

          if (parsedOutlines.length > 0) {
            // Replace sequential gen_img_N/gen_vid_N with globally unique IDs
            const uniquifiedOutlines = uniquifyMediaElementIds(parsedOutlines);
            writer.sendEvent({
              type: 'done',
              outlines: uniquifiedOutlines,
              languageDirective: languageDirective || DEFAULT_LANGUAGE_DIRECTIVE,
            });
          } else {
            // All retries exhausted, no outlines produced
            log.error(
              `Outline generation failed after ${MAX_STREAM_RETRIES + 1} attempts: ${lastError}`,
            );
            writer.sendEvent({
              type: 'error',
              error: lastError || 'Failed to generate outlines',
            });
          }
        } catch (error) {
          if (!writer.isClosed()) {
            writer.sendEvent({
              type: 'error',
              error: normalizeAiErrorMessage(error),
            });
          }
        } finally {
          stopHeartbeat();
          writer.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    log.error(
      `Outline streaming failed [requirement="${requirementSnippet ?? 'unknown'}...", model=${resolvedModelString ?? 'unknown'}]:`,
      error,
    );
    return apiError('INTERNAL_ERROR', 500, normalizeAiErrorMessage(error));
  }
}
