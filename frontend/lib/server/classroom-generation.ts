import { nanoid } from 'nanoid';
import { callLLM } from '@/lib/ai/llm';
import { createStageAPI } from '@/lib/api/stage-api';
import type { StageStore } from '@/lib/api/stage-api-types';
import {
  applyOutlineFallbacks,
  generateSceneOutlinesFromRequirements,
} from '@/lib/generation/outline-generator';
import {
  createSceneWithActions,
  generateSceneActions,
  generateSceneContent,
} from '@/lib/generation/scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { AgentInfo } from '@/lib/generation/pipeline-types';
import { getDefaultAgents } from '@/lib/orchestration/registry/store';
import { createLogger } from '@/lib/logger';
import { isProviderKeyRequired } from '@/lib/ai/providers';
import { resolveClassroomWebSearchConfig } from '@/lib/server/web-search-config';
import { resolveModel } from '@/lib/server/resolve-model';
import { buildSearchQuery } from '@/lib/server/search-query-builder';
import { formatSearchResultsAsContext, searchWeb } from '@/lib/web-search';
import type { BaiduSubSources, WebSearchProviderId } from '@/lib/web-search/types';
import { persistClassroom } from '@/lib/server/classroom-storage';
import {
  generateMediaForClassroom,
  replaceMediaPlaceholders,
  generateTTSForClassroom,
} from '@/lib/server/classroom-media-generation';
import { buildVideoManifestFromOutlines } from '@/lib/media/video-manifest';
import type { UserRequirements } from '@/lib/types/generation';
import type { Scene, Stage } from '@/lib/types/stage';
import { AGENT_COLOR_PALETTE, AGENT_DEFAULT_AVATARS } from '@/lib/constants/agent-defaults';
import {
  isFastGenerationEnabled,
  getOptimizedMaxTokens,
  getOptimizedSceneCount,
} from '@/lib/generation/fast-mode';

const log = createLogger('Classroom');

export interface GenerateClassroomInput {
  requirement: string;
  modelString?: string;
  maxScenes?: number;
  pdfContent?: { text: string; images: string[] };
  /** Direct image data for vision-based generation (skips OCR) */
  imageData?: { mimeType: string; base64: string }[];
  enableWebSearch?: boolean;
  webSearchProviderId?: WebSearchProviderId;
  webSearchApiKey?: string;
  baiduSubSources?: BaiduSubSources;
  enableImageGeneration?: boolean;
  enableVideoGeneration?: boolean;
  enableTTS?: boolean;
  agentMode?: 'default' | 'generate';
  userNickname?: string;
  userBio?: string;
}

export type ClassroomGenerationStep =
  | 'initializing'
  | 'researching'
  | 'generating_outlines'
  | 'generating_scenes'
  | 'generating_media'
  | 'generating_tts'
  | 'persisting'
  | 'completed';

export interface ClassroomGenerationProgress {
  step: ClassroomGenerationStep;
  progress: number;
  message: string;
  scenesGenerated: number;
  totalScenes?: number;
}

export interface GenerateClassroomResult {
  id: string;
  url: string;
  stage: Stage;
  scenes: Scene[];
  scenesCount: number;
  createdAt: string;
}

export function resolveClassroomModelString(input: GenerateClassroomInput): string | undefined {
  return (
    input.modelString ||
    process.env.MISTAKE_CLASSROOM_MODEL ||
    process.env.MISTAKE_OCR_MODEL ||
    process.env.DEFAULT_MODEL
  );
}

export function shouldPersistPlayableClassroom(
  scenesGenerated: number,
  playablePersisted: boolean,
): boolean {
  return !playablePersisted && scenesGenerated > 0;
}

export function limitSceneOutlines<T>(outlines: T[], maxScenes?: number): T[] {
  if (!maxScenes || maxScenes < 1 || outlines.length <= maxScenes) {
    return outlines;
  }

  return outlines.slice(0, maxScenes);
}

function createInMemoryStore(stage: Stage): StageStore {
  let state = {
    stage: stage as Stage | null,
    scenes: [] as Scene[],
    currentSceneId: null as string | null,
    mode: 'playback' as const,
  };

  const listeners: Array<(s: typeof state, prev: typeof state) => void> = [];

  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      const prev = state;
      state = { ...state, ...partial };
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe: (listener: (s: typeof state, prev: typeof state) => void) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
  };
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

