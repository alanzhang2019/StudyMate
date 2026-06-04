import { createServer } from "node:http";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { waitForUrlReady } from "../src/startup/waitForUrlReady.js";

const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );
  servers.length = 0;
});

test("waitForUrlReady resolves after a delayed server becomes reachable", async () => {
  const port = 43101;

  setTimeout(() => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    });

    server.listen(port, "127.0.0.1");
    servers.push(server);
  }, 120);

  const result = await waitForUrlReady(`http://127.0.0.1:${port}/health`, {
    timeoutMs: 2000,
    intervalMs: 50,
  });

  assert.equal(result.ok, true);
});

test("waitForUrlReady returns timeout info when url never becomes reachable", async () => {
  const result = await waitForUrlReady("http://127.0.0.1:43102/health", {
    timeoutMs: 200,
    intervalMs: 50,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /timeout/i);
});
