import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/audio/asr-providers';
import { pickAsrProvider } from '@/lib/server/camp-asr';
import type { ASRProviderId } from '@/lib/audio/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('CampASR');

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8MB ≈ 几分钟的 opus 录音，足够一句话跟读
const AUDIO_EXT = ['webm', 'ogg', 'mp4', 'm4a', 'wav', 'mp3', 'aac'];

// 极简限流：同一 IP 每分钟 30 次（作品页是公开页面，防止被当免费 ASR 刷）
const buckets = new Map<string, { n: number; ts: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.ts > WINDOW_MS) {
    buckets.set(ip, { n: 1, ts: now });
    return false;
  }
  b.n += 1;
  return b.n > MAX_PER_WINDOW;
}

// 定期清理，避免 Map 无限增长（Node 环境下才有 unref，定时器不该挡进程退出）
const cleaner: any = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now - v.ts > WINDOW_MS * 5) buckets.delete(k);
  }
}, WINDOW_MS * 5);
cleaner?.unref?.();

// POST /api/camp/asr —— 学生作品的语音识别兜底（公开接口，音频不落盘）
// 供注入到作品里的 SpeechRecognition 包装器调用：原生识别在国内报
// network 时，改由本接口用平台自己的 ASR 出结果。
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    if (rateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请稍后再试' },
        { status: 429 },
      );
    }

    const form = await req.formData();
    const audio = form.get('audio') as File | null;
    if (!audio || typeof audio === 'string') {
      return NextResponse.json(
        { success: false, error: '缺少音频数据' },
        { status: 400 },
      );
    }
    if (audio.size === 0) {
      return NextResponse.json(
        { success: false, error: '音频为空' },
        { status: 400 },
      );
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: '录音过长，请分段后再试' },
        { status: 413 },
      );
    }
    const ext = (audio.name.split('.').pop() || '').toLowerCase();
    if (ext && !AUDIO_EXT.includes(ext)) {
      return NextResponse.json(
        { success: false, error: '不支持的音频格式' },
        { status: 400 },
      );
    }

    const picked = pickAsrProvider();
    if (!picked) {
      // 没配 ASR 就明确告诉前端「别再试了」，作品会自动退回原生报错行为
      return NextResponse.json(
        { success: false, error: 'ASR_NOT_CONFIGURED' },
        { status: 501 },
      );
    }

    const langRaw = (form.get('lang') as string) || 'zh-CN';
    // whisper / qwen 都只认短语言码
    const language = /^zh/i.test(langRaw)
      ? 'zh'
      : (langRaw.split('-')[0] || 'auto').toLowerCase();

    const result = await transcribeAudio(
      {
        providerId: picked.id as ASRProviderId,
        modelId: picked.modelId,
        apiKey: picked.apiKey,
        baseUrl: picked.baseUrl,
        language,
      },
      audio,
    );

    return NextResponse.json({ success: true, text: result.text || '' });
  } catch (e: any) {
    log.error('camp asr failed:', e);
    return NextResponse.json(
      { success: false, error: `识别失败：${e?.message || '未知错误'}` },
      { status: 500 },
    );
  }
}
