import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// POST /api/auth/register
//
// Body: {
//   email: string,
//   password: string,
//   name?: string,                    // optional; falls back to "邮箱用户<4位>"
//   role?: 'student' | 'parent'       // optional; defaults to 'parent' for backward compat
// }
//
// We accept `role` so the /csp-lecture public page can create
// 'student' accounts in one step. We deliberately do NOT
// accept 'admin' here — admin accounts are created out of band
// (the admin UI on /admin/login uses a separate JWT-based
// auth, not NextAuth, so it never goes through this endpoint).
//
// Backward compat: callers that don't send `role` (e.g. the
// existing parent signup flow) default to 'parent'. The
// `name` field is optional; if absent we generate a short
// display name from the email so /student/home has something
// human to show in greeting text.
export async function POST(req: Request) {
  try {
    let {
      email,
      password,
      name,
      role,
    }: {
      email?: string;
      password?: string;
      name?: string;
      role?: 'student' | 'parent';
    } = await req.json();
    if (!email || !password) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    email = email.toLowerCase();
    // Whitelist role to the two allowed values; anything else
    // falls back to 'parent'. This makes the API tolerant of
    // bad/missing role even if a future caller forgets to set it.
    const safeRole: 'student' | 'parent' = role === 'student' ? 'student' : 'parent';
    // Sanitise name: trim + cap to 40 chars + strip control chars.
    const safeName =
      (typeof name === 'string' ? name.trim().slice(0, 40).replace(/[\u0000-\u001f\u007f]/g, '') : '') ||
      // Fallback: take the email's local part as a friendly
      // default, e.g. "zhang.san@school.cn" -> "zhang.san".
      email.split('@')[0].slice(0, 40);

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return new NextResponse("Email already exists", { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name: safeName,
        role: safeRole,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: (user as any).name,
      role: (user as any).role,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return new NextResponse("Internal Error: " + (error as Error).message, { status: 500 });
  }
}
