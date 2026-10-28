import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { notifyHlGrowth } from "@/lib/hl-growth";

const logger = createLogger('api:error-items:mastery');

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    try {
        let user;
        if (session?.user?.email) {
            user = await prisma.user.findUnique({
                where: { email: session.user.email },
            });
        }

        if (!user) {
            return unauthorized("Authentication required");
        }

        const { masteryLevel } = await req.json();

        // Verify ownership before update
        const existingItem = await prisma.errorItem.findUnique({
            where: { id },
            select: { userId: true, masteryLevel: true },
        });

        if (!existingItem) {
            return NextResponse.json({ message: "Item not found" }, { status: 404 });
        }

        if (existingItem.userId !== user.id) {
            return NextResponse.json({ message: "Not authorized to update this item" }, { status: 403 });
        }

        const errorItem = await prisma.errorItem.update({
            where: {
                id,
            },
            data: {
                masteryLevel,
            },
        });

        // ★ 批次263（方案 B）：订正完成（0 → >0）→ 通知 hl-platform 加成长值。
        //   只在**第一次**订正时发（之后重复点「已掌握」不再加），ref 用错题 id 幂等。
        //   没配 HL_PLATFORM_BASE / INTEGRATION_API_KEY 就静默跳过 —— 订正本身不受影响。
        if ((existingItem.masteryLevel || 0) <= 0 && Number(masteryLevel) > 0) {
            notifyHlGrowth(user.email, 'wn_fix', 'wn:' + id);
        }

        return NextResponse.json(errorItem);
    } catch (error) {
        logger.error({ error }, 'Error updating item');
        return internalError("Failed to update error item");
    }
}
