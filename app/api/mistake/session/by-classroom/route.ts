import { type NextRequest } from 'next/server';

import { findMistakeSessionByClassroomId } from '@/lib/mistake/session/store';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export async function GET(request: NextRequest) {
  const classroomId = request.nextUrl.searchParams.get('classroomId')?.trim();

  if (!classroomId) {
    return apiError('INVALID_REQUEST', 400, 'classroomId 不能为空');
  }

  const session = await findMistakeSessionByClassroomId(classroomId);

  if (!session) {
    return apiError('INVALID_REQUEST', 404, '未找到对应错题会话');
  }

  return apiSuccess({ session });
}
