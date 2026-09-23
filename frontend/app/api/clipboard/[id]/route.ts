import { NextRequest, NextResponse } from 'next/server';
import { unlinkSync, existsSync } from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/clipboard/[id] —— 删除某条剪贴项（含落盘文件）。
// 公开场景：id 为不可猜测的 UUID，匿名即可删除，便于贴方便清理自己的内容。
const DATA_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate';

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/.test(id)) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    const row = getDb().prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id) as any;
    if (!row) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });
    }
    if (row.filePath) {
      try {
        const abs = path.join(DATA_DIR, row.filePath);
        if (existsSync(abs)) unlinkSync(abs);
      } catch {
        // 文件不存在也不影响删除数据库记录
      }
    }
    getDb().prepare('DELETE FROM clipboard_items WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[clipboard DELETE] error:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
};
