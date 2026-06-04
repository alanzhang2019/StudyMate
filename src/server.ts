import { createServer } from "node:http";
import { handleSessionAnalyze } from "./routes/session.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "无效请求" }));
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "ai-math-mistake-machine" }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/session/analyze") {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", async () => {
      const request = new Request("http://localhost/api/session/analyze", {
        method: "POST",
        headers: { "content-type": req.headers["content-type"] ?? "application/json" },
        body: Buffer.concat(chunks).toString("utf8"),
      });

      const response = await handleSessionAnalyze(request);
      const payload = await response.text();

      res.writeHead(response.status, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(payload);
    });

    req.on("error", () => {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "请求读取失败" }));
    });

    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "未找到接口" }));
});

server.listen(port, () => {
  console.log(`AI Math Mistake Machine server listening on http://localhost:${port}`);
});
