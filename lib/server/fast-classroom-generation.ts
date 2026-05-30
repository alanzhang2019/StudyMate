import { nanoid } from 'nanoid';
import { callLLM } from '@/lib/ai/llm';
import { createStageAPI } from '@/lib/api/stage-api';
import type { StageStore } from '@/lib/api/stage-api-types';
import { createSceneWithActions } from '@/lib/generation/scene-generator';
import type { AICallFn, AgentInfo } from '@/lib/generation/pipeline-types';
import { getDefaultAgents } from '@/lib/orchestration/registry/store';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import { persistClassroom } from '@/lib/server/classroom-storage';
import type { Scene, Stage } from '@/lib/types/stage';
import type { PPTElement } from '@/lib/types/slides';
import type { GenerateClassroomInput, GenerateClassroomResult, ClassroomGenerationProgress } from './classroom-generation';

const log = createLogger('FastClassroom');

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

/**
 * Fast classroom generation for single-problem scenarios (mistake mode).
 * Skips outline generation and agent generation, directly creating a single scene.
 * This reduces generation time from ~90s to ~30s.
 */
// Overall timeout for fast classroom generation (5 minutes)
const FAST_GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

export async function generateFastClassroom(
  input: GenerateClassroomInput,
  options: {
    baseUrl: string;
    onProgress?: (progress: ClassroomGenerationProgress) => Promise<void> | void;
    onPlayable?: (result: GenerateClassroomResult) => Promise<void> | void;
  },
): Promise<GenerateClassroomResult> {
  // Wrap the entire generation in a timeout
  const generationPromise = generateFastClassroomInternal(input, options);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('生成任务超时（5分钟），请重试')), FAST_GENERATION_TIMEOUT_MS);
  });

  return Promise.race([generationPromise, timeoutPromise]);
}

