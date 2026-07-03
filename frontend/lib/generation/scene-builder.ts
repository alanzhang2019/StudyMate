/**
 * Standalone scene building and element normalization.
 * Does NOT depend on store — returns complete Scene objects.
 */

import { nanoid } from 'nanoid';
import type {
  SceneOutline,
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
  PdfImage,
  ImageMapping,
} from '@/lib/types/generation';
import type { LanguageModel } from 'ai';
import type { Scene } from '@/lib/types/stage';
import { applyOutlineFallbacks } from './outline-generator';
import {
  generateSceneActions,
  generateSceneContentAndActions,
} from './scene-generator';
import type { AgentInfo, SceneGenerationContext, AICallFn } from './pipeline-types';
import { buildLanguageText } from './prompt-formatters';
import { buildCompleteScene } from './scene-assembly';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

/**
 * Replace sequential gen_img_N / gen_vid_N IDs in outlines with globally unique IDs.
 *
 * The LLM generates sequential placeholder IDs (gen_img_1, gen_img_2, ...) which are
 * only unique within a single course. Since the media store uses elementId as key
 * without stageId scoping, identical IDs across different courses cause thumbnail
 * contamination on the homepage. Using nanoid-based IDs ensures global uniqueness.
 */
export function uniquifyMediaElementIds(outlines: SceneOutline[]): SceneOutline[] {
  const idMap = new Map<string, string>();

  // First pass: collect all sequential media IDs and assign unique replacements
  for (const outline of outlines) {
    if (!outline.mediaGenerations) continue;
    for (const mg of outline.mediaGenerations) {
      if (!idMap.has(mg.elementId)) {
        const prefix = mg.type === 'video' ? 'gen_vid_' : 'gen_img_';
        idMap.set(mg.elementId, `${prefix}${nanoid(8)}`);
      }
    }
  }

  if (idMap.size === 0) return outlines;

  // Second pass: replace IDs in mediaGenerations
  return outlines.map((outline) => {
    if (!outline.mediaGenerations) return outline;
    return {
      ...outline,
      mediaGenerations: outline.mediaGenerations.map((mg) => ({
        ...mg,
        elementId: idMap.get(mg.elementId) || mg.elementId,
      })),
    };
  });
}

/**
 * Build a complete Scene object from an outline (for SSE streaming)
 * This function does NOT depend on store - it returns a complete Scene object
 */
export async function buildSceneFromOutline(
  outline: SceneOutline,
  aiCall: AICallFn,
  stageId: string,
  assignedImages?: PdfImage[],
  imageMapping?: ImageMapping,
  languageModel?: LanguageModel,
  visionEnabled?: boolean,
  ctx?: SceneGenerationContext,
  agents?: AgentInfo[],
  onPhaseChange?: (phase: 'content' | 'actions') => void,
  userProfile?: string,
  languageDirective?: string,
): Promise<Scene | null> {
  // Apply type fallbacks
  outline = applyOutlineFallbacks(outline, !!languageModel);

  const langText = buildLanguageText(languageDirective, outline.languageNote);

  // r12+ — content and actions are produced in a single LLM call for slide,
  // quiz, and interactive scenes. We still keep the legacy two-step fallback
  // for PBL (and any future scene type the combined path can't handle yet) —
  // when the combined function returns an empty actions array, we issue the
  // separate actions call to preserve pre-r12 behavior.
  const { content, actions: combinedActions } = await generateSceneContentAndActions(
    outline,
    aiCall,
    {
      assignedImages,
      imageMapping,
      languageModel,
      visionEnabled,
      agents,
      languageDirective: langText,
    },
  );
  if (!content) {
    log.error(`Failed to generate content for: ${outline.title}`);
    return null;
  }

  onPhaseChange?.('actions');
  let actions = combinedActions;
  if (actions.length === 0) {
    log.debug(
      `Combined path produced no actions for "${outline.title}"; falling back to separate actions call`,
    );
    actions = await generateSceneActions(outline, content, aiCall, {
      ctx,
      agents,
      userProfile,
      languageDirective: langText,
    });
  }
  log.debug(`Generated ${actions.length} actions for: ${outline.title}`);

  // Build complete Scene object
  return buildCompleteScene(outline, content, actions, stageId);
}
export { buildCompleteScene } from './scene-assembly';
