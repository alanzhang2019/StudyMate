'use client';

import { useMemo } from 'react';
import type { Scene, StageMode } from '@/lib/types/stage';
import { useStageStore } from '@/lib/store';
import { SlideEditor as SlideRenderer } from '../slide-renderer/Editor';
import { QuizView } from '../scene-renderers/quiz-view';
import { InteractiveRenderer } from '../scene-renderers/interactive-renderer';
import { PBLRenderer } from '../scene-renderers/pbl-renderer';

interface SceneRendererProps {
  readonly scene: Scene;
  readonly mode: StageMode;
}

export function SceneRenderer({ scene, mode }: SceneRendererProps) {
  // Pull every scene in this stage from the store so we can
  // compute a 0-based "previous-question-count" offset for
  // the quiz scene currently being rendered. The full
  // 真题卷 (e.g. CSP-J 2021) has 6 quiz scenes in a single
  // stage; the choice scene shows 1–15, the read scenes
  // 16–33, the perfect scenes 34–43. Without this offset the
  // QuestionCard badge would only show 1, 2, 3 ... in every
  // scene, hiding the global exam number that the question
  // text already references (e.g. "16. ...") — the user
  // flagged this as "题目总编号丢失了" (the total question
  // numbers are lost) in QA.
  const allScenes = useStageStore((s) => s.scenes);
  const questionIndexOffset = useMemo(() => {
    // Find this scene's position in the stage's scene list.
    // We use `order` as the canonical sort key — it matches
    // the way the scene sidebar lists scenes and the way
    // the finalize endpoint orders scenes, so the displayed
    // question number is consistent with the final score
    // page's "第 N 部分" labels.
    const sortedScenes = [...allScenes].sort((a, b) => a.order - b.order);
    const myIdx = sortedScenes.findIndex((s) => s.id === scene.id);
    if (myIdx <= 0) return 0;
    // Sum up the question count of every quiz scene that
    // comes before the current one. We use the question
    // count, not the scene count, because a single "read
    // program" scene contains 6 sub-questions in CSP-J 2021
    // and we want the offset to track sub-question count.
    // Non-quiz scenes (slide, interactive, pbl) contribute
    // 0 to the offset since they don't have a question
    // number to consume.
    let offset = 0;
    for (let i = 0; i < myIdx; i++) {
      const prev = sortedScenes[i];
      const c = prev.content;
      if (c && c.type === 'quiz' && Array.isArray(c.questions)) {
        offset += c.questions.length;
      }
    }
    return offset;
  }, [allScenes, scene.id]);

  const renderer = useMemo(() => {
    switch (scene.type) {
      case 'slide':
        if (scene.content.type !== 'slide') return <div>Invalid slide content</div>;
        return <SlideRenderer mode={mode} />;
      case 'quiz':
        if (scene.content.type !== 'quiz') return <div>Invalid quiz content</div>;
        // Pass `codeBlock` (if any) and `kind` (type chip on the
        // chapter cover) through to QuizView — for code-reading
        // ("阅读程序") and code-completion ("完善程序") scenes,
        // the program listing is rendered once above the question
        // list, paper-style. The cover shows a tag like
        // "单项选择题 / 阅读程序题 / 完善程序题" so the student
        // knows what to expect before pressing "开始答题".
        // `questionIndexOffset` lets the QuestionCard badge
        // show the global question number across all 6 scenes
        // of a 真题卷 (so 完善程序题 1 shows 34–38 and 完善
        // 程序题 2 shows 39–43 instead of all showing 1–5).
        return (
          <QuizView
            key={scene.id}
            questions={scene.content.questions}
            sceneId={scene.id}
            classroomId={scene.stageId}
            codeBlock={scene.content.codeBlock}
            kind={scene.content.kind}
            questionIndexOffset={questionIndexOffset}
          />
        );
      case 'interactive':
        if (scene.content.type !== 'interactive') return <div>Invalid interactive content</div>;
        return <InteractiveRenderer content={scene.content} sceneId={scene.id} />;
      case 'pbl':
        if (scene.content.type !== 'pbl') return <div>Invalid PBL content</div>;
        return <PBLRenderer content={scene.content} mode={mode} sceneId={scene.id} />;
      default:
        return <div>Unknown scene type</div>;
    }
  }, [scene, mode, questionIndexOffset]);

  return (
    <div className="w-full h-full">
      {renderer}
    </div>
  );
}
