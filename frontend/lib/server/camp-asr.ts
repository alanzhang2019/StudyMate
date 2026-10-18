/**
 * 服务端 ASR 可用性
 *
 * 学生作品的 SpeechRecognition 兜底依赖平台自己的 ASR：
 * 注入脚本前要先知道「服务端到底有没有配好 ASR」，没配就不注入，
 * 避免作品每次识别都白跑一次 501。
 */

import {
  getServerASRProviders,
  resolveASRApiKey,
  resolveASRBaseUrl,
} from '@/lib/server/provider-config';

export type PickedAsr = {
  id: string;
  apiKey: string;
  baseUrl?: string;
  modelId?: string;
};

/** 优先国内可达的 provider，其余按服务端配置顺序兜底 */
const PREFERRED: string[] = ['qwen-asr', 'openai-whisper'];

/** 选出第一个服务端已配好凭据的 ASR provider；没有则返回 null */
export function pickAsrProvider(): PickedAsr | null {
  let ids: string[] = [];
  try {
    ids = Object.keys(getServerASRProviders() || {}).filter(
      (id) => id !== 'browser-native',
    );
  } catch {
    return null;
  }
  const ordered = [
    ...PREFERRED.filter((p) => ids.includes(p)),
    ...ids.filter((i) => !PREFERRED.includes(i)),
  ];
  for (const id of ordered) {
    const key = resolveASRApiKey(id);
    // lemonade-asr 是本地服务，允许无 key
    if (key || id === 'lemonade-asr') {
      return {
        id,
        apiKey: key,
        baseUrl: resolveASRBaseUrl(id),
        // 模型名各家不通用（硅基流动是 FunAudioLLM/SenseVoiceSmall），
        // 走 OpenAI 兼容接口时用 CAMP_ASR_MODEL_ID 显式指定最稳。
        modelId:
          process.env.CAMP_ASR_MODEL_ID ||
          (id === 'openai-whisper'
            ? process.env.ASR_OPENAI_MODELS?.split(',')[0]?.trim()
            : undefined) ||
          undefined,
      };
    }
  }
  return null;
}

export function asrAvailable(): boolean {
  return pickAsrProvider() !== null;
}
