/**
 * Stage 2: Scene content and action generation.
 *
 * Generates full scenes (slide/quiz/interactive/pbl with actions)
 * from scene outlines.
 */

import { nanoid } from 'nanoid';
import katex from 'katex';
import { MAX_VISION_IMAGES } from '@/lib/constants/generation';
import { getOptimizedActionCount } from './fast-mode';
import type {
  SceneOutline,
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
  ScientificModel,
  PdfImage,
  ImageMapping,
  WidgetOutline,
} from '@/lib/types/generation';
import type { WidgetType, WidgetConfig, TeacherAction } from '@/lib/types/widgets';
import type { PromptId } from '@/lib/prompts/types';
import type { LanguageModel } from 'ai';
import type { StageStore } from '@/lib/api/stage-api';
import { createStageAPI } from '@/lib/api/stage-api';
import { generatePBLContent } from '@/lib/pbl/generate-pbl';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { DEFAULT_LANGUAGE_DIRECTIVE } from './outline-generator';
import { postProcessInteractiveHtml } from './interactive-post-processor';
import { parseActionsFromStructuredOutput } from './action-parser';
import { parseJsonResponse } from './json-repair';
import {
  buildCourseContext,
  buildLanguageText,
  formatAgentsForPrompt,
  formatTeacherPersonaForPrompt,
  formatImageDescription,
  formatImagePlaceholder,
} from './prompt-formatters';
import type { PPTElement, Slide, SlideBackground, SlideTheme } from '@/lib/types/slides';
import type { QuizQuestion } from '@/lib/types/stage';
import type {
  Action,
  SpeechAction,
  WidgetHighlightAction,
  WidgetSetStateAction,
  WidgetAnnotationAction,
  WidgetRevealAction,
} from '@/lib/types/action';
import type {
  AgentInfo,
  SceneGenerationContext,
  GeneratedSlideData,
  GeneratedQuizData,
  AICallFn,
  GenerationResult,
  GenerationCallbacks,
} from './pipeline-types';
import type { ThinkingConfig } from '@/lib/types/provider';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

// ── Options interfaces for scene generation functions ──

export interface SceneContentOptions {
  assignedImages?: PdfImage[];
  imageMapping?: ImageMapping;
  languageModel?: LanguageModel;
  visionEnabled?: boolean;
  generatedMediaMapping?: ImageMapping;
  agents?: AgentInfo[];
  languageDirective?: string;
  thinkingConfig?: ThinkingConfig;
}

export interface SceneActionsOptions {
  ctx?: SceneGenerationContext;
  agents?: AgentInfo[];
  userProfile?: string;
  languageDirective?: string;
}

// ==================== Stage 2: Full Scenes (Two-Step) ====================

/**
 * Stage 3: Generate full scenes (parallel version)
 *
 * Two steps:
 * - Step 3.1: Outline -> Page content (slide/quiz)
 * - Step 3.2: Content + script -> Action list
 *
 * All scenes generated in parallel using Promise.all
 */
export async function generateFullScenes(
  sceneOutlines: SceneOutline[],
  store: StageStore,
  aiCall: AICallFn,
  callbacks?: GenerationCallbacks,
  languageDirective?: string,
): Promise<GenerationResult<string[]>> {
  const api = createStageAPI(store);
  const totalScenes = sceneOutlines.length;
  let completedCount = 0;

  callbacks?.onProgress?.({
    currentStage: 3,
    overallProgress: 66,
    stageProgress: 0,
    statusMessage: `正在并行生成 ${totalScenes} 个场景...`,
    scenesGenerated: 0,
    totalScenes,
  });

  // Generate all scenes in parallel
  const results = await Promise.all(
    sceneOutlines.map(async (outline, index) => {
      try {
        const sceneId = await generateSingleScene(outline, api, aiCall, languageDirective);

        // Update progress (not atomic, but sufficient for UI display)
        completedCount++;
        callbacks?.onProgress?.({
          currentStage: 3,
          overallProgress: 66 + Math.floor((completedCount / totalScenes) * 34),
          stageProgress: Math.floor((completedCount / totalScenes) * 100),
          statusMessage: `已完成 ${completedCount}/${totalScenes} 个场景`,
          scenesGenerated: completedCount,
          totalScenes,
        });

        return { success: true, sceneId, index };
      } catch (error) {
        completedCount++;
        callbacks?.onError?.(`Failed to generate scene ${outline.title}: ${error}`);
        return { success: false, sceneId: null, index };
      }
    }),
  );

  // Collect successful sceneIds in original order
  const sceneIds = results
    .filter(
      (r): r is { success: true; sceneId: string; index: number } =>
        r.success && r.sceneId !== null,
    )
    .sort((a, b) => a.index - b.index)
    .map((r) => r.sceneId);

  return { success: true, data: sceneIds };
}

/**
 * Check if fast generation mode is enabled locally
 * Fast mode merges content and actions generation into a single API call
 */
function checkFastGenerationEnabled(): boolean {
  return process.env.FAST_GENERATION_MODE === 'true' || process.env.FAST_GENERATION_MODE === '1';
}

/**
 * Generate a single scene.
 *
 * r12+ — content + actions are produced in a SINGLE LLM call for slide,
 * quiz, and interactive scenes. PBL scenes still go through the legacy
 * two-step path (see `generateSceneActions`). This halves the per-scene
 * call count from 2 to 1, which is what got us back under the upstream
 * per-job quota.
 */
async function generateSingleScene(
  outline: SceneOutline,
  api: ReturnType<typeof createStageAPI>,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<string | null> {
  log.info(`Generating content + actions in a single LLM call for: ${outline.title}`);

  const { content, actions: combinedActions } = await generateSceneContentAndActions(
    outline,
    aiCall,
    { languageDirective },
  );

  if (!content) {
    log.error(`Failed to generate content for: ${outline.title}`);
    return null;
  }

  // For PBL (and any future scene type that the combined path can't handle),
  // `combinedActions` will be empty and we fall back to the legacy
  // generateSceneActions call to keep behavior identical to pre-r12.
  let actions = combinedActions;
  if (actions.length === 0) {
    log.info(
      `Combined path produced no actions for "${outline.title}" (type=${outline.type}); falling back to separate actions call`,
    );
    actions = await generateSceneActions(outline, content, aiCall, { languageDirective });
  }

  log.info(`Got ${actions.length} actions for: ${outline.title}`);

  return createSceneWithActions(outline, content, actions, api);
}

// ==================== Backward Compatibility Helpers ====================

/**
 * Convert legacy interactiveConfig to unified widget fields
 * For backward compatibility with old classrooms
 */
function convertInteractiveConfigToWidget(outline: SceneOutline): SceneOutline {
  const config = outline.interactiveConfig;
  if (!config) {
    log.warn(
      `Interactive outline missing both widget and interactiveConfig, falling back to simulation`,
    );
    return {
      ...outline,
      widgetType: 'simulation' as WidgetType,
      widgetOutline: { concept: outline.title },
    };
  }

  const widgetType = inferWidgetType(
    config.subject || '',
    config.conceptName,
    config.designIdea || '',
  );

  log.info(`Converting interactiveConfig to widget: ${widgetType} for "${outline.title}"`);

  return {
    ...outline,
    widgetType,
    widgetOutline: buildWidgetOutline(widgetType, config),
  };
}

/**
 * Infer widget type from concept characteristics
 */
function inferWidgetType(subject: string, concept: string, designIdea: string): WidgetType {
  const text = (subject + ' ' + concept + ' ' + designIdea).toLowerCase();

  // Rule-based inference
  if (
    /physics|chemistry|力学|化学|运动|反应|force|motion|equilibrium|wave|电路|circuit/.test(text)
  ) {
    return 'simulation';
  }
  if (/programming|code|algorithm|编程|算法|python|javascript|function|代码/.test(text)) {
    return 'code';
  }
  if (/process|workflow|步骤|流程|逻辑|step|flow|系统|system/.test(text)) {
    return 'diagram';
  }
  if (
    /biology|anatomy|cell|molecular|生物|细胞|分子|3d|三维|solar|planet|skeleton|organ/.test(text)
  ) {
    return 'visualization3d';
  }
  if (/game|quiz|practice|练习|游戏|puzzle|match|challenge|挑战/.test(text)) {
    return 'game';
  }

  // Default fallback
  return 'simulation';
}

/**
 * Build widgetOutline from interactiveConfig for backward compatibility
 */
function buildWidgetOutline(
  widgetType: WidgetType,
  config: { conceptName: string; conceptOverview: string; designIdea: string },
): WidgetOutline {
  const base: WidgetOutline = { concept: config.conceptName };

  switch (widgetType) {
    case 'simulation':
      // Try to extract variables from designIdea
      const varMatch = config.designIdea.match(/variables|参数|调整|adjust|slider/i);
      return { ...base, keyVariables: varMatch ? [] : undefined };
    case 'diagram':
      return { ...base, diagramType: 'flowchart' };
    case 'code':
      return { ...base, language: 'python' };
    case 'game':
      return { ...base, gameType: 'quiz' };
    case 'visualization3d':
      return { ...base, visualizationType: 'custom', objects: [] };
    default:
      return base;
  }
}

/**
 * Step 3.1: Generate content based on outline
 */
export async function generateSceneContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  options: SceneContentOptions = {},
): Promise<
  | GeneratedSlideContent
  | GeneratedQuizContent
  | GeneratedInteractiveContent
  | GeneratedPBLContent
  | null