async function generateFastClassroomInternal(
  input: GenerateClassroomInput,
  options: {
    baseUrl: string;
    onProgress?: (progress: ClassroomGenerationProgress) => Promise<void> | void;
    onPlayable?: (result: GenerateClassroomResult) => Promise<void> | void;
  },
): Promise<GenerateClassroomResult> {
  const { requirement } = input;

  await options.onProgress?.({
    step: 'initializing',
    progress: 10,
    message: '准备生成课件',
    scenesGenerated: 0,
  });

  const { model: languageModel } = await resolveModel({
    modelString: input.modelString || process.env.MISTAKE_CLASSROOM_MODEL || process.env.DEFAULT_MODEL,
  });

  // Use default agents (skip agent generation)
  const agents = getDefaultAgents();

  const stageId = nanoid(10);
  const stage: Stage = {
    id: stageId,
    name: '作业讲解',
    description: requirement.slice(0, 100),
    languageDirective: '用中文讲解',
    style: 'interactive',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    agentIds: agents.map((a) => a.id),
  };

  const store = createInMemoryStore(stage);
  const api = createStageAPI(store);

  await options.onProgress?.({
    step: 'generating_scenes',
    progress: 30,
    message: '生成讲解内容',
    scenesGenerated: 0,
    totalScenes: 1,
  });

  // Build AI call function with timeout
  const aiCall: AICallFn = async (systemPrompt, userPrompt, images) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (images && images.length > 0) {
      const content: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }> = [
        { type: 'text', text: userPrompt },
      ];
      for (const img of images) {
        content.push({ type: 'image', image: img.src });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    // Wrap callLLM with a 60-second timeout to prevent indefinite hanging
    const llmPromise = callLLM(
      {
        model: languageModel,
        messages,
        maxOutputTokens: 4096,
      },
      'generate-classroom',
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM调用超时（60秒）')), 60000);
    });

    const result = await Promise.race([llmPromise, timeoutPromise]);
    return result.text;
  };

  // Prepare vision images if provided
  const visionImages = input.imageData?.map((img, idx) => ({
    id: `vision-${idx}`,
    src: `data:${img.mimeType};base64,${img.base64}`,
  }));

  // Generate scene content and actions in a single LLM call
  const contentPrompt = `请为以下作业题生成详细的作业讲解内容：

${requirement}

要求：
1. 开头先展示题目内容，让学生清楚知道在讲哪道题
2. 分析题目，指出易错点
3. 给出正确的解题思路
4. 提供详细的步骤讲解
5. 总结关键知识点
6. 讲解过程中使用"作业讲解"来指代本次讲解，不要使用"错题讲解"

请直接输出讲解内容，不需要JSON格式。`;

  await options.onProgress?.({
    step: 'generating_scenes',
    progress: 35,
    message: 'AI正在思考讲解思路...',
    scenesGenerated: 0,
    totalScenes: 1,
  });

  const content = await aiCall(
    '你是一位经验丰富的数学老师，擅长用简单易懂的方式讲解作业题。注意：这是"作业讲解"，不是"错题讲解"，讲解过程中不要出现"错题讲解"这个词。',
    contentPrompt,
    visionImages,
  );

  await options.onProgress?.({
    step: 'generating_scenes',
    progress: 60,
    message: '生成教学动作',
    scenesGenerated: 0,
    totalScenes: 1,
  });

  // Generate actions based on content
  const actionsPrompt = `根据以下讲解内容，生成教学动作序列：

${content}

要求：
1. 生成 SPEECH 动作来讲解内容
2. 将讲解内容分成3-5个自然段落
3. 每个段落对应一个 SPEECH 动作
4. 在关键步骤添加 SPOTLIGHT 动作强调重点
5. 最后添加一个 INTERACT 动作，让学生回答问题

请返回JSON格式：
{
  "actions": [
    {"type": "SPEECH", "agentId": "teacher", "text": "..."},
    {"type": "SPOTLIGHT", "target": "..."},
    {"type": "INTERACT", "question": "...", "expectedAnswer": "..."}
  ]
}`;

  await options.onProgress?.({
    step: 'generating_scenes',
    progress: 65,
    message: '设计互动教学环节...',
    scenesGenerated: 0,
    totalScenes: 1,
  });

  const actionsResponse = await aiCall(
    '你是一位教学设计师，擅长将讲解内容转化为互动教学动作。',
    actionsPrompt,
  );

  let actions: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(actionsResponse.replace(/```json\s*|\s*```/g, ''));
    actions = parsed.actions || [];
  } catch {
    // Fallback: create simple speech actions
    actions = content.split('\n\n').filter(Boolean).map((paragraph, i) => ({
      type: 'SPEECH',
      agentId: 'teacher',
      text: paragraph.trim(),
      order: i,
    }));
  }

  await options.onProgress?.({
    step: 'generating_scenes',
    progress: 90,
    message: '组装课件',
    scenesGenerated: 1,
    totalScenes: 1,
  });

  // Extract problem text from requirement to display on slide
  const problemMatch = requirement.match(/题干：(.+)/);
  const problemText = problemMatch ? problemMatch[1].trim() : '';

  // Build slide elements: title + problem text
  const slideElements: PPTElement[] = [];
  if (problemText) {
    // Title element
    slideElements.push({
      id: nanoid(10),
      type: 'text',
      left: 50,
      top: 40,
      width: 860,
      height: 50,
      rotate: 0,
      content: '<p style="font-size: 28px; font-weight: bold; color: #1e293b; text-align: center;">作业讲解</p>',
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#1e293b',
      textType: 'title',
    });
    // Problem text element
    slideElements.push({
      id: nanoid(10),
      type: 'text',
      left: 80,
      top: 120,
      width: 800,
      height: 200,
      rotate: 0,
      content: `<p style="font-size: 20px; color: #334155; line-height: 1.6;"><strong>题目：</strong>${problemText}</p>`,
      defaultFontName: 'Microsoft YaHei',
      defaultColor: '#334155',
      textType: 'content',
      lineHeight: 1.6,
    });
  }

  // Create scene
  const sceneId = createSceneWithActions(
    {
      id: nanoid(10),
      order: 1,
      type: 'slide',
      title: '作业讲解',
      description: '详细讲解这道作业题',
      estimatedDuration: 300,
      keyPoints: ['分析题目', '讲解思路', '总结方法'],
    },
    {
      elements: slideElements,
      background: { type: 'solid' as const, color: '#f8fafc' },
    },
    actions.map((a, i) => {
      const baseAction = {
        id: nanoid(10),
        ...a,
      };
      
      switch (a.type) {
        case 'SPEECH':
          return {
            ...baseAction,
            type: 'speech' as const,
            text: a.text as string || '',
            agentId: a.agentId as string || 'teacher',
          };
        case 'SPOTLIGHT':
          return {
            ...baseAction,
            type: 'spotlight' as const,
            elementId: a.target as string || '',
          };
        case 'INTERACT':
          return {
            ...baseAction,
            type: 'waitForInteraction' as const,
            interactionType: 'quiz_submit' as const,
          };
        default:
          return {
            ...baseAction,
            type: 'speech' as const,
            text: String(a.text || ''),
            agentId: 'teacher',
          };
      }
    }),
    api,
  );

  if (!sceneId) {
    throw new Error('Failed to create scene');
  }

  const scenes = store.getState().scenes;

  await options.onProgress?.({
    step: 'completed',
    progress: 100,
    message: '课件生成完成',
    scenesGenerated: 1,
    totalScenes: 1,
  });

  // Persist classroom
  const persisted = await persistClassroom(
    {
      id: stageId,
      stage,
      scenes,
    },
    options.baseUrl,
  );

  const result: GenerateClassroomResult = {
    id: persisted.id,
    url: persisted.url,
    stage,
    scenes,
    scenesCount: scenes.length,
    createdAt: persisted.createdAt,
  };

  await options.onPlayable?.(result);

  return result;
}
