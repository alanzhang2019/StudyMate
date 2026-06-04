import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import { openInBrowser, waitForUrlReady } from "./waitForUrlReady.js";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const frontendRoot = process.env.FE_ROOT ?? "D:\\AItrade\\AI-MATH-MISTAKE";
const backendPort = process.env.PORT ?? "3000";
const frontendPort = process.env.FE_PORT ?? "3001";

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function canUsePnpm() {
  return new Promise<boolean>((resolve) => {
    const child = spawn("where.exe", ["pnpm"], {
      stdio: "ignore",
      windowsHide: true,
    });

    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function runCommand(options: {
  cwd: string;
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", reject);
  });
}

function spawnDetachedProcess(options: {
  cwd: string;
  command: string;
  args: string[];
  logFileName: string;
  env?: NodeJS.ProcessEnv;
}) {
  const logPath = path.join(projectRoot, options.logFileName);
  const quote = (value: string) =>
    /[\s"]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const commandLine = `${[options.command, ...options.args].map(quote).join(" ")} >> ${quote(logPath)} 2>&1`;

  const child = spawn(commandLine, [], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    shell: true,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function ensureBackendRunning() {
  const probeUrl = `http://localhost:${backendPort}/health`;
  const existing = await waitForUrlReady(probeUrl, { timeoutMs: 800, intervalMs: 200 });

  if (!existing.ok) {
    spawnDetachedProcess({
      cwd: projectRoot,
      command: "npm.cmd",
      args: ["run", "dev"],
      env: { PORT: backendPort },
      logFileName: "startup-backend.log",
    });
  }

  return waitForUrlReady(probeUrl, { timeoutMs: 30_000, intervalMs: 500 });
}

async function ensureFrontendRunning() {
  const frontendAvailable = await pathExists(frontendRoot);
  if (!frontendAvailable) {
    return null;
  }

  const pnpmAvailable = await canUsePnpm();
  if (!pnpmAvailable) {
    return null;
  }

  const frontendNodeModules = path.join(frontendRoot, "node_modules");
  if (!(await pathExists(frontendNodeModules))) {
    const installCode = await runCommand({
      cwd: frontendRoot,
      command: "pnpm.cmd",
      args: ["install"],
    });

    if (installCode !== 0) {
      return null;
    }
  }

  const probeUrl = `http://localhost:${frontendPort}/mistake`;
  const existing = await waitForUrlReady(probeUrl, { timeoutMs: 800, intervalMs: 200 });

  if (!existing.ok) {
    spawnDetachedProcess({
      cwd: frontendRoot,
      command: "pnpm.cmd",
      args: ["dev"],
      env: { PORT: frontendPort },
      logFileName: "startup-frontend.log",
    });
  }

  const ready = await waitForUrlReady(probeUrl, { timeoutMs: 60_000, intervalMs: 500 });
  return ready.ok ? probeUrl : null;
}

async function main() {
  const frontendUrl = await ensureFrontendRunning();
  if (frontendUrl) {
    openInBrowser(frontendUrl);
    return;
  }

  const backendReady = await ensureBackendRunning();
  if (!backendReady.ok) {
    console.error(backendReady.reason);
    process.exit(1);
  }

  openInBrowser(`http://localhost:${backendPort}/health`);
}

void main();