> {
  // Backward-compatible wrapper. New callers should use
  // `generateSceneContentAndActions` directly so they can avoid the second
  // LLM call for actions.
  const { content } = await generateSceneContentAndActions(outline, aiCall, options);
  return content;
}

/**
 * Combined scene content + actions generation (r12+).
 *
 * The whole point of this refactor is to halve the per-scene LLM call count
 * (from 2N to N+1 for an N-scene course) and stay under the upstream
 * provider's per-job quota. For slide and quiz scenes, the LLM now returns
 * `actions` in the same response, so we do not need a follow-up call.
 *
 * For interactive scenes, the widget content already carries
 * `teacherActions` in the same response, so we just convert those — no
 * additional LLM call was happening for them anyway.
 *
 * PBL scenes are rare and their action generation is structurally different;
 * we keep the existing two-step path for PBL (call `generateSceneActions`
 * separately). The new pipeline still skips the second call when this
 * function is the entry point and the scene type is PBL — the caller is
 * expected to handle the PBL case.
 *
 * Returns `{ content, actions }`. If content generation fails outright,
 * `content` is null and `actions` is an empty array.
 */
export async function generateSceneContentAndActions(
  outline: SceneOutline,
  aiCall: AICallFn,
  options: SceneContentOptions = {},
): Promise<{
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent
    | null;
  actions: Action[];
}> {
  const {
    assignedImages,
    imageMapping,
    languageModel,
    visionEnabled,
    generatedMediaMapping,
    agents,
    languageDirective,
    thinkingConfig,
  } = options;

  // Interactive (widget) scenes: content + teacherActions already come back
  // in the same response. Convert the teacherActions and return them as
  // the actions — we never needed a second LLM call here.
  if (outline.type === 'interactive') {
    let widgetOutline = outline;
    if (!widgetOutline.widgetType && widgetOutline.interactiveConfig) {
      log.info(`Converting legacy interactiveConfig for: ${outline.title}`);
      widgetOutline = convertInteractiveConfigToWidget(widgetOutline);
    }
    if (!widgetOutline.widgetType) {
      widgetOutline = {
        ...widgetOutline,
        widgetType: 'simulation' as WidgetType,
        widgetOutline: { concept: widgetOutline.title },
      };
    }

    const content = await generateWidgetContent(widgetOutline, aiCall, languageDirective);
    if (!content) return { content: null, actions: [] };

    const hasHtml = 'html' in content;
    const teacherActions = hasHtml ? content.teacherActions ?? [] : [];
    const actions = teacherActions.length > 0 ? convertTeacherActionsToActions(teacherActions) : [];
    return { content, actions };
  }

  switch (outline.type) {
    case 'slide':
      return generateSlideContentAndActions(
        outline,
        aiCall,
        assignedImages,
        imageMapping,
        visionEnabled,
        generatedMediaMapping,
        agents,
        languageDirective,
      );
    case 'quiz':
      return generateQuizContentAndActions(outline, aiCall, languageDirective);
    case 'pbl': {
      // PBL is not covered by the combined path yet. Generate content only;
      // the caller (e.g. generateSingleScene) is responsible for the
      // follow-up actions call. We return an empty actions array to make
      // the contract uniform, but in practice the caller will overwrite it.
      log.debug(
        `PBL outline "${outline.title}" — combined path not yet supported, returning content only`,
      );
      const content = await generatePBLSceneContent(
        outline,
        languageModel,
        languageDirective,
        thinkingConfig,
      );
      return { content, actions: [] };
    }
    default:
      return { content: null, actions: [] };
  }
}

/**
 * Check if a string looks like an image ID (e.g., "img_1", "img_2")
 * rather than a base64 data URL or actual URL
 *
 * This function distinguishes between:
 * - Image IDs: "img_1", "img_2", etc. → returns true
 * - Base64 data URLs: "data:image/..." → returns false
 * - HTTP URLs: "http://...", "https://..." → returns false
 * - Relative paths: "/images/..." → returns false
 */
function isImageIdReference(value: string): boolean {
  if (!value) return false;
  // Exclude real URLs and paths
  if (value.startsWith('data:')) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  if (value.startsWith('/')) return false; // Relative paths
  // Match image ID format: img_1, img_2, etc.
  return /^img_\d+$/i.test(value);
}

/**
 * Check if a string looks like a generated image/video ID (e.g., "gen_img_1", "gen_img_xK8f2mQ")
 * These are placeholders for AI-generated media, not PDF-extracted images.
 */
function isGeneratedImageId(value: string): boolean {
  if (!value) return false;
  return /^gen_(img|vid)_[\w-]+$/i.test(value);
}

/**
 * Resolve image ID references in src field to actual base64 URLs
 *
 * AI generates: { type: "image", src: "img_1", ... }
 * This function replaces: { type: "image", src: "data:image/png;base64,...", ... }
 *
 * Design rationale (Plan B):
 * - Simpler: AI only needs to know one field (src)
 * - Consistent: Generated JSON structure matches final PPTImageElement
 * - Intuitive: src is the image source, first as ID then as actual URL
 * - Less prompt complexity: No need to explain imageId vs src distinction
 */
function resolveImageIds(
  elements: GeneratedSlideData['elements'],
  imageMapping?: ImageMapping,
  generatedMediaMapping?: ImageMapping,
): GeneratedSlideData['elements'] {
  return elements
    .map((el) => {
      if (el.type === 'image') {
        if (!('src' in el)) {
          log.warn(`Image element missing src, removing element`);
          return null; // Remove invalid image elements
        }
        const src = el.src as string;

        // If src is an image ID reference, replace with actual URL
        if (isImageIdReference(src)) {
          if (!imageMapping || !imageMapping[src]) {
            log.warn(`No mapping for image ID: ${src}, removing element`);
            return null; // Remove invalid image elements
          }
          log.debug(`Resolved image ID "${src}" to base64 URL`);
          return { ...el, src: imageMapping[src] };
        }

        // Generated image reference — keep as placeholder for async backfill
        if (isGeneratedImageId(src)) {
          if (generatedMediaMapping && generatedMediaMapping[src]) {
            log.debug(`Resolved generated image ID "${src}" to URL`);
            return { ...el, src: generatedMediaMapping[src] };
          }
          // Keep element with placeholder ID — frontend renders skeleton
          log.debug(`Keeping generated image placeholder: ${src}`);
          return el;
        }
      }

      if (el.type === 'video') {
        const mediaRef = (el as Record<string, unknown>).mediaRef;
        if (!('src' in el) && typeof mediaRef !== 'string') {
          log.warn(`Video element missing src, removing element`);
          return null;
        }
        const src = el.src as string;
        if (isGeneratedImageId(src)) {
          if (generatedMediaMapping && generatedMediaMapping[src]) {
            log.debug(`Resolved generated video ID "${src}" to URL`);
            return { ...el, src: generatedMediaMapping[src] };
          }
          // Keep element with placeholder ID — frontend renders skeleton
          log.debug(`Keeping generated video placeholder: ${src}`);
          return el;
        }
      }

      return el;
    })
    .filter((el): el is NonNullable<typeof el> => el !== null);
}

