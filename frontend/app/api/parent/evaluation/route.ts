import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { studentId } = await req.json();
    const mistakes = await db.mistakeRecord.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (!mistakes.length) return NextResponse.json({ summary: "目前还没有足够的错题数据来进行分析。" });

    const summary = `根据最近的 ${mistakes.length} 道错题记录，孩子在计算方面存在一些常见错误。已掌握 ${mistakes.filter((m: any) => m.isResolved).length} 题。建议：多进行基础四则运算练习，巩固对题目题干的理解。`;

    return NextResponse.json({ summary });
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
