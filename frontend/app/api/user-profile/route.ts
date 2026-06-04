import { NextResponse } from 'next/server';
import { readUserProfile, writeUserProfile } from '@/lib/server/user-profile-storage';

export async function GET() {
  const profile = await readUserProfile();
  if (!profile) {
    return NextResponse.json({ success: true, data: { isInitialized: false } });
  }
  return NextResponse.json({ success: true, data: profile });
}

export async function POST(request: Request) {
  const body = await request.json();
  const data = {
    studentName: body.studentName || '',
    grade: body.grade || 4,
    teachingStyle: body.teachingStyle || '',
    isInitialized: true,
  };
  await writeUserProfile(data);
  return NextResponse.json({ success: true, data });
}
