import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { getOrCreateVisitorId } from '@/lib/visitor/server';
import { readMistakeSession } from '@/lib/mistake/session/store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mistake-book/add
 *
 * Add a mistake to the visitor's personal "favourites" list.
 * Body: {
 *   problemText: string (required),
 *   userAnswer?: string,
 *   correctAnswer?: string,
 *   imageUrl?: string,
 *   classroomId?: string,
 *   sessionId?: string,
 *   subject?: string,
 *   grade?: string,
 *   title?: string,
 * }
 *
 * The visitor id is read from (or created in) the `sm_visitor_id`
 * cookie. Subsequent calls from the same browser will land in the
 * same collection.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const problemText = typeof body.problemText === 'string' ? body.problemText.trim() : '';
  const mistakeSessionId =
    typeof body.mistakeSessionId === 'string' && body.mistakeSessionId.trim().length > 0
      ? body.mistakeSessionId.trim()
      : null;
  const classroomIdRaw =
    typeof body.classroomId === 'string' && body.classroomId.trim().length > 0
      ? body.classroomId.trim()
      : null;

  // If the caller hands us a mistakeSessionId but no problemText,
  // try to fill in the rest of the fields from the persisted
  // MistakeSession. This is the path used by the floating
  // "加入错题本" button in the classroom view: by the time the
  // visitor reaches that screen, the problem has already been
  // saved to a MistakeSession, so the button only needs to forward
  // the id and the server can hydrate everything else.
  let session: { confirmed?: { problemText: string; studentAnswer?: string; correctAnswer?: string }; imageUrl?: string; classroomId?: string } | null = null;
  if (mistakeSessionId && !problemText) {
    try {
      const row = await readMistakeSession(mistakeSessionId);
      if (row) {
        session = {
          confirmed: row.confirmed
            ? {
                problemText: row.confirmed.problemText,
                studentAnswer: row.confirmed.studentAnswer,
                correctAnswer: row.confirmed.correctAnswer,
              }
            : undefined,
          imageUrl: row.imageUrl,
          classroomId: row.classroomId,
        };
      }
    } catch (err) {
      console.warn('[mistake-book/add] failed to load session', err);
    }
    if (!session?.confirmed) {
      return NextResponse.json(
        { success: false, error: 'mistakeSessionId not found or has no confirmed problem' },
        { status: 404 },
      );
    }
  }

  const resolvedProblemText =
    problemText || session?.confirmed?.problemText || '';
  if (!resolvedProblemText) {
    return NextResponse.json(
      { success: false, error: 'problemText is required' },
      { status: 400 },
    );
  }

  const { visitorId } = await getOrCreateVisitorId();

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

  // Auto-generate a short title from the problem text when the
  // client doesn't provide one. Trim to 30 characters and append
  // an ellipsis if it would otherwise get cut off mid-character.
  const explicitTitle = str(body.title);
  const generatedTitle =
    resolvedProblemText.length <= 30
      ? resolvedProblemText
      : resolvedProblemText.slice(0, 30).trimEnd() + '…';
  const title = explicitTitle ?? generatedTitle;

  // Deduplicate: if the same problemText was already saved by the
  // same visitor in the last 5 minutes, return the existing record
  // instead of inserting a duplicate row. This protects against
  // double-clicks on the "add" button.
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const existing = db.mistakeBook.findFirst({
    where: {
      visitorId,
      problemText: resolvedProblemText,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && existing.createdAt >= fiveMinAgo) {
    return NextResponse.json({
      success: true,
      item: existing,
      deduplicated: true,
    });
  }

  const item = db.mistakeBook.create({
    data: {
      visitorId,
      problemText: resolvedProblemText,
      title,
      imageUrl: str(body.imageUrl) ?? session?.imageUrl,
      userAnswer: str(body.userAnswer) ?? session?.confirmed?.studentAnswer,
      correctAnswer: str(body.correctAnswer) ?? session?.confirmed?.correctAnswer,
      classroomId: classroomIdRaw ?? session?.classroomId,
      sessionId: mistakeSessionId ?? str(body.sessionId) ?? undefined,
      subject: str(body.subject),
      grade: str(body.grade),
    },
  });

  return NextResponse.json({ success: true, item });
}
