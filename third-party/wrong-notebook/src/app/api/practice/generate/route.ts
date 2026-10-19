import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { getAIService } from "@/lib/ai";
import { notFound, internalError, unauthorized } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:practice:generate');

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return unauthorized("Authentication required");
    }

    try {
        const { errorItemId, language, difficulty } = await req.json();

        const errorItemWithSubject = await prisma.errorItem.findFirst({
            where: { id: errorItemId, user: { email: session.user.email || '' } },
            include: { subject: true }
        });

        if (!errorItemWithSubject) {
            return notFound("Item not found");
        }

        let tags: string[] = [];
        try {
            tags = JSON.parse(errorItemWithSubject.knowledgePoints || "[]");
        } catch (e) {
            tags = [];
        }

        const storedImage = errorItemWithSubject.originalImageUrl || '';
        const originalImageUrl = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(storedImage)
            ? storedImage : undefined;
        if (storedImage && !originalImageUrl) {
            return NextResponse.json({ message: '原题图片格式不受支持，请重新录入原题图片' }, { status: 422 });
        }
        if (originalImageUrl && originalImageUrl.length > 14 * 1024 * 1024) {
            return NextResponse.json({ message: '原题图片超过 10MB，请重新裁剪后录入' }, { status: 422 });
        }
        const aiService = getAIService();
        const similarQuestion = await aiService.generateSimilarQuestion(
            errorItemWithSubject.questionText || "",
            tags,
            language,
            difficulty || 'medium',
            errorItemWithSubject.gradeSemester,
            originalImageUrl
        );

        // 模型若仍输出“如图”却没有可用配图，拒绝给学生一题无法作答的练习。
        if ((!originalImageUrl || !similarQuestion.reuseOriginalImage) &&
            (similarQuestion.requiresImage || /如图|见图|下图|图中|as shown|in the figure/i.test(similarQuestion.questionText))) {
            return NextResponse.json({ message: '这道变式题缺少必要配图，请重新生成' }, { status: 422 });
        }

        // Inject the subject from the database with type safety
        const validSubjects = ["数学", "物理", "化学", "生物", "英语", "语文", "历史", "地理", "政治", "其他"] as const;
        const subjectName = errorItemWithSubject.subject?.name || "其他";
        similarQuestion.subject = validSubjects.includes(subjectName as any) ? subjectName as typeof validSubjects[number] : "其他";

        // 原题图仅在模型确认图形和新题条件完全一致时才作为新题配图。
        return NextResponse.json({
            ...similarQuestion,
            questionImageUrl: similarQuestion.reuseOriginalImage ? originalImageUrl : undefined,
        });
    } catch (error) {
        logger.error({ error }, 'Error generating practice');
        const errorMessage = error instanceof Error ? error.message : "Failed to generate practice question";
        return internalError(errorMessage);
    }
}
