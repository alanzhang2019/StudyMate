import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { notifyHlGrowth } from "@/lib/hl-growth";

const logger = createLogger('api:practice:record');

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    try {
        const { subject, difficulty, isCorrect } = await req.json();

        // @ts-ignore
        const userId = session.user.id;

        const record = await prisma.practiceRecord.create({
            data: {
                userId,
                subject,
                difficulty,
                isCorrect,
            },
        });

        // ★ 批次263（方案 B）：举一反三答对 → 通知 hl-platform 加成长值。
        //   ref 用练习记录 id 幂等；失败静默，不影响练习本身。
        // ★ 批次266：成长值**按难度分档**（用户 2026-10-27 拍板 2/4/8/10）。
        //   这里只把 difficulty 原样带过去，分值由 hl 侧唯一一份档位表算。
        if (isCorrect) {
            notifyHlGrowth(session.user.email, 'wn_transfer', 'wnp:' + record.id, { difficulty });
        }

        return NextResponse.json(record);
    } catch (error) {
        logger.error({ error }, 'Error saving practice record');
        return internalError("Failed to save record");
    }
}
