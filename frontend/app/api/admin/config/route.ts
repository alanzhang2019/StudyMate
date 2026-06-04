import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const config = await db.systemConfig.findUnique({ where: { key: 'default_tts_config' } });
  return NextResponse.json(config ? JSON.parse(config.value) : { provider: 'siliconflow-tts', voice: 'FunAudioLLM/CosyVoice2-0.5B:alex' });
}

export async function POST(req: Request) {
  const body = await req.json();
  await db.systemConfig.upsert({
    where: { key: 'default_tts_config' },
    update: { value: JSON.stringify(body) },
    create: { key: 'default_tts_config', value: JSON.stringify(body) }
  });
  return NextResponse.json({ success: true });
}
