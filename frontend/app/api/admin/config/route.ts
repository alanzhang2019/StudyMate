import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin/with-auth';

export const GET = withAdminAuth(async () => {
  try {
    const config = await db.systemConfig.findUnique({ where: { key: 'default_tts_config' } });
    return NextResponse.json(
      config
        ? JSON.parse(config.value)
        : { provider: 'siliconflow-tts', voice: 'FunAudioLLM/CosyVoice2-0.5B:alex' },
    );
  } catch (err) {
    console.error('[admin/config GET] failed:', err);
    return NextResponse.json(
      {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
});

export const POST = withAdminAuth(async (req: Request) => {
  try {
    const body = await req.json();
    await db.systemConfig.upsert({
      where: { key: 'default_tts_config' },
      update: { value: JSON.stringify(body) },
      create: { key: 'default_tts_config', value: JSON.stringify(body) }
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/config POST] failed:', err);
    return NextResponse.json(
      {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
});
