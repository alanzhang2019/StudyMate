import { NextResponse } from "next/server";
import { getAIService } from "@/lib/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGradeNumber } from "@/lib/knowledge-tags";
import { calculateGrade } from "@/lib/grade-calculator";
import { prisma } from "@/lib/prisma";
import { badRequest, internalError, createErrorResponse, ErrorCode } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { pickPaperResult } from "@/lib/ai/paper-rules.mjs";

const logger = createLogger('api:analyze-paper');

/**
 * 拍整张卷子 —— 单页识别。
 * ============================================================
 * 用户诉求（原话）：「错题本这里应该增加一个拍卷子功能，自动将卷子中的错题和空白题都归入
 * 错题本，但是错题和空白题目不直接批改答案，避免学生利用这个功能抄作业」。
 *
 * ★★★ 这个接口**永远不返回答案**，三层保证：
 *   ① 提示词要求模型不许写答案、错因只能从 7 个枚举词选（prompts.ts）；
 *   ② provider 里 `buildPaperResult()` 白名单重建（paper-rules.mjs）；
 *   ③ 这里再 `pickPaperResult()` 拼一遍 —— 只搬 PAPER_ITEM_FIELDS 里的键。
 *   注意 ③ 只搬键、**不重新判定**（重新判会因缺 teacherMark/modelVerdict 把题全误杀）。
 *
 * ★ 一页一次请求，由前端串行调用：整卷 6 页一次请求的话，6 张图 + 长提示词的
 *   token 会让上游又慢又容易被截断；分页请求还能让用户在"第 2 页"就看到部分结果。
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        logger.warn('Unauthorized access attempt');
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        let { imageBase64, mimeType = 'image/jpeg', language = 'zh', subjectId, pageNo = 1 } = body;

        if (!imageBase64) {
            logger.warn('Missing image data');
            return badRequest("Missing image data");
        }

        // 兼容 data URL
        if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
            const m = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (m) { mimeType = m[1]; imageBase64 = m[2]; }
        }

        let userGrade: 7 | 8 | 9 | 10 | 11 | 12 | null = null;
        let userGradeSemester: string | null = null;
        let subjectName: string | null = null;

        if (session?.user?.email) {
            const user = await prisma.user.findUnique({
                where: { email: session.user.email },
                select: { educationStage: true, enrollmentYear: true },
            });
            if (user) {
                userGrade = calculateGradeNumber(user.educationStage, user.enrollmentYear);
                if (user.educationStage && user.enrollmentYear) {
                    userGradeSemester = calculateGrade(user.educationStage, user.enrollmentYear, new Date(), 'zh');
                }
            }
        }

        if (subjectId) {
            const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
            subjectName = subject?.name ?? null;
        }

        const aiService = getAIService();
        if (typeof aiService.analyzePaperPage !== 'function') {
            // ★ 明确报错：静默降级成"没识别到错题"会让学生以为卷子上真没有错题
            logger.error({ provider: process.env.AI_PROVIDER || 'unknown' }, 'analyzePaperPage not implemented by current provider');
            return createErrorResponse('AI_PAPER_UNSUPPORTED', 501, ErrorCode.AI_ERROR);
        }

        logger.info({ pageNo, subject: subjectName, imageSize: imageBase64.length }, 'Paper page analyze start');

        const result = await aiService.analyzePaperPage(
            imageBase64,
            mimeType,
            language === 'en' ? 'en' : 'zh',
            Number(pageNo) || 1,
            subjectName,
            userGradeSemester
        );

        // ★ 出关：只搬白名单字段（第三层）
        const safe = pickPaperResult(result);

        logger.info({
            pageNo,
            items: safe.items.length,
            stats: safe.stats,
            grade: userGrade,
        }, 'Paper page analyze done');

        return NextResponse.json(safe);
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ error: msg }, 'Paper page analyze failed');

        if (msg.includes('AI_AUTH_ERROR')) return createErrorResponse('AI_AUTH_ERROR', 500, ErrorCode.AI_ERROR);
        if (msg.includes('AI_CONNECTION_FAILED')) return createErrorResponse('AI_CONNECTION_FAILED', 500, ErrorCode.AI_ERROR);
        if (msg.includes('AI_RESPONSE_ERROR')) return createErrorResponse('AI_RESPONSE_ERROR', 500, ErrorCode.AI_ERROR);
        return internalError('Failed to analyze paper page');
    }
}
