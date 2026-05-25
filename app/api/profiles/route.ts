import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const profiles = await db.studentProfile.findMany({
      where: { parentId: session.user.id },
      orderBy: { createdAt: 'asc' }
    });
    
    return NextResponse.json(profiles);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { name, grade, teachingStyle, ttsVoice } = await req.json();
    if (!name || !grade || !teachingStyle) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    const profile = await db.studentProfile.create({
      data: {
        parentId: session.user.id,
        name,
        grade: parseInt(grade, 10),
        teachingStyle,
        ttsVoice: ttsVoice || null,
      }
    });

    return NextResponse.json(profile);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { id, name, grade, teachingStyle, ttsVoice } = await req.json();
    if (!id || !name || !grade || !teachingStyle) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    // Verify ownership
    const existing = await db.studentProfile.findUnique({ where: { id } });
    if (!existing || existing.parentId !== session.user.id) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const profile = await db.studentProfile.update({
      where: { id },
      data: {
        name,
        grade: parseInt(grade, 10),
        teachingStyle,
        ttsVoice: ttsVoice || null,
      }
    });

    return NextResponse.json(profile);
  } catch (error) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
