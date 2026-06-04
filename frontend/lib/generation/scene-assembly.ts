import { nanoid } from 'nanoid';
import type {
  SceneOutline,
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
} from '@/lib/types/generation';
import type { Slide, SlideTheme } from '@/lib/types/slides';
import type { Scene } from '@/lib/types/stage';
import type { Action } from '@/lib/types/action';

type GeneratedSceneContent =
  | GeneratedSlideContent
  | GeneratedQuizContent
  | GeneratedInteractiveContent
  | GeneratedPBLContent;

export function buildSceneFromGeneratedContent(
  outline: SceneOutline,
  content: GeneratedSceneContent,
  stageId: string,
  actions: Action[] = [],
): Scene {
  const sceneId = nanoid();

  if (outline.type === 'slide' && 'elements' in content) {
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

    return {
      id: sceneId,
      stageId,
      type: 'slide',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'slide',
        canvas: slide,
      },
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  if (outline.type === 'quiz' && 'questions' in content) {
    return {
      id: sceneId,
      stageId,
      type: 'quiz',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'quiz',
        questions: content.questions,
      },
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  if (outline.type === 'interactive' && 'html' in content) {
    return {
      id: sceneId,
      stageId,
      type: 'interactive',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'interactive',
        url: '',
        html: content.html,
        widgetType: content.widgetType,
        widgetConfig: content.widgetConfig,
        teacherActions: content.teacherActions,
      },
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  if (outline.type === 'pbl' && 'projectConfig' in content) {
    return {
      id: sceneId,
      stageId,
      type: 'pbl',
      title: outline.title,
      order: outline.order,
      content: {
        type: 'pbl',
        projectConfig: content.projectConfig,
      },
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  throw new Error(`Unsupported scene content for outline type: ${outline.type}`);
}

export function buildCompleteScene(
  outline: SceneOutline,
  content: GeneratedSceneContent,
  actions: Action[],
  stageId: string,
): Scene {
  return buildSceneFromGeneratedContent(outline, content, stageId, actions);
}