async function generateAgentProfiles(
  requirement: string,
  languageDirective: string,
  aiCall: AICallFn,
): Promise<AgentInfo[]> {
  const systemPrompt =
    'You are an expert instructional designer. Generate agent profiles for a multi-agent classroom simulation. Return ONLY valid JSON, no markdown or explanation.';

  const userPrompt = `Generate agent profiles for a course with this requirement:
${requirement}

Requirements:
- Decide the appropriate number of agents based on the course content (typically 3-5)
- Exactly 1 agent must have role "teacher", the rest can be "assistant" or "student"
- Each agent needs: name, role, persona (2-3 sentences describing personality and teaching/learning style)
- Language directive for this course: ${languageDirective}
  Agent names and personas must follow this language directive.

Return a JSON object with this exact structure:
{
  "agents": [
    {
      "name": "string",
      "role": "teacher" | "assistant" | "student",
      "persona": "string (2-3 sentences)"
    }
  ]
}`;

  const response = await aiCall(systemPrompt, userPrompt);
  const rawText = stripCodeFences(response);
  const parsed = JSON.parse(rawText) as {
    agents: Array<{ name: string; role: string; persona: string }>;
  };

  if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length < 2) {
    throw new Error(`Expected at least 2 agents, got ${parsed.agents?.length ?? 0}`);
  }

  const teacherCount = parsed.agents.filter((a) => a.role === 'teacher').length;
  if (teacherCount !== 1) {
    throw new Error(`Expected exactly 1 teacher, got ${teacherCount}`);
  }

  return parsed.agents.map((a, i) => ({
    id: `gen-server-${i}`,
    name: a.name,
    role: a.role,
    persona: a.persona,
  }));
}

