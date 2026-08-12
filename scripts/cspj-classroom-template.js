// Build CSP-J (2014-2018) classroom JSON, adapted to new question format.
//
// This is the shared template extracted from scripts/build-2015j-new.js and
// extended with image / codeBlock support for individual choice questions
// (2016 Q11, Q17, Q18, etc. all need a figure or short code snippet in the
// stem itself, not in a separate read-program scene).
//
// Per-paper scripts (build-2016j-new.js, build-2017j-new.js, etc.) import
// the helpers from this file and just provide their own:
//
//   - choiceQuestions : array of {id, points, q, opts, ans, a,
//                                 codeBlock?, image?, imageCaption?}
//   - readPrograms    : array of {id, title, code, q}
//   - perfects        : array of {id, title, description, code, qs}
//   - stageMeta       : {name, description, scoreBreakdown}
//
// and the helpers below compose them into a fully-validated classroom JSON.

const fs = require('fs');

// ---------- per-question builders ----------

function buildChoiceQuestion(q) {
  const out = {
    id: q.id,
    type: 'single',
    question: q.q,
    options: q.opts.map(([v, l]) => ({ value: v, label: l })),
    answer: q.ans,
    analysis: q.a,
    points: q.points,
    hasAnswer: true,
  };
  // Optional stem attachments (figures + short code snippets).
  if (q.codeBlock) out.codeBlock = q.codeBlock;
  if (q.image) out.image = q.image;
  if (q.imageCaption) out.imageCaption = q.imageCaption;
  return out;
}

function buildReadQuestion(q) {
  return {
    id: q.id,
    type: 'single',
    question: q.q,
    options: q.opts.map(([v, l]) => ({ value: v, label: l })),
    answer: q.ans,
    analysis: q.a,
    points: q.points,
    hasAnswer: true,
  };
}

function buildPerfectQuestion(q) {
  return {
    id: q.id,
    type: 'single',
    question: q.q,
    options: q.opts.map(([v, l]) => ({ value: v, label: l })),
    answer: q.ans,
    analysis: q.a,
    points: q.points,
    hasAnswer: true,
  };
}

// ---------- per-scene builders ----------

function buildScene({ id, stageId, title, order, content, category, kind }) {
  return {
    id, stageId, type: 'quiz', title, order,
    content: { ...content, kind },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(), updatedAt: Date.now(),
    category,
  };
}

function buildChoiceScene({ id, stageId, title, questions }) {
  return buildScene({
    id, stageId, title, order: 1,
    content: { type: 'quiz', questions: questions.map(buildChoiceQuestion) },
    category: 'choice', kind: 'choice',
  });
}

function buildReadScene({ id, stageId, title, order, code, question }) {
  return buildScene({
    id, stageId, title, order,
    content: {
      type: 'quiz',
      codeBlock: { language: 'cpp', title, description: '', lines: code },
      questions: [buildReadQuestion(question)],
    },
    // category drives score aggregation; kind is purely cosmetic.
    // 2015 (canonical template) uses 'code-reading' for read scenes
    // and 'code-completion' for perfect scenes — keep them in sync
    // so the renderer/visual matches the "perfect" reference.
    category: 'read', kind: 'code-reading',
  });
}

function buildPerfectScene({ id, stageId, title, order, code, description, questions }) {
  return buildScene({
    id, stageId, title, order,
    content: {
      type: 'quiz',
      codeBlock: { language: 'cpp', title, description, lines: code },
      questions: questions.map(buildPerfectQuestion),
    },
    category: 'perfect', kind: 'code-completion',
  });
}

// ---------- classroom writer ----------

// Derive a short agent id prefix (matches 2015's "imp_agent_cspj15j_*")
// from the full stageId. Tries two patterns:
//   1. "cspj<digits>j"  -> "cspj<last2>j"   (canonical 2015 shape)
//   2. "cspj<digits>"   -> "cspj<last2>"
// Falls back to the full stageId when neither matches.
function shortAgentPrefix(stageId) {
  const m = stageId.match(/cspj(\d+)(j?)/i);
  if (m) return `cspj${String(m[1]).slice(-2)}${m[2]}`;
  return stageId;
}

function buildClassroom({ stageId, stageName, stageDescription, scoreBreakdown, scenes, outPath }) {
  const agentPrefix = shortAgentPrefix(stageId);
  const stage = {
    id: stageId,
    name: stageName,
    description: stageDescription,
    languageDirective: 'zh-CN',
    style: 'tutor',
    createdAt: Date.now(), updatedAt: Date.now(),
    generatedAgentConfigs: [
      { id: `imp_agent_${agentPrefix}_0`, name: '张老师', role: 'teacher', persona: '经验丰富的CSP初赛教练', avatar: '/avatars/teacher.png', color: '#3b82f6', priority: 10 },
      { id: `imp_agent_${agentPrefix}_1`, name: '小慧', role: 'assistant', persona: '聪明耐心的女助教', avatar: '/avatars/assist.png', color: '#ec4899', priority: 7 },
    ],
    agentIds: [],
    scoreBreakdown,
  };
  // CRITICAL: `scenes` must be at the TOP LEVEL, not inside
  // `stage.scenes`. The frontend (lib/store/stage.ts) and
  // lib/import/use-import-classroom.ts both read `manifest.scenes`
  // at the top level — nesting it under `stage` would make the
  // page render as an empty classroom. (See 2015/2017/2021 JSONs
  // for the canonical shape; 2016 was previously broken this way.)
  const classroom = {
    id: stageId,
    createdAt: new Date().toISOString(),
    collection: 'csp-lecture',
    stage,
    scenes,
  };
  fs.writeFileSync(outPath, JSON.stringify(classroom, null, 2) + '\n', 'utf8');

  // Score validation
  const total = scoreBreakdown.choice + scoreBreakdown.read + scoreBreakdown.perfect;
  const byCat = scenes.reduce((acc, s) => {
    const cat = s.category;
    if (cat === 'choice' || cat === 'read' || cat === 'perfect') {
      const sum = (s.content.questions || []).reduce((a, q) => a + (q.points || 0), 0);
      acc[cat] = (acc[cat] || 0) + sum;
    }
    return acc;
  }, {});
  const qCount = scenes.reduce((a, s) => a + ((s.content.questions || []).length), 0);
  console.log(`Written: ${outPath}`);
  console.log('Score breakdown:', byCat, 'total', Object.values(byCat).reduce((a, b) => a + b, 0),
              `(should be ${total})`);
  console.log('Questions total:', qCount);
}

module.exports = {
  buildChoiceScene,
  buildReadScene,
  buildPerfectScene,
  buildClassroom,
};
