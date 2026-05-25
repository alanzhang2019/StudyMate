import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    let { email, password } = await req.json();
    if (!email || !password) {
      return new NextResponse("Missing fields", { status: 400 });
    }
    
    email = email.toLowerCase();

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return new NextResponse("Email already exists", { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: { email, passwordHash },
    });

    return NextResponse.json({ id: user.id, email: user.email });
  } catch (error) {
    console.error("Registration error:", error);
    return new NextResponse("Internal Error: " + (error as Error).message, { status: 500 });
  }
}