import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin/with-auth';
import {
  collectWorkAssets,
  formatBytes,
} from '@/lib/server/camp-work-files';

// GET /api/admin/camp/works/:id/files
// 列出该作品在服务器上真实存在的源文件（HTML / 封面 / 视频 / 过程图）及大小。
// 只返回序号、标签、文件名、大小，不返回服务器绝对路径。
// 与审核状态无关：待审核作品的源文件管理员同样要能取到。
export const GET = withAdminAuth(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      if (!/^[a-zA-Z0-9-]+$/.test(id)) {
        return NextResponse.json(
          { success: false, error: '非法作品ID' },
          { status: 400 },
        );
      }

      const assets = collectWorkAssets(id);
      return NextResponse.json({
        success: true,
        data: {
          files: assets.map((a, i) => ({
            i,
            kind: a.kind,
            label: a.label,
            fileName: a.fileName,
            size: a.size,
            sizeText: formatBytes(a.size),
          })),
        },
      });
    } catch (e: any) {
      console.error('[admin/camp/works/:id/files] error:', e);
      return NextResponse.json(
        { success: false, error: `读取失败：${e?.message || '未知错误'}` },
        { status: 500 },
      );
    }
  },
);