function normalizeGeneratedVideoRefs(
  elements: GeneratedSlideData['elements'],
  generatedVideoEntries: SceneOutline['mediaGenerations'] = [],
): GeneratedSlideData['elements'] {
  const validRefs = generatedVideoEntries
    .filter((mg) => mg.type === 'video')
    .map((mg) => mg.elementId);

  const validRefSet = new Set(validRefs);
  const onlyRef = validRefs.length === 1 ? validRefs[0] : undefined;

  return elements
    .map((el) => {
      if (el.type !== 'video') return el;

      const videoEl = { ...el } as Record<string, unknown>;
      const mediaRef = typeof videoEl.mediaRef === 'string' ? videoEl.mediaRef : undefined;
      const src = typeof videoEl.src === 'string' ? videoEl.src : undefined;
      const hasGeneratedSrc = !!src && isGeneratedImageId(src);
      const hasDirectSrc = !!src && !hasGeneratedSrc;

      if (hasDirectSrc) {
        if (mediaRef) delete videoEl.mediaRef;
        return videoEl as typeof el;
      }

      if (mediaRef && validRefSet.has(mediaRef)) {
        if (hasGeneratedSrc) delete videoEl.src;
        return videoEl as typeof el;
      }

      if (src && validRefSet.has(src)) {
        videoEl.mediaRef = src;
        delete videoEl.src;
        return videoEl as typeof el;
      }

      if ((mediaRef || hasGeneratedSrc) && onlyRef) {
        log.warn(`Correcting generated video reference "${mediaRef || src}" to "${onlyRef}"`);
        videoEl.mediaRef = onlyRef;
        if (hasGeneratedSrc) delete videoEl.src;
        return videoEl as typeof el;
      }

      if (mediaRef || hasGeneratedSrc) {
        log.warn(`Invalid generated video reference "${mediaRef || src}", removing element`);
        return null;
      }

      return el;
    })
    .filter((el): el is NonNullable<typeof el> => el !== null);
}

/**
 * Fix elements with missing required fields
 * Adds default values for fields that AI might not have generated correctly
 */
function fixElementDefaults(
  elements: GeneratedSlideData['elements'],
  assignedImages?: PdfImage[],
): GeneratedSlideData['elements'] {
  return elements.map((el) => {
    // Fix line elements
    if (el.type === 'line') {
      const lineEl = el as Record<string, unknown>;

      // Ensure points field exists with default values
      if (!lineEl.points || !Array.isArray(lineEl.points) || lineEl.points.length !== 2) {
        log.warn(`Line element missing points, adding defaults`);
        lineEl.points = ['', ''] as [string, string]; // Default: no markers on either end
      }

      // Ensure start/end exist
      if (!lineEl.start || !Array.isArray(lineEl.start)) {
        lineEl.start = [el.left ?? 0, el.top ?? 0];
      }
      if (!lineEl.end || !Array.isArray(lineEl.end)) {
        lineEl.end = [(el.left ?? 0) + (el.width ?? 100), (el.top ?? 0) + (el.height ?? 0)];
      }

      // Ensure style exists
      if (!lineEl.style) {
        lineEl.style = 'solid';
      }

      // Ensure color exists
      if (!lineEl.color) {
        lineEl.color = '#333333';
      }

      return lineEl as typeof el;
    }

    // Fix text elements
    if (el.type === 'text') {
      const textEl = el as Record<string, unknown>;

      if (!textEl.defaultFontName) {
        textEl.defaultFontName = 'Microsoft YaHei';
      }
      if (!textEl.defaultColor) {
        textEl.defaultColor = '#333333';
      }
      if (!textEl.content) {
        textEl.content = '';
      }

      return textEl as typeof el;
    }

    // Fix image elements
    if (el.type === 'image') {
      const imageEl = el as Record<string, unknown>;

      if (imageEl.fixedRatio === undefined) {
        imageEl.fixedRatio = true;
      }

      // Correct dimensions using known aspect ratio (src is still img_id at this point)
      if (assignedImages && typeof imageEl.src === 'string') {
        const imgMeta = assignedImages.find((img) => img.id === imageEl.src);
        if (imgMeta?.width && imgMeta?.height) {
          const knownRatio = imgMeta.width / imgMeta.height;
          const curW = (el.width || 400) as number;
          const curH = (el.height || 300) as number;
          if (Math.abs(curW / curH - knownRatio) / knownRatio > 0.1) {
            // Keep width, correct height
            const newH = Math.round(curW / knownRatio);
            if (newH > 462) {
              // canvas 562.5 - margins 50×2
              const newW = Math.round(462 * knownRatio);
              imageEl.width = newW;
              imageEl.height = 462;
            } else {
              imageEl.height = newH;
            }
          }
        }
      }

      return imageEl as typeof el;
    }

    // Fix shape elements
    if (el.type === 'shape') {
      const shapeEl = el as Record<string, unknown>;

      if (!shapeEl.viewBox) {
        shapeEl.viewBox = `0 0 ${el.width ?? 100} ${el.height ?? 100}`;
      }
      if (!shapeEl.path) {
        // Default to rectangle
        const w = el.width ?? 100;
        const h = el.height ?? 100;
        shapeEl.path = `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`;
      }
      if (!shapeEl.fill) {
        shapeEl.fill = '#5b9bd5';
      }
      if (shapeEl.fixedRatio === undefined) {
        shapeEl.fixedRatio = false;
      }

      return shapeEl as typeof el;
    }

    return el;
  });
}

export function normalizeLatexSourceForRendering(content: string): string {
  return content.replace(/[\u0008\u0009\u000c\u000d](?=[a-zA-Z])/g, (char) => {
    switch (char) {
      case '\b':
        return '\\b';
      case '\t':
        return '\\t';
      case '\f':
        return '\\f';
      case '\r':
        return '\\r';
      default:
        return char;
    }
  });
}

function normalizeRawLatexText(content: string): string {
  let normalized = normalizeLatexSourceForRendering(content);
  const replaceFraction = /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;

  while (replaceFraction.test(normalized)) {
    normalized = normalized.replace(replaceFraction, '$1/$2');
  }

  return normalized
    .replace(/\\times\b/g, '×')
    .replace(/\\div\b/g, '÷');
}

export function sanitizeRawLatexInTextElements(
  elements: GeneratedSlideData['elements'],
): GeneratedSlideData['elements'] {
  return elements.map((el) => {
    if (el.type !== 'text') return el;
    if (typeof el.content !== 'string' || !el.content.includes('\\')) return el;

    return {
      ...el,
      content: normalizeRawLatexText(el.content),
    };
  });
}

/**
 * Process LaTeX elements: render latex string to HTML using KaTeX.
 * Fills in html and fixedRatio fields.
 * Elements that fail conversion are removed.
 */
function processLatexElements(
  elements: GeneratedSlideData['elements'],
): GeneratedSlideData['elements'] {
  return elements
    .map((el) => {
      if (el.type !== 'latex') return el;

      const latexStr = typeof el.latex === 'string' ? normalizeLatexSourceForRendering(el.latex) : undefined;
      if (!latexStr) {
        log.warn('Latex element missing latex string, removing');
        return null;
      }

      try {
        const html = katex.renderToString(latexStr, {
          throwOnError: false,
          displayMode: true,
          output: 'html',
        });

        return {
          ...el,
          html,
          fixedRatio: true,
        };
      } catch (err) {
        log.warn(`Failed to render latex "${latexStr}":`, err);
        return null;
      }
    })
    .filter((el): el is NonNullable<typeof el> => el !== null);
}

