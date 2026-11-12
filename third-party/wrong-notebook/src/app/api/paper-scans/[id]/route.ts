import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, forbidden, notFound, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:paper-scans:id');

/**
 * 取一张卷子的整页原图（详情页「查看原卷页」用）。
 *
 * ★ 只返回页图，**不返回**任何题目/答案字段 —— 这个接口的存在理由是"学生想回看自己
 *   当时的笔迹"，不是让他从这里再捞一遍内容。
 * ★ 必须校验归属：卷子里是别人孩子的试卷照片。
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        const user = session?.user?.email
            ? await prisma.user.findUnique({ where: { email: session.user.email } })
            : null;
        if (!user) return unauthorized("Authentication required");

        const scan = await prisma.paperScan.findUnique({
            where: { id },
            select: {
                id: true,
                userId: true,
                title: true,
                pageCount: true,
                gradeSemester: true,
                paperLevel: true,
                createdAt: true,
                pages: {
                    select: { pageNo: true, imageUrl: true, width: true, height: true },
                    orderBy: { pageNo: 'asc' },
                },
            },
        });

        if (!scan) return notFound("Paper scan not found");
        if (scan.userId !== user.id) return forbidden("Not authorized to access this scan");

        return NextResponse.json(scan);
    } catch (error) {
        logger.error({ error }, 'Error fetching paper scan');
        return internalError("Failed to fetch paper scan");
    }
}

/**
 * 删掉一张卷子。
 * ★ 级联是**手工**做的（ErrorItem.paperScanId 没有外键关系，见 schema 注释）：
 *   删卷子时把这张卷子收进来的错题一并删掉 —— 否则会留下一堆"指不回原卷"的孤儿题，
 *   而且学生以为删了卷子题目也该没了。
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        const user = session?.user?.email
            ? await prisma.user.findUnique({ where: { email: session.user.email } })
            : null;
        if (!user) return unauthorized("Authentication required");

        const scan = await prisma.paperScan.findUnique({ where: { id }, select: { id: true, userId: true } });
        if (!scan) return notFound("Paper scan not found");
        if (scan.userId !== user.id) return forbidden("Not authorized to access this scan");

        const del = await prisma.$transaction(async (tx) => {
            const items = await tx.errorItem.deleteMany({ where: { paperScanId: id, userId: user.id } });
            await tx.paperScan.delete({ where: { id } }); // pages 由 FK 级联删除
            return items.count;
        }, { maxWait: 5000, timeout: 20000 });

        logger.info({ scanId: id, deletedItems: del }, 'Paper scan deleted');
        return NextResponse.json({ ok: true, deletedItems: del });
    } catch (error) {
        logger.error({ error }, 'Error deleting paper scan');
        return internalError("Failed to delete paper scan");
    }
}
