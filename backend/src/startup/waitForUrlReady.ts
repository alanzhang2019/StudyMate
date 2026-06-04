import { spawn } from "node:child_process";

export type WaitForUrlReadyOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type WaitForUrlReadyResult =
  | { ok: true; status: number }
  | { ok: false; reason: string; status?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForUrlReady(
  url: string,
  options: WaitForUrlReadyOptions = {},
): Promise<WaitForUrlReadyResult> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 500;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });

      if (response.status < 500) {
        return { ok: true, status: response.status };
      }
    } catch {
      // Keep polling until timeout.
    }

    await sleep(intervalMs);
  }

  return { ok: false, reason: `Timeout waiting for ${url}` };
}

export function openInBrowser(url: string): void {
  const child = spawn("cmd", ["/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

async function runCli() {
  const [, , probeUrl, openUrl = probeUrl, timeoutArg, intervalArg] = process.argv;

  if (!probeUrl) {
    console.error("Usage: waitForUrlReady <probeUrl> [openUrl] [timeoutMs] [intervalMs]");
    process.exit(1);
  }

  const result = await waitForUrlReady(probeUrl, {
    timeoutMs: timeoutArg ? Number(timeoutArg) : undefined,
    intervalMs: intervalArg ? Number(intervalArg) : undefined,
  });

  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }

  openInBrowser(openUrl);
  process.exit(0);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  void runCli();
}
