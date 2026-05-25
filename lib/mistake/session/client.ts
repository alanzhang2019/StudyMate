import type { MistakeSession } from './types';

export async function createMistakeSession(payload: Record<string, unknown>) {
  const response = await fetch('/api/mistake/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as {
    success?: true;
    session?: MistakeSession;
    liveUrl?: string;
    error?: string;
  };

  if (!response.ok || !json.session || !json.liveUrl) {
    throw new Error(json.error ?? '创建错题会话失败');
  }

  return json as { success: true; session: MistakeSession; liveUrl: string };
}

export async function updateMistakeSession(sessionId: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/mistake/session/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = (await response.json()) as {
    success?: true;
    session?: MistakeSession;
    error?: string;
  };

  if (!response.ok || !json.session) {
    throw new Error(json.error ?? '更新错题会话失败');
  }

  return json as { success: true; session: MistakeSession };
}
