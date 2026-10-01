import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db';
import { getOrCreateVisitorId, getVisitorId } from '@/lib/visitor/server';
import { getClientIp } from '@/lib/integrations/rate-limit';
import {
  cleanBody,
  cleanName,
  commentRateLimited,
  listComments,
  ratingSummary,
  workIsDiscussable,
  COMMENT_MAX_LEN,
} from '@/lib/server/camp-discussion';

/**
 * GET  /api/camp/works/:id/comments —— 拉取讨论区（评论 + 评分概览），公开
 * POST /api/camp/works/:id/comments —— 发表评论/回复，公开、匿名、限流
 *
 * 匿名模型：昵称随手填（缺省「匿名访客」），身份只认 httpOnly cookie
 * sm_visitor_id。该 id 只用于「删自己的评论」和评分去重，不对外返回。
 */

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    if (!workIsDiscussable(id)) {
      return NextResponse.json(
        { success: false, error: '作品不存在或未公开' },
        { status: 404 },
      );
    }
    const visitorId = await getVisitorId();
    return NextResponse.json({
      success: true,
      data: {
        comments: listComments(id, visitorId),
        rating: ratingSummary(id, visitorId),
      },
    });
  } catch (error) {
    console.error('[camp/works/:id/comments GET] error:', error);
    return NextResponse.json({ success: false, error: '获取讨论失败' }, { status: 500 });
  }
};

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    if (!workIsDiscussable(id)) {
      return NextResponse.json(
        { success: false, error: '作品不存在或未公开' },
        { status: 404 },
      );
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
    }

    const body = cleanBody(payload.body);
    if (!body) {
      return NextResponse.json(
        { success: false, error: '说点什么吧，内容不能为空' },
        { status: 400 },
      );
    }

    // 回复目标：必须是同一作品下、已公开的顶层评论。
    // 非法 parentId 直接降级为顶层评论（不报错），避免客户端传错就整条失败。
    let parentId: string | null = null;
    const rawParent = typeof payload.parentId === 'string' ? payload.parentId.trim() : '';
    if (rawParent) {
      const parent = getDb()
        .prepare(
          `SELECT id, parentId FROM camp_work_comments
           WHERE id = ? AND workId = ? AND status = 'visible' LIMIT 1`,
        )
        .get(rawParent, id) as { id: string; parentId: string | null } | undefined;
      // 只允许一层回复：对回复的回复挂到同一个顶层评论下，避免无限嵌套 UI 崩坏
      if (parent) parentId = parent.parentId || parent.id;
    }

    const { visitorId } = await getOrCreateVisitorId();
    const ip = getClientIp(req.headers);

    // 限流：按访客 + IP 双维度，任一超限即拒。
    if (commentRateLimited(`v:${visitorId}`) || commentRateLimited(`ip:${ip}`)) {
      return NextResponse.json(
        { success: false, error: '发言有点快，休息一下再试试' },
        { status: 429 },
      );
    }

    const commentId = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO camp_work_comments
           (id, workId, parentId, authorName, authorRole, authorVisitorId, body, status)
         VALUES (?, ?, ?, ?, 'guest', ?, ?, 'visible')`,
      )
      .run(commentId, id, parentId, cleanName(payload.authorName), visitorId, body);

    return NextResponse.json({
      success: true,
      data: {
        comments: listComments(id, visitorId),
        rating: ratingSummary(id, visitorId),
        maxLen: COMMENT_MAX_LEN,
      },
    });
  } catch (error) {
    console.error('[camp/works/:id/comments POST] error:', error);
    return NextResponse.json({ success: false, error: '发表失败，请稍后再试' }, { status: 500 });
  }
};
