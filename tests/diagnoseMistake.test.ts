import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSession } from "../src/workflows/diagnoseMistake.js";

test("识别进位错误并给出练习题", () => {
  const result = analyzeSession({
    grade: 4,
    subject: "math",
    source: "manual",
    problemText: "36 + 27 = 53，我忘记进位了",
    studentAnswer: "53",
    correctAnswer: "63",
  });

  assert.equal(result.diagnosis.guessedMistake, "carry_mistake");
  assert.equal(result.diagnosis.practiceSuggestions.length, 2);
  assert.match(result.diagnosis.explanationForChild, /进位/);
});

test("识别单位换算问题", () => {
  const result = analyzeSession({
    grade: 5,
    subject: "math",
    source: "manual",
    problemText: "3米等于30厘米吗？我写错了",
  });

  assert.equal(result.diagnosis.guessedMistake, "unit_conversion_error");
  assert.match(result.diagnosis.parentSummary.headline, /单位换算错误/);
});

test("默认回退到概念理解不足", () => {
  const result = analyzeSession({
    grade: 6,
    subject: "math",
    source: "manual",
    problemText: "这道平均分应用题我不会做",
  });

  assert.equal(result.diagnosis.guessedMistake, "concept_gap");
  assert.match(result.diagnosis.knowledgePoint, /概念|理解|不足/);
});
