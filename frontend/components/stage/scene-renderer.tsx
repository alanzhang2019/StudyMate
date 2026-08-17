'use client';

import { useMemo } from 'react';
import type { QuizQuestion, Scene, StageMode } from '@/lib/types/stage';
import { useStageStore } from '@/lib/store';
import { SlideEditor as SlideRenderer } from '../slide-renderer/Editor';
import { QuizView } from '../scene-renderers/quiz-view';
import { InteractiveRenderer } from '../scene-renderers/interactive-renderer';
import { PBLRenderer } from '../scene-renderers/pbl-renderer';

interface SceneRendererProps {
  readonly scene: Scene;
  readonly mode: StageMode;
}

/**
 * Build a "merged" questions list for 真题卷 that flattens all
 * consecutive quiz scenes in the same stage into a single
 * array. Each contributing scene's `codeBlock` is wrapped as a
 * `code_section` sentinel prepended to its question list, so
 * the QuizView can render everything (section heading + code
 * listing + questions) in one continuous scrolling page.
 *
 * Why this exists (Aug 2026 user request):
 *   - 真题卷 like CSP-J 2021 ship as N separate quiz scenes
 *     (1 选择题 scene, 3 阅读程序 scenes, 2 完善程序 scenes).
 *     The previous behaviour required the student to manually
 *     page-flip between scenes, and each scene's code block
 *     was capped at `max-h-[40vh]` so even within a single
 *     scene long programs needed inner scrolling.
 *   - We don't want to change the underlying classroom JSON
 *     (other systems still depend on the per-scene breakdown
 *     for grading, persistence, and the "答对 N 题" sidebar
 *     counts), so we keep the source-of-truth intact and
 *     merge ONLY at the rendering boundary. The QuizView
 *     receives a synthetic sceneId (`merged-<stageId>`) and a
 *     flat questions array; persistence keys use that
 *     synthetic id so drafts/results still round-trip.
 *
 * Returns `null` when the current scene is not part of a
 * merged group (i.e. it's either a non-quiz scene, or the
 * only/last quiz scene in its stage), in which case the
 * caller should fall back to the legacy per-scene rendering.
 */
function buildMergedQuiz(
  scene: Scene,
  allScenes: Scene[],
  stageName?: string,
): { questions: QuizQuestion[]; firstSceneTitle: string; totalPoints: number } | null {
  if (scene.type !== 'quiz' || scene.content.type !== 'quiz') return null;

  const sorted = [...allScenes].sort((a, b) => a.order - b.order);
  const myIdx = sorted.findIndex((s) => s.id === scene.id);
  if (myIdx < 0) return null;

  // A 真题卷 is "all quiz scenes in a stage, back to back".
  // We only merge if there are >= 2 consecutive quiz scenes
  // (single-scene classrooms like a 随堂练习 should keep the
  // existing UX — the cover/answer/review phases per scene).
  const quizScenes = sorted.filter(
    (s) => s.type === 'quiz' && s.content.type === 'quiz',
  );
  if (quizScenes.length < 2) return null;

  // Find the *first* quiz scene in the stage — the merged
  // virtual scene is owned by it, so subsequent scenes in the
  // same stage render as no-ops. This avoids duplicate
  // rendering of the same questions as the user clicks
  // through the sidebar.
  if (sorted[myIdx].id !== quizScenes[0].id) return null;

  // Concatenate every quiz scene's questions, inserting a
  // `code_section` sentinel in front of each scene that has
  // a `codeBlock` so the QuizView can draw the program
  // listing at the correct vertical position. We also
  // insert a sentinel for the first scene if it has a kind
  // (e.g. "单项选择题") so the student sees the same
  // section-heading chip they would have seen in the
  // per-scene cover.
  const mergedQuestions: QuizQuestion[] = [];
  let totalPoints = 0;
  for (const s of quizScenes) {
    if (s.content.type !== 'quiz') continue;
    const qc = s.content;
    const hasCode = !!qc.codeBlock;
    const hasKind = !!qc.kind;

    if (hasCode || hasKind) {
      mergedQuestions.push({
        id: `__section_${s.id}__`,
        type: 'code_section',
        question: '',
        sectionTitle: s.title,
        sectionKind: qc.kind,
        codeBlock: qc.codeBlock,
      });
    }

    for (const q of qc.questions) {
      mergedQuestions.push(q);
      if (q.points) totalPoints += q.points;
    }
  }

  return {
    questions: mergedQuestions,
    // Prefer the stage's own name (e.g. "2021年入门级
    // CSP-J初赛真题卷") for the cover heading; fall back to
    // the first scene's title if the stage didn't set one.
    firstSceneTitle: stageName || sorted[0].title || quizScenes[0].title,
    totalPoints,
  };
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
  const stageName = useStageStore((s) => s.stage?.name);
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

  const merged = useMemo(
    () => buildMergedQuiz(scene, allScenes, stageName),
    [scene, allScenes, stageName],
  );

  const renderer = useMemo(() => {
    switch (scene.type) {
      case 'slide':
        if (scene.content.type !== 'slide') return <div>Invalid slide content</div>;
        return <SlideRenderer mode={mode} />;
      case 'quiz':
        if (scene.content.type !== 'quiz') return <div>Invalid quiz content</div>;
        // 真题卷 "one-page" mode: flatten every quiz scene
        // in this stage into a single QuizView render so the
        // student scrolls one long page instead of flipping
        // between 6 scenes. The merged virtual scene uses
        // a synthetic id (stageId-based) for draft / submitted
        // persistence, but keeps the *first* scene's
        // `kind`/`title` for the cover so the user still
        // sees "单项选择题 / 阅读程序题 / 完善程序题" style
        // section headings inline above each code listing.
        if (merged) {
          return (
            <QuizView
              key={`merged-${scene.stageId}`}
              questions={merged.questions}
              sceneId={`merged-${scene.stageId}`}
              classroomId={scene.stageId}
              codeBlock={undefined}
              kind={scene.content.kind}
              questionIndexOffset={0}
              mergedTitle={merged.firstSceneTitle}
              mergedTotalPoints={merged.totalPoints}
            />
          );
        }
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
  }, [scene, mode, questionIndexOffset, merged]);

  return (
    <div className="w-full h-full">
      {renderer}
    </div>
  );
}
