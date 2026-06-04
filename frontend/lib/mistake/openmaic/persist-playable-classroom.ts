import type { Scene, Stage } from '@/lib/types/stage';

export async function persistPlayableClassroom(input: {
  stage: Stage;
  scenes: Scene[];
}): Promise<{ id: string; url?: string }> {
  const response = await fetch('/api/classroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stage: input.stage,
      scenes: input.scenes,
    }),
  });

  const json = (await response
    .json()
    .catch(() => ({ error: `HTTP ${response.status}` }))) as {
    success?: boolean;
    id?: string;
    url?: string;
    error?: string;
  };

  if (!response.ok || !json.success || !json.id) {
    throw new Error(json.error || `Failed to persist classroom snapshot: HTTP ${response.status}`);
  }

  return {
    id: json.id,
    url: json.url,
  };
}
