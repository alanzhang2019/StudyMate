import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiError } from '@/lib/api/error';
import { loadCspMistakeBook } from '@/lib/server/csp-mistake-book';

// GET /api/mistake-book/csp
//
// 返回当前用户在所有 CSP 课件 / 真题中做错的题目，按课件标题
// 分组。逻辑由 lib/server/csp-mistake-book.loadCspMistakeBook
// 提供（与 /student/csp-mistakes 页面共享）。
//
// 响应：参见 loadCspMistakeBook 的返回类型。

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('Not signed in', 401);
  }
  const userId = session.user.id;
  const book = await loadCspMistakeBook(userId);
  return NextResponse.json(book);
}
