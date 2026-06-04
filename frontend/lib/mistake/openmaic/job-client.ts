export async function submitMistakeClassroomJob(input: Record<string, unknown>) {
  const response = await fetch('/api/mistake/session/generate-classroom', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  const json = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(json.error ?? '错题任务创建失败');
  }

  return json;
}
