import test from "node:test";
import assert from "node:assert/strict";
import { handleSessionAnalyze } from "../src/routes/session.js";

test("数字型 studentAnswer 应返回 400，而不是触发运行时异常", async () => {
  const request = new Request("http://localhost/api/session/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grade: 4,
      subject: "math",
      source: "manual",
      problemText: "36 + 27 = 53",
      studentAnswer: 53,
      correctAnswer: "63",
    }),
  });

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "studentAnswer 必须是字符串");
});

test("数字型 correctAnswer 应返回 400", async () => {
  const request = new Request("http://localhost/api/session/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grade: 4,
      subject: "math",
      source: "manual",
      problemText: "36 + 27 = 53",
      studentAnswer: "53",
      correctAnswer: 63,
    }),
  });

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "correctAnswer 必须是字符串");
});

test("空白 problemText 应返回 400", async () => {
  const request = new Request("http://localhost/api/session/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grade: 4,
      subject: "math",
      source: "manual",
      problemText: "   ",
    }),
  });

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "problemText 不能为空");
});

test("非法 grade 应返回 400", async () => {
  const request = new Request("http://localhost/api/session/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grade: 3,
      subject: "math",
      source: "manual",
      problemText: "36 + 27 = 53",
    }),
  });

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "grade 必须是 4-6 的整数");
});

test("非法 subject 应返回 400", async () => {
  const request = new Request("http://localhost/api/session/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grade: 4,
      subject: "english",
      source: "manual",
      problemText: "36 + 27 = 53",
    }),
  });

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "subject 必须是 math");
});

test("非法 source 应返回 400", async () => {
  const request = new Request("http://localhost/api/session/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grade: 4,
      subject: "math",
      source: "upload",
      problemText: "36 + 27 = 53",
    }),
  });

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error, "source 必须是 photo 或 manual");
});

test("错误 JSON 应返回 400", async () => {
  const request = new Request("http://localhost/api/session/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad json",
  });

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(String(payload.error), /JSON|合法/);
});

test("分析阶段发生意外异常时应返回 500 JSON，而不是直接抛出", async () => {
  const body = {
    grade: 4,
    subject: "math" as const,
    source: "manual" as const,
    problemText: "36 + 27 = 53",
    get studentAnswer() {
      throw new Error("boom");
    },
  };

  const request = {
    json: async () => body,
  } as Request;

  const response = await handleSessionAnalyze(request);
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.match(String(payload.error), /分析|服务|失败|异常/);
});
