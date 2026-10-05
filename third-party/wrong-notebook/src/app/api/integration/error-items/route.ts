/**
 * 错题本 → 外部系统（hl-platform）的**只读**接口
 *
 * 为什么需要它：
 *   现有的 /api/error-items/list 只认 NextAuth cookie（浏览器会话），
 *   而 hl-platform 是**服务端**调用，拿不到用户浏览器里的 cookie。
 *   所以这里另开一条 API Key 保护的服务间通道。
 *
 * 鉴权：请求头 x-api-key 必须等于环境变量 INTEGRATION_API_KEY。
 *   ★ key 未配置 => 一律拒绝（不写成 `|| ''` 后静默放行，那样等于没鉴权）。
 *
 * 安全：只返回**指定 email** 的错题，绝不接受任意 userId。
 *   email 由调用方（hl-platform）从自己的绑定表里取，不从前端透传。
 *
 * 只读：本接口不做任何写操作。
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createErrorResponse, ErrorCode } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/lib/constants/pagination";

const logger = createLogger('api:integration:error-items');

export async function GET(req: Request) {
    // ── 1. 鉴权 ────────────────────────────────────────────────
    const expectedApiKey = process.env.INTEGRATION_API_KEY;
    if (!expectedApiKey) {
        logger.error('INTEGRATION_API_KEY is not configured; refusing all requests');
        return createErrorResponse(
            '服务未配置集成密钥，接口不可用',
            503,
            ErrorCode.INTERNAL_ERROR,
            'INTEGRATION_API_KEY not configured'
        );
    }

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        logger.warn('Missing API key');
        return createErrorResponse('未提供API密钥', 401, ErrorCode.UNAUTHORIZED, 'Missing API key');
    }
    if (apiKey !== expectedApiKey) {
        logger.warn('Invalid API key provided');
        return createErrorResponse('API密钥无效', 401, ErrorCode.UNAUTHORIZED, 'Invalid API key');
    }

    // ── 2. 参数 ────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get('email') || '').trim();
    const sinceRaw = searchParams.get('since');

    if (!email) {
        return createErrorResponse(
            '缺少 email 参数',
            400,
            ErrorCode.MISSING_REQUIRED_FIELD,
            'email is required'
        );
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
        MAX_PAGE_SIZE,
        Math.max(
            MIN_PAGE_SIZE,
            parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) ||
                DEFAULT_PAGE_SIZE
        )
    );

    try {
        // ── 3. 定位用户（只按 email，不接受 userId） ─────────────
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            logger.warn({ email }, 'User not found');
            return createErrorResponse(
                '该邮箱在错题本中不存在',
                404,
                ErrorCode.USER_NOT_FOUND,
                `No user with email ${email}`
            );
        }

        // ── 4. 查询条件 ──────────────────────────────────────────
        const whereClause: Prisma.ErrorItemWhereInput = { userId: user.id };

        if (sinceRaw) {
            const since = new Date(sinceRaw);
            if (!isNaN(since.getTime())) {
                whereClause.createdAt = { gt: since };
            }
        }

        const total = await prisma.errorItem.count({ where: whereClause });

        const items = await prisma.errorItem.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                subject: { select: { id: true, name: true } },
                tags: { select: { id: true, name: true, subject: true, code: true } },
            },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        // ── 5. 只透出需要的字段（不整个实体序列化出去） ──────────
        const shaped = items.map((it) => ({
            id: it.id,
            subject: it.subject?.name ?? null,
            questionText: it.questionText,
            answerText: it.answerText,
            analysis: it.analysis,
            wrongAnswerText: it.wrongAnswerText,
            mistakeAnalysis: it.mistakeAnalysis,
            mistakeStatus: it.mistakeStatus,
            ocrText: it.ocrText,
            source: it.source,
            errorType: it.errorType,
            masteryLevel: it.masteryLevel,
            gradeSemester: it.gradeSemester,
            userNotes: it.userNotes,
            tags: it.tags.map((t) => t.name),
            createdAt: it.createdAt,
        }));

        logger.info({ email, total, page, pageSize }, 'Integration error-items fetched');

        return NextResponse.json({
            ok: true,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            items: shaped,
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch error items for integration');
        return createErrorResponse('获取错题失败', 500, ErrorCode.INTERNAL_ERROR);
    }
}
