import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api/error';
import { listClassroomSummaries } from '@/lib/server/classroom-storage';
import { evaluateCompletion } from '@/lib/server/csp-completion';

// GET /api/csp-progress/overview
// Returns the current user's progress across ALL CSP classrooms.
// Powers the /student/home dashboard. Each entry is enriched
// with the classroom's title, total scene count, the
// "完成打卡" completion detail (progressMet / quizzesMet /
// failedQuizScenes / reasons), and the per-classroom
// completedAt timestamp.
//
// Completion semantic (see /lib/server/csp-completion.ts):
//   completed = latched || (coveragePct >= 0.8 AND every quiz
//   scene has a 100%-correct submission). The latch is
//   `!!csp_progress.completedAt` — once set, never cleared.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;
  const rows = db.cspProgress.findManyByUser(userId);

  // Build a map of classroomId -> { title, sceneCount } using
  // listClassroomSummaries. We fetch the full list once and
  // index it by id — much cheaper than reading each classroom
  // file separately (which is what an early draft did).
  const summaries = await listClassroomSummaries('csp-lecture');
  const summaryById = new Map(summaries.map((s) => [s.id, s]));

  // For each row, also pull the full completion detail. The
  // evaluateCompletion helper internally calls readClassroom
  // (one JSON file read per classroom). With a typical 10–20
  // classrooms per student this is well within the OS page
  // cache, so we don't pre-bulk the file reads. If the
  // teacher-side dashboard ever needs this at scale, add a
  // `evaluateCompletionsBulk` that takes a list of classroomIds
  // and dedupes the readClassroom calls.
  const enriched = await Promise.all(
    rows.map(async (r) => {
      const summary = summaryById.get(r.classroomId);
      const title = summary?.title ?? r.classroomId;
      const totalScenes = summary?.sceneCount ?? r.totalScenes;
      const completion = await evaluateCompletion(userId, r.classroomId);
      return {
        classroomId: r.classroomId,
        title,
        totalScenes,
        watchSeconds: r.watchSeconds,
        coveragePct: r.coveragePct,
        completed: completion.completed,
        latched: completion.latched,
        progressMet: completion.progressMet,
        quizzesMet: completion.quizzesMet,
        quizScenesCount: completion.quizScenesCount,
        passedQuizCount: completion.passedQuizCount,
        failedQuizScenes: completion.failedQuizScenes,
        reasons: completion.reasons,
        lastViewedSceneId: r.lastViewedSceneId,
        lastViewedAt: r.lastViewedAt,
        completedAt: r.completedAt,
        updatedAt: r.updatedAt,
      };
    }),
  );

  // Sort: in-progress first (most recently updated), then
  // completed. Untouched classrooms go in `notStarted` below.
  enriched.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });

  // "未开始" list: every CSP classroom the user has never
  // opened. We diff the on-disk summary list against the
  // user's progress rows.
  const startedIds = new Set(rows.map((r) => r.classroomId));
  const notStarted = summaries
    .filter((s) => !startedIds.has(s.id))
    .map((s) => ({
      classroomId: s.id,
      title: s.title,
      totalScenes: s.sceneCount,
    }));
  notStarted.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'));

  return NextResponse.json({
    inProgress: enriched.filter((e) => !e.completed),
    completed: enriched.filter((e) => e.completed),
    notStarted,
    summary: {
      total: summaries.length,
      started: rows.length,
      completed: enriched.filter((e) => e.completed).length,
      inProgress: enriched.filter((e) => !e.completed).length,
    },
  });
}