/**
 * Raw slide generator. Returns the post-processed content alongside the
 * ai-id → real-id mapping and the raw action objects the LLM emitted in
 * the same response. The combined function `generateSlideContentAndActions`
 * consumes all three pieces; the legacy `generateSlideContent` wrapper
 * discards the action pieces for backward compat.
 */
export type RawSlideResult = {
  content: GeneratedSlideContent;
  aiIdToRealId: Map<string, string>;
  rawActions?: Array<Record<string, unknown>>;
} | null;

async function generateSlideContentRaw(
  outline: SceneOutline,
  aiCall: AICallFn,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  visionEnabled?: boolean,
  generatedMediaMapping?: ImageMapping,
  agents?: AgentInfo[],
  languageDirective?: string,
): Promise<RawSlideResult> {
  // Build assigned images description for the prompt
  let assignedImagesText = '无可用图片，禁止插入任何 image 元素';
  let visionImages: Array<{ id: string; src: string }> | undefined;

  if (assignedImages && assignedImages.length > 0) {
    if (visionEnabled && imageMapping) {
      // Vision mode: split into vision images and text-only
      const withSrc = assignedImages.filter((img) => imageMapping[img.id]);
      const visionSlice = withSrc.slice(0, MAX_VISION_IMAGES);
      const textOnlySlice = withSrc.slice(MAX_VISION_IMAGES);
      const noSrcImages = assignedImages.filter((img) => !imageMapping[img.id]);

      const visionDescriptions = visionSlice.map((img) => formatImagePlaceholder(img));
      const textDescriptions = [...textOnlySlice, ...noSrcImages].map((img) =>
        formatImageDescription(img),
      );
      assignedImagesText = [...visionDescriptions, ...textDescriptions].join('\n');

      visionImages = visionSlice.map((img) => ({
        id: img.id,
        src: imageMapping[img.id],
        width: img.width,
        height: img.height,
      }));
    } else {
      assignedImagesText = assignedImages.map((img) => formatImageDescription(img)).join('\n');
    }
  }

  const generatedImageEntries = outline.mediaGenerations?.filter((mg) => mg.type === 'image') ?? [];
  const generatedVideoEntries = outline.mediaGenerations?.filter((mg) => mg.type === 'video') ?? [];
  const hasAssignedImages = (assignedImages?.length ?? 0) > 0;
  const generatedImageEnabled = generatedImageEntries.length > 0;
  const generatedVideoEnabled = generatedVideoEntries.length > 0;
  const imageElementEnabled = hasAssignedImages || generatedImageEnabled;
  const mediaElementEnabled = imageElementEnabled || generatedVideoEnabled;

  // Add generated media placeholders info (images + videos)
  if (outline.mediaGenerations && outline.mediaGenerations.length > 0) {
    const genImgDescs = generatedImageEntries
      .map((mg) => `- ${mg.elementId}: "${mg.prompt}" (aspect ratio: ${mg.aspectRatio || '16:9'})`)
      .join('\n');
    const genVidDescs = generatedVideoEntries
      .map((mg) => `- ${mg.elementId}: "${mg.prompt}" (aspect ratio: ${mg.aspectRatio || '16:9'})`)
      .join('\n');

    const mediaParts: string[] = [];
    if (genImgDescs) {
      mediaParts.push(`AI-Generated Images (use these IDs as image element src):\n${genImgDescs}`);
    }
    if (genVidDescs) {
      mediaParts.push(
        `AI-Generated Videos (use these IDs as video element mediaRef):\n${genVidDescs}`,
      );
    }

    if (mediaParts.length > 0) {
      const mediaText = mediaParts.join('\n\n');
      if (assignedImagesText.includes('禁止插入') || assignedImagesText.includes('No images')) {
        assignedImagesText = mediaText;
      } else {
        assignedImagesText += `\n\n${mediaText}`;
      }
    }
  }

  // Canvas dimensions (matching viewportSize and viewportRatio)
  const canvasWidth = 1000;
  const canvasHeight = 562.5;

  const teacherContext = formatTeacherPersonaForPrompt(agents);

  const prompts = buildPrompt(PROMPT_IDS.SLIDE_CONTENT, {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    elements: '（根据要点自动生成）',
    assignedImages: assignedImagesText,
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
    teacherContext,
    languageDirective: languageDirective || '',
    imageElementEnabled,
    generatedImageEnabled,
    generatedVideoEnabled,
    mediaElementEnabled,
  });

  if (!prompts) {
    return null;
  }

  log.debug(`Generating slide content for: ${outline.title}`);
  if (assignedImages && assignedImages.length > 0) {
    log.debug(`Assigned images: ${assignedImages.map((img) => img.id).join(', ')}`);
  }
  if (visionImages && visionImages.length > 0) {
    log.debug(`Vision images: ${visionImages.map((img) => img.id).join(', ')}`);
  }

  const response = await aiCall(prompts.system, prompts.user, visionImages);
  const generatedData = parseJsonResponse<GeneratedSlideData>(response);

  if (!generatedData || !generatedData.elements || !Array.isArray(generatedData.elements)) {
    log.error(`Failed to parse AI response for: ${outline.title}`);
    return null;
  }

  log.debug(`Got ${generatedData.elements.length} elements for: ${outline.title}`);

  // Debug: Log image elements before resolution
  const imageElements = generatedData.elements.filter((el) => el.type === 'image');
  if (imageElements.length > 0) {
    log.debug(
      `Image elements before resolution:`,
      imageElements.map((el) => ({
        type: el.type,
        src:
          (el as Record<string, unknown>).src &&
          String((el as Record<string, unknown>).src).substring(0, 50),
      })),
    );
    log.debug(`imageMapping keys:`, imageMapping ? Object.keys(imageMapping).length : '0 keys');
  }

  // Tag each AI element with its original id BEFORE post-processing so we can
  // build a stable ai-id → real-id mapping for the action remap step. The
  // post-processing pipeline (fixElementDefaults → sanitizeRawLatexInTextElements
  // → processLatexElements → resolveImageIds → normalizeGeneratedVideoRefs) may
  // filter or transform elements, but it never strips unknown custom fields,
  // so the tag travels with the surviving element.
  for (const el of generatedData.elements) {
    (el as Record<string, unknown>)._aiId = el.id;
  }

  // Fix elements with missing required fields + aspect ratio correction (while src is still img_id)
  const fixedElements = fixElementDefaults(generatedData.elements, assignedImages);
  log.debug(`After element fixing: ${fixedElements.length} elements`);

  const sanitizedTextElements = sanitizeRawLatexInTextElements(fixedElements);
  log.debug(`After raw text LaTeX sanitization: ${sanitizedTextElements.length} elements`);

  // Process LaTeX elements: render latex string → HTML via KaTeX
  const latexProcessedElements = processLatexElements(sanitizedTextElements);
  log.debug(`After LaTeX processing: ${latexProcessedElements.length} elements`);

  // Resolve image_id references to actual URLs
  const resolvedElements = resolveImageIds(
    latexProcessedElements,
    imageMapping,
    generatedMediaMapping,
  );
  log.debug(`After image resolution: ${resolvedElements.length} elements`);

  const videoNormalizedElements = normalizeGeneratedVideoRefs(
    resolvedElements,
    outline.mediaGenerations,
  );
  log.debug(`After video reference normalization: ${videoNormalizedElements.length} elements`);

  // Process elements, assign unique IDs
  const processedElements: PPTElement[] = videoNormalizedElements.map((el) => ({
    ...el,
    id: `${el.type}_${nanoid(8)}`,
    rotate: 0,
  })) as PPTElement[];

  // Build the AI-id → real-id mapping from the tagged original ids. The
  // matching key is the `_aiId` we stashed at the top of this function; the
  // value is the freshly assigned nanoid id. Both arrays are in the same
  // surviving order, so we can zip them.
  const aiIdToRealId = new Map<string, string>();
  for (let i = 0; i < processedElements.length; i++) {
    const aiId = (videoNormalizedElements[i] as Record<string, unknown>)._aiId as
      | string
      | undefined;
    if (aiId) {
      aiIdToRealId.set(aiId, processedElements[i].id);
    }
  }

  // Process background
  let background: SlideBackground | undefined;
  if (generatedData.background) {
    if (generatedData.background.type === 'solid' && generatedData.background.color) {
      background = { type: 'solid', color: generatedData.background.color };
    } else if (generatedData.background.type === 'gradient' && generatedData.background.gradient) {
      background = {
        type: 'gradient',
        gradient: generatedData.background.gradient,
      };
    }
  }

  return {
    content: {
      elements: processedElements,
      background,
      remark: generatedData.remark || outline.description,
    },
    aiIdToRealId,
    rawActions: generatedData.actions,
  };
}

