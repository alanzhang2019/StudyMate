import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { readClassroom } from '@/lib/server/classroom-storage';
import { reevaluateCompletedAt } from '@/lib/server/csp-completion';

// POST /api/csp-quiz/submit
// Persist a student's quiz answers for one quiz scene. Idempotent
// in the database sense (UNIQUE on userId+classroomId+sceneId means
// re-submissions overwrite the previous attempt) but NOT in the
// network sense — clients should still debounce submit-button
// clicks themselves.
//
// Body: {
//   classroomId: string,
//   sceneId: string,
//   answers: [{ questionId: string, choice: string, correct: boolean, ms: number }],
//   totalQuestions: number  // optional; defaults to answers.length
// }
// Auth: required.
//
// Server-side scoring: we trust the client's `correct` boolean
// for each answer and sum to get `correctCount`. We deliberately
// do NOT re-derive correctness from the question bank on the
// server because (a) the classroom JSON's quiz definitions are
// authored client-side and we don't want to ship them through
// the API, and (b) the client has already shown the student
// feedback in real time. Trust the client; score = (correct /
// total) * 100.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;

  let body: {
    classroomId?: string;
    sceneId?: string;
    answers?: { questionId?: string; choice?: string; correct?: boolean; ms?: number; points?: number }[];
    totalQuestions?: number;
  };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const { classroomId, sceneId, answers, totalQuestions } = body;
  if (!classroomId || !sceneId || !Array.isArray(answers)) {
    return apiError('classroomId, sceneId, and answers[] are required', 400);
  }
  if (answers.length === 0) {
    return apiError('answers cannot be empty', 400);
  }

  // Verify classroom exists. We deliberately skip per-question
  // validation (matching the answer against the classroom's
  // question bank) for the same reason we don't re-score:
  // question definitions are authored client-side and shipping
  // them through the API just adds bytes for no security
  // benefit. If the classroom doesn't exist, fail here; if the
  // sceneId is wrong, the student will just not see their
  // submission on the teacher dashboard.
  const classroom = await readClassroom(classroomId);
  if (!classroom) {
    return apiError('Classroom not found', 404);
  }

  const total = totalQuestions ?? answers.length;
  const correctCount = answers.filter((a) => a?.correct === true).length;
  const score = total > 0 ? Math.round((correctCount / total) * 10000) / 100 : 0;
  // Store the full per-question detail so the teacher dashboard
  // can show "which questions did this student get wrong" and
  // "which option did they pick" without re-fetching the
  // classroom. We also persist the per-question `points` (default
  // 1) so the finalize endpoint can sum a real point-weighted
  // total (CSP paper has 1.5 / 2 / etc. point questions) instead
  // of "答对题数 / 总题数".
  const answersJson = JSON.stringify(
    answers.map((a) => ({
      questionId: a.questionId ?? '',
      choice: a.choice ?? '',
      correct: a.correct === true,
      ms: typeof a.ms === 'number' ? a.ms : 0,
      points: typeof a.points === 'number' && Number.isFinite(a.points) && a.points > 0 ? a.points : 1,
    })),
  );

  // Point-weighted score for the per-scene view: we sum the
  // `points` field on each question (default 1) instead of just
  // counting correct answers. Used to drive both the per-scene
  // history row and the paper-level final score.
  let points = 0;
  let maxPoints = 0;
  for (const a of answers) {
    const p =
      typeof a?.points === 'number' && Number.isFinite(a.points) && a.points > 0
        ? a.points
        : 1;
    maxPoints += p;
    if (a?.correct === true) points += p;
  }

  const row = db.cspQuizSubmission.upsert({
    userId,
    classroomId,
    sceneId,
    totalQuestions: total,
    correctCount,
    score,
    answersJson,
  });

  // Append an audit row to csp_quiz_submission_history. This
  // table is APPEND-ONLY: csp_quiz_submissions above is
  // UPSERT-overwritten and only retains the LATEST attempt;
  // the history table keeps EVERY attempt so the FinalScorePage
  // can show "首次 80 → 订正 1 88 → 订正 2 95". We don't
  // delete the history row on the parent upsert — that would
  // re-create it on the next click, making "重置" a no-op.
  // If a row already exists for the same attemptIndex (e.g.
  // a race), the append() function still inserts because there
  // is no UNIQUE constraint on attemptIndex; the UI shows them
  // in submittedAt order and the worst case is two rows with
  // the same number, which the user will see as "第 2 次
  // (12:34) / 第 2 次 (12:35)".
  db.cspQuizSubmissionHistory.append({
    userId,
    classroomId,
    sceneId,
    correctCount,
    totalQuestions: total,
    points,
    maxPoints,
    score,
    answersJson,
  });

  // Re-evaluate "完成打卡" status now that this quiz's score
  // may have flipped quizzesMet from false to true. Idempotent
  // + latch-aware (see /lib/server/csp-completion.ts):
  //   - If criteria are met AND completedAt was not previously
  //     set, this writes a fresh completedAt.
  //   - If already latched, this is a no-op even if the new
  //     score is now < 100% (产品要求: 重做后分数下降, 已完成
  //     状态保持不变).
  // The csp_progress row may not exist yet (student started on
  // a quiz scene without any heartbeat). In that case the
  // reevaluation is read-only and the latch will be set on the
  // next scene-complete call.
  const completion = await reevaluateCompletedAt(userId, classroomId);

  return NextResponse.json({
    ok: true,
    id: row?.id,
    score,
    correctCount,
    totalQuestions: total,
    completion,
  });
}
