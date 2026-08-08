import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        createdAt: true,
        // 必须传 `studentProfiles`，因为 lib/db.ts PrismaCompatClient
        // 的 user.findMany 只识别 `_count.select.studentProfiles`，
        // 然后把结果改写为 `{ _count: { profiles: <n> } }` 暴露
        // 给调用方。用 `profiles` 会让 _count 变 undefined，
        // 触发 `u._count.profiles` 的 TypeError 把整页崩掉。
        _count: {
          select: { studentProfiles: true },
        },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