/**
 * Remap a list of raw AI action objects so their `elementId` / `params.elementId`
 * references point to the post-processed nanoid ids.
 *
 * Walks every action object and every params value, replacing any string that
 * appears as a key in `aiIdToRealId`. Non-string values and unknown ids are
 * left untouched — `processActions` will later validate the resulting ids
 * against the real element set and drop anything that no longer resolves.
 */
function remapActionElementIds(
  rawActions: ReadonlyArray<Record<string, unknown>>,
  aiIdToRealId: Map<string, string>,
): Array<Record<string, unknown>> {
  const remapped: Array<Record<string, unknown>> = [];
  for (const action of rawActions) {
    const next: Record<string, unknown> = { ...action };
    for (const key of Object.keys(next)) {
      const value = next[key];
      if (typeof value === 'string' && aiIdToRealId.has(value)) {
        next[key] = aiIdToRealId.get(value);
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const remappedParams: Record<string, unknown> = { ...(value as Record<string, unknown>) };
        let touched = false;
        for (const pk of Object.keys(remappedParams)) {
          const pv = remappedParams[pk];
          if (typeof pv === 'string' && aiIdToRealId.has(pv)) {
            remappedParams[pk] = aiIdToRealId.get(pv);
            touched = true;
          }
        }
        if (touched) next[key] = remappedParams;
      }
    }
    remapped.push(next);
  }
  return remapped;
}

/**
 * Combined slide content + actions generation. The SLIDE_CONTENT prompt now
 * asks the LLM to emit a `actions` array in the same response, so we get
 * both pieces in one round-trip.
 *
 * Returns the post-processed content alongside the (validated, ID-remapped)
 * teaching actions. If the LLM did not return actions (older model, partial
 * response, fallback), `actions` is filled with deterministic defaults — we
 * do NOT issue a second LLM call to recover, because the whole point of
 * this refactor is to stay under the upstream per-job quota.
 */
async function generateSlideContentAndActions(
  outline: SceneOutline,
  aiCall: AICallFn,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  visionEnabled?: boolean,
  generatedMediaMapping?: ImageMapping,
  agents?: AgentInfo[],
  languageDirective?: string,
): Promise<{
  content: GeneratedSlideContent | null;
  actions: Action[];
}> {
  const result = await generateSlideContentRaw(
    outline,
    aiCall,
    assignedImages,
    imageMapping,
    visionEnabled,
    generatedMediaMapping,
    agents,
    languageDirective,
  );

  if (!result) {
    return { content: null, actions: [] };
  }

  // Default actions — used when the LLM did not emit any in this response.
  const defaultActions = getOptimizedActionCount(
    generateDefaultSlideActions(outline, result.content.elements),
  );

  if (!result.rawActions || result.rawActions.length === 0) {
    log.debug(
      `LLM did not include actions for slide "${outline.title}" — using defaults (${defaultActions.length})`,
    );
    return { content: result.content, actions: defaultActions };
  }

  // Remap the AI's `elementId` references to the post-processed nanoid ids.
  const remapped = remapActionElementIds(result.rawActions, result.aiIdToRealId);

  // Parse the remapped array through the standard structured-output parser so
  // we get a normalized Action[] (speech / spotlight / laser / etc.).
  const parsed = parseActionsFromStructuredOutput(JSON.stringify(remapped), 'slide');

  if (parsed.length === 0) {
    log.warn(
      `Failed to parse actions from LLM response for slide "${outline.title}" — using defaults`,
    );
    return { content: result.content, actions: defaultActions };
  }

  const processed = processActions(parsed, result.content.elements, agents);
  return { content: result.content, actions: getOptimizedActionCount(processed) };
}

/**
 * Backward-compatible wrapper around `generateSlideContentAndActions` that
 * discards the actions and returns only the content. Older callers and tests
 * rely on this signature, so we keep it.
 */
async function generateSlideContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  visionEnabled?: boolean,
  generatedMediaMapping?: ImageMapping,
  agents?: AgentInfo[],
  languageDirective?: string,
): Promise<GeneratedSlideContent | null> {
  const { content } = await generateSlideContentAndActions(
    outline,
    aiCall,
    assignedImages,
    imageMapping,
    visionEnabled,
    generatedMediaMapping,
    agents,
    languageDirective,
  );
  return content;
}

/**
 * Raw quiz generator. Returns the post-processed questions plus the raw
 * (unparsed) action objects the LLM emitted in the same response. Callers
 * that want only `GeneratedQuizContent` should use `generateQuizContent`
 * below; callers that want both pieces should use
 * `generateQuizContentAndActions`.
 *
 * `rawActions` is intentionally `Array<Record<string, unknown>>` rather
 * than `Action[]` — the raw LLM output still needs to be run through
 * `parseActionsFromStructuredOutput` + `processActions` to validate ids
 * and discussion / allowedActions rules.
 */
type RawQuizResult =
  | { content: GeneratedQuizContent; rawActions?: Array<Record<string, unknown>> }
  | null;

/**
 * Generate quiz content
 */