export async function generateClassroom(
  input: GenerateClassroomInput,
  options: {
    baseUrl: string;
    onProgress?: (progress: ClassroomGenerationProgress) => Promise<void> | void;
    onPlayable?: (result: GenerateClassroomResult) => Promise<void> | void;
  },
): Promise<GenerateClassroomResult> {
  const { requirement, pdfContent } = input;

  await options.onProgress?.({
    step: 'initializing',
    progress: 5,
    message: 'Initializing classroom generation',
    scenesGenerated: 0,
  });

  const {
    model: languageModel,
    modelInfo,
    modelString,
    providerId,
    apiKey,
  } = await resolveModel({
    modelString: resolveClassroomModelString(input),
  });
  log.info(`Using server-configured model: ${modelString}`);

  // Fail fast if the resolved provider has no API key configured
  if (isProviderKeyRequired(providerId) && !apiKey) {
    throw new Error(
      `No API key configured for provider "${providerId}". ` +
        `Set the appropriate key in .env.local or server-providers.yml (e.g. ${providerId.toUpperCase()}_API_KEY).`,
    );
  }

  // Optimize for faster generation on slow networks
  const optimizedMaxTokens = getOptimizedMaxTokens(modelInfo?.outputWindow);
  const fastMode = isFastGenerationEnabled();

  if (fastMode) {
    log.info('Fast generation mode enabled - optimizing for speed');
  }

  const aiCall: AICallFn = async (systemPrompt, userPrompt, images) => {
    // Build messages with images if provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (images && images.length > 0) {
      // Use AI SDK's multimodal message format
      const content: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [
        { type: 'text', text: userPrompt },
      ];
      for (const img of images) {
        content.push({
          type: 'image',
          image: img.src,
        });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    const result = await callLLM(
      {
        model: languageModel,
        messages,
        maxOutputTokens: optimizedMaxTokens,
      },
      'generate-classroom',
    );
    return result.text;
  };

  const searchQueryAiCall: AICallFn = async (systemPrompt, userPrompt, _images) => {
    const result = await callLLM(
      {
        model: languageModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxOutputTokens: 256,
      },
      'web-search-query-rewrite',
    );
    return result.text;
  };

  const requirements: UserRequirements = {
    requirement,
    userNickname: input.userNickname,
    userBio: input.userBio,
  };
  const pdfText = pdfContent?.text || undefined;

  await options.onProgress?.({
    step: 'researching',
    progress: 10,
    message: 'Researching topic',
    scenesGenerated: 0,
  });

  // Web search (optional, graceful degradation)
  let researchContext: string | undefined;
  if (input.enableWebSearch) {
    const webSearchConfig = resolveClassroomWebSearchConfig(input);
    if (webSearchConfig) {
      try {
        const searchQuery = await buildSearchQuery(requirement, pdfText, searchQueryAiCall);

        log.info('Running web search for classroom generation', {
          hasPdfContext: searchQuery.hasPdfContext,
          rawRequirementLength: searchQuery.rawRequirementLength,
          rewriteAttempted: searchQuery.rewriteAttempted,
          finalQueryLength: searchQuery.finalQueryLength,
        });

        const searchResult = await searchWeb({
          providerId: webSearchConfig.providerId,
          query: searchQuery.query,
          apiKey: webSearchConfig.apiKey,
          baseUrl: webSearchConfig.baseUrl,
          baiduSubSources: webSearchConfig.baiduSubSources,
        });
        researchContext = formatSearchResultsAsContext(searchResult);
        if (researchContext) {
          log.info(`Web search returned ${searchResult.sources.length} sources`);
        }
      } catch (e) {
        log.warn('Web search failed, continuing without search context:', e);
      }
    } else {
      log.warn('enableWebSearch is true but no web search API key configured, skipping web search');
    }
  }

  await options.onProgress?.({
    step: 'generating_outlines',
    progress: 15,
    message: 'Generating scene outlines',
    scenesGenerated: 0,
  });

  // Prepare vision images if provided
  const visionImages = input.imageData?.map((img, idx) => ({
    id: `vision-${idx}`,
    src: `data:${img.mimeType};base64,${img.base64}`,
  }));

  const outlinesResult = await generateSceneOutlinesFromRequirements(
    requirements,
    pdfText,
    visionImages,
    aiCall,
    undefined,
    {
      imageGenerationEnabled: input.enableImageGeneration,
      videoGenerationEnabled: input.enableVideoGeneration,
      researchContext,
      visionEnabled: !!visionImages && visionImages.length > 0,
      // NO teacherContext — agents haven't been generated yet
    },
  );

  if (!outlinesResult.success || !outlinesResult.data) {
    log.error('Failed to generate outlines:', outlinesResult.error);
    throw new Error(outlinesResult.error || 'Failed to generate scene outlines');
  }

  const { languageDirective } = outlinesResult.data;
  // Apply fast mode scene count limit
  const effectiveMaxScenes = fastMode ? getOptimizedSceneCount(input.maxScenes) : input.maxScenes;
  if (fastMode && input.maxScenes && input.maxScenes > 5) {
    log.info(`Fast mode: limiting scenes from ${input.maxScenes} to ${effectiveMaxScenes}`);
  }
  const outlines = limitSceneOutlines(outlinesResult.data.outlines, effectiveMaxScenes);
  log.info(`Generated ${outlines.length} scene outlines (languageDirective: ${languageDirective})`);

  await options.onProgress?.({
    step: 'generating_outlines',
    progress: 30,
    message: `Generated ${outlines.length} scene outlines`,
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });

  // Resolve agents based on agentMode — now AFTER outlines so we can use languageDirective
  let agents: AgentInfo[];
  const agentMode = input.agentMode || 'default';
  if (agentMode === 'generate') {
    log.info('Generating custom agent profiles via LLM...');
    try {
      agents = await generateAgentProfiles(requirement, languageDirective, aiCall);
      log.info(`Generated ${agents.length} agent profiles`);
    } catch (e) {
      log.warn('Agent profile generation failed, falling back to defaults:', e);
      agents = getDefaultAgents();
    }
  } else {
    agents = getDefaultAgents();
  }

  const stageId = nanoid(10);
  const stage: Stage = {
    id: stageId,
    name: outlines[0]?.title || requirement.slice(0, 50),
    description: undefined,
    languageDirective,
    videoManifest: buildVideoManifestFromOutlines(outlines),
    style: 'interactive',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // For LLM-generated agents, embed full configs so the client can
    // hydrate the agent registry without prior IndexedDB data.
    // For default agents, just record IDs — the client already has them.
    ...(agentMode === 'generate'
      ? {
          generatedAgentConfigs: agents.map((a, i) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            persona: a.persona || '',
            avatar: AGENT_DEFAULT_AVATARS[i % AGENT_DEFAULT_AVATARS.length],
            color: AGENT_COLOR_PALETTE[i % AGENT_COLOR_PALETTE.length],
            priority: a.role === 'teacher' ? 10 : a.role === 'assistant' ? 7 : 5,
          })),
        }
      : {
          agentIds: agents.map((a) => a.id),
        }),
  };

  const store = createInMemoryStore(stage);
  const api = createStageAPI(store);

  log.info('Stage 2: Generating scene content and actions...');
  let generatedScenes = 0;
  let playablePersisted = false;

  let nextIndexToInsert = 0;
  const pendingResults = new Map<number, { safeOutline: any; content: any; actions: any } | null>();

  await Promise.all(
    outlines.map(async (outline, index) => {
      const safeOutline = applyOutlineFallbacks(outline, true);
      const progressStart = 30 + Math.floor((index / Math.max(outlines.length, 1)) * 60);

      await options.onProgress?.({
        step: 'generating_scenes',
        progress: Math.max(progressStart, 31),
        message: `Generating scene ${index + 1}/${outlines.length}: ${safeOutline.title}`,
        scenesGenerated: generatedScenes,
        totalScenes: outlines.length,
      });

      const userProfile =
        requirements.userNickname || requirements.userBio
          ? `Student: ${requirements.userNickname || 'Unknown'}${requirements.userBio ? ` — ${requirements.userBio}` : ''}`
          : undefined;

      const content = await generateSceneContent(safeOutline, aiCall, { agents, languageDirective });
      if (!content) {
        log.warn(`Skipping scene "${safeOutline.title}" — content generation failed`);
        pendingResults.set(index, null);
      } else {
        const actions = await generateSceneActions(safeOutline, content, aiCall, {
          agents,
          languageDirective,
          userProfile,
        });
        log.info(`Scene "${safeOutline.title}": ${actions.length} actions`);
        pendingResults.set(index, { safeOutline, content, actions });
      }

      // Synchronize insertion into the store in order
      while (pendingResults.has(nextIndexToInsert)) {
        const res = pendingResults.get(nextIndexToInsert);
        pendingResults.delete(nextIndexToInsert);
        
        if (res) {
          const sceneId = createSceneWithActions(res.safeOutline, res.content, res.actions, api);
          if (!sceneId) {
            log.warn(`Skipping scene "${res.safeOutline.title}" — scene creation failed`);
          } else {
            generatedScenes += 1;
            const progressEnd = 30 + Math.floor(((nextIndexToInsert + 1) / Math.max(outlines.length, 1)) * 60);
            await options.onProgress?.({
              step: 'generating_scenes',
              progress: Math.min(progressEnd, 90),
              message: `Generated ${generatedScenes}/${outlines.length} scenes`,
              scenesGenerated: generatedScenes,
              totalScenes: outlines.length,
            });

            if (shouldPersistPlayableClassroom(generatedScenes, playablePersisted)) {
              const playableScenes = store.getState().scenes;
              const persisted = await persistClassroom(
                {
                  id: stageId,
                  stage,
                  scenes: playableScenes,
                },
                options.baseUrl,
              );

              playablePersisted = true;

              await options.onPlayable?.({
                id: persisted.id,
                url: persisted.url,
                stage,
                scenes: playableScenes,
                scenesCount: playableScenes.length,
                createdAt: persisted.createdAt,
              });
            }
          }
        }
        nextIndexToInsert++;
      }
    })
  );

  const scenes = store.getState().scenes;
  log.info(`Pipeline complete: ${scenes.length} scenes generated`);

  if (scenes.length === 0) {
    throw new Error('No scenes were generated');
  }

  // Phase: Media generation (after all scenes generated)
  if (input.enableImageGeneration || input.enableVideoGeneration) {
    await options.onProgress?.({
      step: 'generating_media',
      progress: 90,
      message: 'Generating media files',
      scenesGenerated: scenes.length,
      totalScenes: outlines.length,
    });

    try {
      const mediaMap = await generateMediaForClassroom(outlines, stageId, options.baseUrl);
      replaceMediaPlaceholders(scenes, mediaMap);
      log.info(`Media generation complete: ${Object.keys(mediaMap).length} files`);
    } catch (err) {
      log.warn('Media generation phase failed, continuing:', err);
    }
  }

  // Phase: TTS generation
  if (input.enableTTS) {
    await options.onProgress?.({
      step: 'generating_tts',
      progress: 94,
      message: 'Generating TTS audio',
      scenesGenerated: scenes.length,
      totalScenes: outlines.length,
    });

    try {
      await generateTTSForClassroom(scenes, stageId, options.baseUrl);
      log.info('TTS generation complete');
    } catch (err) {
      log.warn('TTS generation phase failed, continuing:', err);
    }
  }

  await options.onProgress?.({
    step: 'persisting',
    progress: 98,
    message: 'Persisting classroom data',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  const persisted = await persistClassroom(
    {
      id: stageId,
      stage,
      scenes,
    },
    options.baseUrl,
  );

  log.info(`Classroom persisted: ${persisted.id}, URL: ${persisted.url}`);

  await options.onProgress?.({
    step: 'completed',
    progress: 100,
    message: 'Classroom generation completed',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  return {
    id: persisted.id,
    url: persisted.url,
    stage,
    scenes,
    scenesCount: scenes.length,
    createdAt: persisted.createdAt,
  };
}
