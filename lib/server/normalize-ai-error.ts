export function normalizeAiErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);

  let message = rawMessage.trim();

  const lastErrorMatch = message.match(/Last error:\s*(.+)$/i);
  if (lastErrorMatch?.[1]) {
    message = lastErrorMatch[1].trim();
  }

  message = message.replace(/\s*\(request_id:[^)]+\)\s*$/i, '').trim();
  message = message.replace(/^Error:\s*/i, '').trim();

  return message || rawMessage;
}