async function generateQuizContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<RawQuizResult> {
  const quizConfig = outline.quizConfig || {
    questionCount: 3,
    difficulty: 'medium',
    questionTypes: ['single'],
  };

  const prompts = buildPrompt(PROMPT_IDS.QUIZ_CONTENT, {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    questionCount: quizConfig.questionCount,
    difficulty: quizConfig.difficulty,
    questionTypes: quizConfig.questionTypes.join(', '),
    languageDirective: languageDirective || '',
  });

  if (!prompts) {
    return null;
  }

  log.debug(`Generating quiz content for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user);

  // r12+ — quiz content and quiz actions are now returned in the same JSON:
  //   { questions: QuizQuestion[], actions: [{type, name, params}, {type:"text", content}] }
  //
  // We accept three shapes for backward compatibility with older LLMs:
  //   1. New shape: { questions: [...], actions?: [...] }
  //   2. Legacy bare array: [...]      (no actions — caller will fill defaults)
  //   3. Anything else: rejected
  const parsed = parseJsonResponse<GeneratedQuizData | QuizQuestion[]>(response);

  let generatedQuestions: QuizQuestion[] | null = null;
  let rawActions: Array<Record<string, unknown>> | undefined;

  if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as GeneratedQuizData).questions)) {
    generatedQuestions = (parsed as GeneratedQuizData).questions as unknown as QuizQuestion[];
    rawActions = (parsed as GeneratedQuizData).actions;
  } else if (Array.isArray(parsed)) {
    // Legacy bare-array response. We still avoid burning a second LLM call —
    // the caller will derive deterministic default actions.
    log.debug(`Quiz response for "${outline.title}" came back as a bare array (legacy shape)`);
    generatedQuestions = parsed as unknown as QuizQuestion[];
  } else {
    log.error(`Failed to parse AI response for: ${outline.title}`);
    return null;
  }

  if (!generatedQuestions || generatedQuestions.length === 0) {
    log.error(`Failed to parse AI response for: ${outline.title}`);
    return null;
  }

  log.debug(`Got ${generatedQuestions.length} questions for: ${outline.title}`);

  // Ensure each question has an ID and normalize options format
  const questions: QuizQuestion[] = generatedQuestions.map((q) => {
    const isText = q.type === 'short_answer';
    return {
      ...q,
      id: q.id || `q_${nanoid(8)}`,
      options: isText ? undefined : normalizeQuizOptions(q.options),
      answer: isText ? undefined : normalizeQuizAnswer(q as unknown as Record<string, unknown>),
      hasAnswer: isText ? false : true,
    };
  });

  return { content: { questions }, rawActions };
}

/**
 * Combined quiz content + actions generation. Wraps `generateQuizContent`
 * and turns the raw action objects the LLM emitted in the same response
 * into a validated `Action[]`. Falls back to deterministic defaults if the
 * LLM did not return actions (e.g. legacy bare-array response).
 */
async function generateQuizContentAndActions(
  outline: SceneOutline,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<{
  content: GeneratedQuizContent | null;
  actions: Action[];
}> {
  const result = await generateQuizContent(outline, aiCall, languageDirective);
  if (!result) return { content: null, actions: [] };

  const defaults = generateDefaultQuizActions(outline);

  if (!result.rawActions || result.rawActions.length === 0) {
    log.debug(
      `LLM did not include actions for quiz "${outline.title}" — using defaults (${defaults.length})`,
    );
    return { content: result.content, actions: defaults };
  }

  const parsed = parseActionsFromStructuredOutput(
    JSON.stringify(result.rawActions),
    'quiz',
  );

  if (parsed.length === 0) {
    log.warn(
      `Failed to parse actions from LLM response for quiz "${outline.title}" — using defaults`,
    );
    return { content: result.content, actions: defaults };
  }

  const processed = processActions(parsed, [], undefined);
  return { content: result.content, actions: processed };
}

/**
 * Normalize quiz options from AI response.
 * AI may generate plain strings ["OptionA", "OptionB"] or QuizOption objects.
 * This normalizes to QuizOption[] format: { value: "A", label: "OptionA" }
 */
function normalizeQuizOptions(
  options: unknown[] | undefined,
): { value: string; label: string }[] | undefined {
  if (!options || !Array.isArray(options)) return undefined;

  return options.map((opt, index) => {
    const letter = String.fromCharCode(65 + index); // A, B, C, D...

    if (typeof opt === 'string') {
      return { value: letter, label: opt };
    }

    if (typeof opt === 'object' && opt !== null) {
      const obj = opt as Record<string, unknown>;
      return {
        value: typeof obj.value === 'string' ? obj.value : letter,
        label: typeof obj.label === 'string' ? obj.label : String(obj.value || obj.text || letter),
      };
    }

    return { value: letter, label: String(opt) };
  });
}

/**
 * Normalize quiz answer from AI response.
 * AI may generate correctAnswer as string or string[], under various field names.
 * This normalizes to string[] format matching option values.
 */
function normalizeQuizAnswer(question: Record<string, unknown>): string[] | undefined {
  // AI might use "correctAnswer", "answer", or "correct_answer"
  const raw =
    question.answer ??
    question.correctAnswer ??
    (question as Record<string, unknown>).correct_answer;
  if (!raw) return undefined;

  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  return [String(raw)];
}

/**
 * Generate PBL project content
 * Uses the agentic loop from lib/pbl/generate-pbl.ts
 */
async function generatePBLSceneContent(
  outline: SceneOutline,
  languageModel?: LanguageModel,
  languageDirective?: string,
  thinkingConfig?: ThinkingConfig,
): Promise<GeneratedPBLContent | null> {
  if (!languageModel) {
    log.error('LanguageModel required for PBL generation');
    return null;
  }

  const pblConfig = outline.pblConfig;
  if (!pblConfig) {
    log.error(`PBL outline "${outline.title}" missing pblConfig`);
    return null;
  }

  log.info(`Generating PBL content for: ${outline.title}`);

  try {
    const projectConfig = await generatePBLContent(
      {
        projectTopic: pblConfig.projectTopic,
        projectDescription: pblConfig.projectDescription,
        targetSkills: pblConfig.targetSkills,
        issueCount: pblConfig.issueCount,
        languageDirective: languageDirective || DEFAULT_LANGUAGE_DIRECTIVE,
      },
      languageModel,
      {
        onProgress: (msg) => log.info(`${msg}`),
      },
      thinkingConfig,
    );
    log.info(
      `PBL generated: ${projectConfig.agents.length} agents, ${projectConfig.issueboard.issues.length} issues`,
    );

    return { projectConfig };
  } catch (error) {
    log.error(`Failed:`, error);
    return null;
  }
}

/**
 * Extract HTML document from AI response.
 * Tries to find <!DOCTYPE html>...</html> first, then falls back to code block extraction.
 */
function extractHtml(response: string): string | null {
  // Strategy 1: Find complete HTML document
  const doctypeStart = response.indexOf('<!DOCTYPE html>');
  const htmlTagStart = response.indexOf('<html');
  const start = doctypeStart !== -1 ? doctypeStart : htmlTagStart;

  if (start !== -1) {
    const htmlEnd = response.lastIndexOf('</html>');
    if (htmlEnd !== -1) {
      return response.substring(start, htmlEnd + 7);
    }
  }

  // Strategy 2: Extract from code block
  const codeBlockMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.includes('<html') || content.includes('<!DOCTYPE')) {
      return content;
    }
  }

  // Strategy 3: If response itself looks like HTML
  const trimmed = response.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return trimmed;
  }

  log.error('Could not extract HTML from response');
  log.error('Response preview:', response.substring(0, 200));
  return null;
}

// ==================== Ultra Mode Widget Generation ====================

/**
 * Generate widget content based on widget type (Ultra Mode)
 */
async function generateWidgetContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<GeneratedInteractiveContent | null> {
  const widgetType = outline.widgetType;
  const widgetOutline = outline.widgetOutline;

  if (!widgetType || !widgetOutline) {
    log.warn(`Interactive outline missing widget config, falling back to standard interactive`);
    return null;
  }

  // Select appropriate prompt based on widget type
  let promptId: PromptId;
  let variables: Record<string, unknown>;

  switch (widgetType) {
    case 'simulation':
      promptId = PROMPT_IDS.SIMULATION_CONTENT;
      variables = {
        conceptName: widgetOutline.concept || outline.title,
        conceptOverview: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        variables: widgetOutline.keyVariables?.join(', ') || '',
        designIdea: '',
        languageDirective: languageDirective || '',
      };
      break;

    case 'diagram':
      promptId = PROMPT_IDS.DIAGRAM_CONTENT;
      variables = {
        title: outline.title,
        diagramType: widgetOutline.diagramType || 'flowchart',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        languageDirective: languageDirective || '',
      };
      break;

    case 'code':
      promptId = PROMPT_IDS.CODE_CONTENT;
      variables = {
        title: outline.title,
        programmingLanguage: widgetOutline.language || 'python',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        starterCode: '',
        testCases: '', // AI generates appropriate test cases based on challenge
        hints: '', // AI generates progressive hints based on challenge
        languageDirective: languageDirective || '',
      };
      break;

    case 'game':
      promptId = PROMPT_IDS.GAME_CONTENT;
      variables = {
        title: outline.title,
        gameType: widgetOutline.gameType || 'quiz',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        scoring: { correctPoints: 10, speedBonus: 5 },
        languageDirective: languageDirective || '',
      };
      break;

    case 'visualization3d':
      promptId = PROMPT_IDS.VISUALIZATION3D_CONTENT;
      variables = {
        title: outline.title,
        visualizationType: widgetOutline.visualizationType || 'custom',
        description: outline.description,
        keyPoints: (outline.keyPoints || []).join('\n'),
        objects: widgetOutline.objects || [],
        interactions: widgetOutline.interactions || [],
        languageDirective: languageDirective || '',
      };
      break;

    default:
      log.warn(`Unknown widget type: ${widgetType}`);
      return null;
  }

  const prompts = buildPrompt(promptId, variables);
  if (!prompts) {
    log.error(`Failed to build ${widgetType} prompt for: ${outline.title}`);
    return null;
  }

  log.info(`Generating ${widgetType} widget for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user);
  const html = extractHtml(response);

  if (!html) {
    log.error(`Failed to extract HTML from ${widgetType} response for: ${outline.title}`);
    return null;
  }

  // Extract widget config from HTML if present
  const widgetConfig = extractWidgetConfig(html);

  // Generate teacher actions
  const teacherActions = await generateWidgetTeacherActions(
    widgetType,
    outline,
    widgetConfig,
    aiCall,
    languageDirective,
  );
  log.info(
    `[Ultra Mode] Generated ${teacherActions?.length || 0} teacher actions for "${outline.title}" (${widgetType})`,
  );
  if (teacherActions && teacherActions.length > 0) {
    log.info(
      `[Ultra Mode] Teacher actions for "${outline.title}": ${JSON.stringify(teacherActions, null, 2)}`,
    );
  }

  return {
    html: postProcessInteractiveHtml(html),
    widgetType,
    widgetConfig,
    teacherActions,
  };
}

