import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiError } from '@/lib/api/error';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const GOAL_TARGETS: Record<string, number[]> = {
  practice_questions: [5, 10, 15],
  perfect_quiz_scenes: [1, 2, 3],
};

async function requireStudent() {
  const session = await auth();
  if (!session?.user?.id) return { error: apiError('Not signed in', 401) };
  const role = (session.user as any).role ?? 'student';
  if (role !== 'student') return { error: apiError('Student account required', 403) };
  return { userId: session.user.id };
}

function withProgress(goal: any) {
  if (!goal) return { goal: null, progress: 0 };
  return {
    goal: {
      goalType: goal.goalType,
      target: Number(goal.target),
      updatedAt: goal.updatedAt,
    },
    progress: db.cspQuizSubmissionHistory.weeklyGoalProgress(
      goal.userId,
      goal.goalType,
    ),
  };
}

export async function GET() {
  const access = await requireStudent();
  if ('error' in access) return access.error;
  const goal = db.studentLearningGoal.findByUser(access.userId);
  return NextResponse.json(withProgress(goal));
}

export async function PUT(req: NextRequest) {
  const access = await requireStudent();
  if ('error' in access) return access.error;

  let body: { goalType?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const goalType = typeof body.goalType === 'string' ? body.goalType : '';
  const target = Number(body.target);
  if (
    !GOAL_TARGETS[goalType] ||
    !Number.isInteger(target) ||
    !GOAL_TARGETS[goalType].includes(target)
  ) {
    return apiError('Choose a supported learning goal and target', 400);
  }

  const goal = db.studentLearningGoal.upsert({
    userId: access.userId,
    goalType,
    target,
  });
  return NextResponse.json(withProgress(goal));
}
