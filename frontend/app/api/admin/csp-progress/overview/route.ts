// GET /api/admin/csp-progress/overview
//
// Teacher-side view of every student account's CSP-lecture
// progress. Powers the /admin/csp-progress page. This is a
// read-only aggregation: we don't write anything here, just
// roll up per-user `csp_progress` rows.
//
// "Completed" definition here MUST match /student/home. We
// use `evaluateCompletion()` from /lib/server/csp-completion
// which returns:
//   completed = latched || (progressMet && quizzesMet)
// where latched = `!!csp_progress.completedAt`. That is the
// same predicate the student dashboard uses to split rows
// into "in progress" vs "已打卡". Reading just the
// `completedAt` latch would silently miss classrooms where
// the student has now satisfied both progress + quiz
// conditions but the latch hasn't been written yet (the
// `reevaluateCompletedAt` write path only runs on subsequent
// writes — if the admin loads this page between the student
// hitting the criteria and their next heart-beat, the admin
// would see "in progress" while the student sees "已打卡").
// Consistency is the whole point of a teacher dashboard, so
// we pay the per-row evaluateCompletion cost.
//
// Auth: admin-only. The /api/admin/* prefix is gated by the
// `admin_token` cookie in middleware; we don't re-check here.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listClassroomSummaries } from '@/lib/server/classroom-storage';
import { evaluateCompletion } from '@/lib/server/csp-completion';
import { apiError } from '@/lib/api/error';
import { withAdminAuth } from '@/lib/admin/with-auth';

type StudentRow = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  joinedAt: string;
  // Per-student aggregates computed from csp_progress rows
  // + per-row evaluateCompletion().
  startedClassrooms: number;
  completedClassrooms: number;
  inProgressClassrooms: number;
  watchSeconds: number;
  lastActiveAt: string | null;
  // Most-recent classroom the student touched, with a title
  // resolved from the on-disk summary so the table can show
  // a friendly name instead of an opaque id.
  lastClassroomId: string | null;
  lastClassroomTitle: string | null;
};

export const GET = withAdminAuth(async () => {
  try {
    // 1. List every user with `role = 'student'`. The shim
    //    supports `where` filters; we just need to be explicit
    //    that role IS NULL is treated as 'parent' by app code
    //    (auth.ts), so a NULL role won't accidentally show up
    //    here.
    const students = (db as any).user.findMany({
      where: { role: 'student' },
      orderBy: { createdAt: 'desc' },
    }) as Array<{
      id: string;
      name: string | null;
      email: string;
      role: string | null;
      createdAt: string;
    }>;

    if (students.length === 0) {
      const summaries = await listClassroomSummaries('csp-lecture');
      return NextResponse.json({
        students: [],
        summary: {
          totalStudents: 0,
          activeStudents: 0,
          totalCompleted: 0,
          totalWatchSeconds: 0,
          totalClassrooms: summaries.length,
        },
      });
    }

    // 2. Pull every csp_progress row in one query. We do
    //    the per-user aggregation in JS rather than SQL
    //    because the GROUP BY would lose the "last active
    //    classroom" detail we want in the table.
    const progressRows = db.cspProgress.findAll() as Array<{
      userId: string;
      classroomId: string;
      coveragePct: number;
      watchSeconds: number;
      lastViewedAt: string | null;
      completedAt: string | null;
      updatedAt: string;
    }>;

    // Bucket progress rows by userId.
    const byUser = new Map<string, typeof progressRows>();
    for (const r of progressRows) {
      const arr = byUser.get(r.userId);
      if (arr) {
        arr.push(r);
      } else {
        byUser.set(r.userId, [r]);
      }
    }

    // 3. Resolve classroom id → title for the "last viewed"
    //    column. We only need titles for the classrooms that
    //    actually appear in someone's `lastViewed*` field, so
    //    pull the full summary list once and look up by id.
    const summaries = await listClassroomSummaries('csp-lecture');
    const titleById = new Map(summaries.map((s) => [s.id, s.title]));

    // 4. Build the per-student rows. For each row we call
    //    evaluateCompletion(userId, classroomId) so the
    //    "completed" boolean is exactly what /student/home
    //    shows. evaluateCompletion is read-only (no DB
    //    writes), just does one readClassroom + one query on
    //    csp_quiz_submissions per call. With the typical
    //    cohort (≤50 students × ≤5 classrooms each) this is
    //    well under one second of total work — no need for
    //    a bulk optimisation. If that scale ever changes,
    //    add a `evaluateCompletionsBulk` that dedupes
    //    readClassroom across (userId, classroomId) pairs.
    const out: StudentRow[] = await Promise.all(
      students.map(async (u) => {
        const userProgress = byUser.get(u.id) ?? [];
        let started = 0;
        let completed = 0;
        let inProgress = 0;
        let watchSeconds = 0;
        let lastActiveAt: string | null = null;
        let lastClassroomId: string | null = null;
        let lastClassroomTitle: string | null = null;
        let lastTs = -1;

        // Evaluate completion for every (user, classroom) pair
        // in parallel; the loop's sequential aggregation then
        // consumes the results in order.
        const completionResults = await Promise.all(
          userProgress.map((r) =>
            evaluateCompletion(u.id, r.classroomId).then(
              (c) => ({ row: r, completion: c }),
            ),
          ),
        );

        for (const { row: r, completion } of completionResults) {
          started += 1;
          watchSeconds += Number(r.watchSeconds) || 0;
          if (completion.completed) {
            completed += 1;
          } else {
            inProgress += 1;
          }
          // "Last active" = max(updatedAt) across all of the
          // student's progress rows. We use updatedAt (not
          // lastViewedAt) because heartbeats bump updatedAt too
          // and we want a meaningful "I was here" signal.
          const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
          if (ts > lastTs) {
            lastTs = ts;
            lastActiveAt = r.updatedAt ?? null;
            lastClassroomId = r.classroomId;
            lastClassroomTitle = titleById.get(r.classroomId) ?? null;
          }
        }
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          joinedAt: u.createdAt,
          startedClassrooms: started,
          completedClassrooms: completed,
          inProgressClassrooms: inProgress,
          watchSeconds,
          lastActiveAt,
          lastClassroomId,
          lastClassroomTitle,
        };
      }),
    );

    // 5. Roll up the page-level summary cards.
    const totalClassrooms = summaries.length;
    const totalCompleted = out.reduce(
      (s, st) => s + st.completedClassrooms,
      0,
    );
    const totalWatchSeconds = out.reduce(
      (s, st) => s + st.watchSeconds,
      0,
    );
    const activeStudents = out.filter(
      (s) => s.startedClassrooms > 0,
    ).length;

    return NextResponse.json({
      students: out,
      summary: {
        totalStudents: out.length,
        activeStudents,
        totalCompleted,
        totalWatchSeconds,
        totalClassrooms,
      },
    });
  } catch (err) {
    console.error('[admin/csp-progress/overview] failed:', err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'failed to load student progress overview',
      err instanceof Error ? err.message : String(err),
    );
  }
});