/**
 * Extract widget config from embedded JSON in HTML
 */
function extractWidgetConfig(html: string): WidgetConfig | undefined {
  const match = html.match(
    /<script type="application\/json" id="widget-config">([\s\S]*?)<\/script>/,
  );
  if (!match) return undefined;

  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Generate teacher actions for a widget
 */
async function generateWidgetTeacherActions(
  widgetType: WidgetType,
  outline: SceneOutline,
  widgetConfig: WidgetConfig | undefined,
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<TeacherAction[] | undefined> {
  const prompts = buildPrompt(PROMPT_IDS.WIDGET_TEACHER_ACTIONS, {
    widgetType,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).join('\n'),
    widgetConfig: JSON.stringify(widgetConfig || {}),
    languageDirective: languageDirective || '',
  });

  if (!prompts) return undefined;

  try {
    const response = await aiCall(prompts.system, prompts.user);
    const parsed = parseJsonResponse<{ actions: TeacherAction[] }>(response);
    return parsed?.actions;
  } catch {
    return undefined;
  }
}

/**
 * Step 3.2: Generate Actions based on content and script
 */
export async function generateSceneActions(
  outline: SceneOutline,
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent,
  aiCall: AICallFn,
  options: SceneActionsOptions = {},
): Promise<Action[]> {
  const { ctx, agents, userProfile, languageDirective } = options;
  const agentsText = formatAgentsForPrompt(agents);

  // Debug: Log content type and teacherActions presence for interactive scenes
  if (outline.type === 'interactive') {
    const hasHtml = 'html' in content;
    const teacherActionsCount = hasHtml ? content.teacherActions?.length || 0 : 0;
    log.info(
      `[Actions Gen] Interactive "${outline.title}": hasHtml=${hasHtml}, teacherActions=${teacherActionsCount}, widgetType=${hasHtml ? content.widgetType : 'N/A'}`,
    );
  }

  // Ultra Mode: If interactive content has teacherActions, convert and use them
  // Skip normal action generation for widget-based interactive scenes
  if (outline.type === 'interactive' && 'html' in content && content.teacherActions?.length) {
    log.info(
      `[Ultra Mode] Converting ${content.teacherActions.length} teacherActions to Actions for: ${outline.title}`,
    );
    return convertTeacherActionsToActions(content.teacherActions);
  }

  if (outline.type === 'slide' && 'elements' in content) {
    // Format element list for AI to select from
    const elementsText = formatElementsForPrompt(content.elements);

    const prompts = buildPrompt(PROMPT_IDS.SLIDE_ACTIONS, {
      title: outline.title,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      description: outline.description,
      elements: elementsText,
      courseContext: buildCourseContext(ctx),
      agents: agentsText,
      userProfile: userProfile || '',
      languageDirective: languageDirective || '',
    });

    if (!prompts) {
      return getOptimizedActionCount(generateDefaultSlideActions(outline, content.elements));
    }

    const response = await aiCall(prompts.system, prompts.user);
    const actions = parseActionsFromStructuredOutput(response, outline.type);

    if (actions.length > 0) {
      // Validate and fill in Action IDs
      return getOptimizedActionCount(processActions(actions, content.elements, agents));
    }

    return getOptimizedActionCount(generateDefaultSlideActions(outline, content.elements));
  }

  if (outline.type === 'quiz' && 'questions' in content) {
    // Format question list for AI reference
    const questionsText = formatQuestionsForPrompt(content.questions);

    const prompts = buildPrompt(PROMPT_IDS.QUIZ_ACTIONS, {
      title: outline.title,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      description: outline.description,
      questions: questionsText,
      courseContext: buildCourseContext(ctx),
      agents: agentsText,
      userProfile: userProfile || '',
      languageDirective: languageDirective || '',
    });

    if (!prompts) {
      return generateDefaultQuizActions(outline);
    }

    const response = await aiCall(prompts.system, prompts.user);
    const actions = parseActionsFromStructuredOutput(response, outline.type);

    if (actions.length > 0) {
      return processActions(actions, [], agents);
    }

    return generateDefaultQuizActions(outline);
  }

  if (outline.type === 'interactive' && 'html' in content) {
    const config = outline.interactiveConfig;
    const agentsText = formatAgentsForPrompt(agents);
    const prompts = buildPrompt(PROMPT_IDS.INTERACTIVE_ACTIONS, {
      title: outline.title,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      description: outline.description,
      conceptName: config?.conceptName || outline.title,
      designIdea: config?.designIdea || '',
      courseContext: buildCourseContext(ctx),
      agents: agentsText,
      userProfile: userProfile || '',
      languageDirective: languageDirective || '',
    });

    if (!prompts) {
      return generateDefaultInteractiveActions(outline);
    }

    const response = await aiCall(prompts.system, prompts.user);
    const actions = parseActionsFromStructuredOutput(response, outline.type);

    if (actions.length > 0) {
      return processActions(actions, [], agents);
    }

    return generateDefaultInteractiveActions(outline);
  }

  if (outline.type === 'pbl' && 'projectConfig' in content) {
    const pblConfig = outline.pblConfig;
    const agentsText = formatAgentsForPrompt(agents);
    const prompts = buildPrompt(PROMPT_IDS.PBL_ACTIONS, {
      title: outline.title,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      description: outline.description,
      projectTopic: pblConfig?.projectTopic || outline.title,
      projectDescription: pblConfig?.projectDescription || outline.description,
      courseContext: buildCourseContext(ctx),
      agents: agentsText,
      userProfile: userProfile || '',
      languageDirective: languageDirective || '',
    });

    if (!prompts) {
      return generateDefaultPBLActions(outline);
    }

    const response = await aiCall(prompts.system, prompts.user);
    const actions = parseActionsFromStructuredOutput(response, outline.type);

    if (actions.length > 0) {
      return processActions(actions, [], agents);
    }

    return generateDefaultPBLActions(outline);
  }

  return [];
}

/**
 * Generate default PBL Actions (fallback)
 */
function generateDefaultPBLActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      title: 'PBL 项目介绍',
      text: '现在让我们开始一个项目式学习活动。请选择你的角色，查看任务看板，开始协作完成项目。',
    },
  ];
}

/**
 * Format element list for AI to select elementId
 */
function formatElementsForPrompt(elements: PPTElement[]): string {
  return elements
    .map((el) => {
      let summary = '';
      if (el.type === 'text' && 'content' in el) {
        // Extract text content summary (strip HTML tags)
        const textContent = ((el.content as string) || '').replace(/<[^>]*>/g, '').substring(0, 50);
        summary = `Content summary: "${textContent}${textContent.length >= 50 ? '...' : ''}"`;
      } else if (el.type === 'chart' && 'chartType' in el) {
        summary = `Chart type: ${el.chartType}`;
      } else if (el.type === 'image') {
        summary = 'Image element';
      } else if (el.type === 'shape' && 'shapeName' in el) {
        summary = `Shape: ${el.shapeName || 'unknown'}`;
      } else if (el.type === 'latex' && 'latex' in el) {
        summary = `Formula: ${((el.latex as string) || '').substring(0, 30)}`;
      } else {
        summary = `${el.type} element`;
      }
      return `- id: "${el.id}", type: "${el.type}", ${summary}`;
    })
    .join('\n');
}

/**
 * Format question list for AI reference
 */
function formatQuestionsForPrompt(questions: QuizQuestion[]): string {
  return questions
    .map((q, i) => {
      const optionsText = q.options
        ? `Options: ${q.options.map((o) => `${o.value}. ${o.label}`).join(', ')}`
        : '';
      return `Q${i + 1} (${q.type}): ${q.question}\n${optionsText}`;
    })
    .join('\n\n');
}

/**
 * Convert Ultra Mode teacherActions to standard Actions for playback.
 *
 * TeacherAction types: speech, highlight, annotation, reveal, setState
 * Action types: speech, widget_highlight, widget_setState, widget_annotation, widget_reveal
 *
 * Conversion strategy:
 * - speech → single speech Action
 * - highlight/setState/annotation/reveal with content → TWO Actions:
 *   1. widget action (visual/state change) - quick, non-blocking
 *   2. speech action (narration) - PlaybackEngine handles TTS
 * - highlight/setState/annotation/reveal without content → single widget action
 */
function convertTeacherActionsToActions(teacherActions: TeacherAction[]): Action[] {
  const actions: Action[] = [];

  for (const ta of teacherActions) {
    // Always use nanoid for unique action IDs to prevent audio ID collisions
    // Ultra Mode generates sequential IDs like "action_1" which are NOT unique across scenes
    const actionId = `action_${nanoid(8)}`;
    const base = {
      id: actionId,
      title: ta.label || '',
    };

    switch (ta.type) {
      case 'speech':
        actions.push({
          ...base,
          type: 'speech',
          text: ta.content || '',
        } as SpeechAction);
        break;

      case 'highlight':
        // Add widget highlight action (visual, quick)
        actions.push({
          ...base,
          type: 'widget_highlight',
          target: ta.target || '',
          content: undefined, // No speech in widget action
        } as WidgetHighlightAction);
        // Add speech action for narration (if content exists)
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      case 'setState':
        // Add widget setState action
        actions.push({
          ...base,
          type: 'widget_setState',
          state: ta.state || {},
          content: undefined,
        } as WidgetSetStateAction);
        // Add speech action for narration
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      case 'annotation':
        actions.push({
          ...base,
          type: 'widget_annotation',
          target: ta.target || '',
          content: undefined,
        } as WidgetAnnotationAction);
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      case 'reveal':
        actions.push({
          ...base,
          type: 'widget_reveal',
          target: ta.target || '',
          content: undefined,
        } as WidgetRevealAction);
        if (ta.content) {
          actions.push({
            id: `${base.id}_speech`,
            type: 'speech',
            text: ta.content,
            title: base.title,
          } as SpeechAction);
        }
        break;

      default:
        // Fallback to speech for unknown types
        actions.push({
          ...base,
          type: 'speech',
          text: ta.content || '',
        } as SpeechAction);
    }
  }

  return actions;
}

/**
 * Process and validate Actions
 */
function processActions(actions: Action[], elements: PPTElement[], agents?: AgentInfo[]): Action[] {
  const elementIds = new Set(elements.map((el) => el.id));
  const agentIds = new Set(agents?.map((a) => a.id) || []);
  const studentAgents = agents?.filter((a) => a.role === 'student') || [];
  const nonTeacherAgents = agents?.filter((a) => a.role !== 'teacher') || [];

  return actions.map((action) => {
    // Ensure each action has an ID
    const processedAction: Action = {
      ...action,
      id: action.id || `action_${nanoid(8)}`,
    };

    // Validate spotlight elementId
    if (processedAction.type === 'spotlight') {
      const spotlightAction = processedAction;
      if (!spotlightAction.elementId || !elementIds.has(spotlightAction.elementId)) {
        // If elementId is invalid, try selecting the first element
        if (elements.length > 0) {
          spotlightAction.elementId = elements[0].id;
          log.warn(
            `Invalid elementId, falling back to first element: ${spotlightAction.elementId}`,
          );
        }
      }
    }

    // Validate/fill discussion agentId
    if (processedAction.type === 'discussion' && agents && agents.length > 0) {
      if (processedAction.agentId && agentIds.has(processedAction.agentId)) {
        // agentId valid — keep it
      } else {
        // agentId missing or invalid — pick a random student, or non-teacher, or skip
        const pool = studentAgents.length > 0 ? studentAgents : nonTeacherAgents;
        if (pool.length > 0) {
          const picked = pool[Math.floor(Math.random() * pool.length)];
          log.warn(
            `Discussion agentId "${processedAction.agentId || '(none)'}" invalid, assigned: ${picked.id} (${picked.name})`,
          );
          processedAction.agentId = picked.id;
        }
      }
    }

    return processedAction;
  });
}

/**
 * Generate default slide Actions (fallback)
 */
function generateDefaultSlideActions(outline: SceneOutline, elements: PPTElement[]): Action[] {
  const actions: Action[] = [];

  // Add spotlight for text elements
  const textElements = elements.filter((el) => el.type === 'text');
  if (textElements.length > 0) {
    actions.push({
      id: `action_${nanoid(8)}`,
      type: 'spotlight',
      title: '聚焦重点',
      elementId: textElements[0].id,
    });
  }

  // Add opening speech based on key points
  const speechText = outline.keyPoints?.length
    ? outline.keyPoints.join('。') + '。'
    : outline.description || outline.title;
  actions.push({
    id: `action_${nanoid(8)}`,
    type: 'speech',
    title: '场景讲解',
    text: speechText,
  });

  return actions;
}

/**
 * Generate default quiz Actions (fallback)
 */
function generateDefaultQuizActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      title: '测验引导',
      text: '现在让我们来做一个小测验，检验一下学习成果。',
    },
  ];
}

/**
 * Generate default interactive Actions (fallback)
 */
function generateDefaultInteractiveActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      title: '交互引导',
      text: '现在让我们通过交互式可视化来探索这个概念。请尝试操作页面中的元素，观察变化。',
    },
  ];
}

/**
 * Create a complete scene with Actions
 */
export function createSceneWithActions(
  outline: SceneOutline,
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent,
  actions: Action[],
  api: ReturnType<typeof createStageAPI>,
): string | null {
  if (outline.type === 'slide' && 'elements' in content) {
    // Build complete Slide object
    const defaultTheme: SlideTheme = {
      backgroundColor: '#ffffff',
      themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
      outline: { color: '#d14424', width: 2, style: 'solid' },
      shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
    };

    const slide: Slide = {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: defaultTheme,
      elements: content.elements,
      background: content.background,
    };

    const sceneResult = api.scene.create({
      type: 'slide',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'slide',
        canvas: slide,
      },
      actions,
    });

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  if (outline.type === 'quiz' && 'questions' in content) {
    const sceneResult = api.scene.create({
      type: 'quiz',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'quiz',
        questions: content.questions,
      },
      actions,
    });

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  if (outline.type === 'interactive' && 'html' in content) {
    const sceneResult = api.scene.create({
      type: 'interactive',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'interactive',
        url: '',
        html: content.html,
        // Ultra Mode widget fields
        widgetType: content.widgetType,
        widgetConfig: content.widgetConfig,
        teacherActions: content.teacherActions,
      },
      actions,
    });

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  if (outline.type === 'pbl' && 'projectConfig' in content) {
    const sceneResult = api.scene.create({
      type: 'pbl',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'pbl',
        projectConfig: content.projectConfig,
      },
      actions,
    });

    return sceneResult.success ? (sceneResult.data ?? null) : null;
  }

  return null;
}
