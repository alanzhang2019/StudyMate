// 批量生成21套CSP真题卷的JSON骨架
// - 9套J组(2014-2022): cm_imp_cspj{year}j_v1
// - 12套S组(2014-2025): cm_imp_csps{year}s_v1
// 仅含元信息，scenes为空数组，后续由用户填充题面/答案/解析

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const OUT_DIR = 'd:/AItrade/ai-math-mistake-machine/frontend/data/classrooms';

const jYears = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022];
const sYears = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

const SPEC = {
  j: {
    label: '普及组CSP-J',
    code: 'J',
  },
  s: {
    label: '提高组CSP-S',
    code: 'S',
  },
};

const NOIP_OLD_YEARS = new Set([2014, 2015, 2016, 2017, 2018]); // 2019开始改名为CSP

function makeSkeleton(year, group) {
  const id = `cm_imp_csp${group.code.toLowerCase()}${year}${group.code.toLowerCase()}_v1`;
  const isOldNoip = NOIP_OLD_YEARS.has(year);
  // 文案: NOIP 年代 (2014-2018) 与 CSP 年代 (2019+) 用不同的组织名 + 名称
  //   2014-2018: "CCF NOIP 普及/提高组初赛" (国字号全国联赛)
  //   2019+    : "CCF 非专业级别软件能力认证 (CSP-J1/S1) 入门级/提高级"
  const era = isOldNoip ? 'NOIP' : 'CSP';
  const groupName = isOldNoip
    ? (group.code === 'J' ? '普及组' : '提高组')
    : (group.code === 'J' ? '入门级（CSP-J1）' : '提高级（CSP-S1）');
  const fullName = `${year}年${group.label}初赛真题卷`;
  const description = `${year}年CCF ${era} ${groupName}初赛完整真题（PDF原件已上传至公共目录），共15道单项选择题、阅读程序题与完善程序题，总分100分。本卷题面与答案解析待补充，请参考 PDF 文档填写。`;

  return {
    id,
    createdAt: '2026-08-09T00:00:00.000Z',
    collection: 'csp-lecture',
    stage: {
      id,
      name: fullName,
      description,
      languageDirective: 'zh-CN',
      style: 'tutor',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      generatedAgentConfigs: [
        {
          id: `imp_agent_csp${group.code.toLowerCase()}${year % 100}${group.code.toLowerCase()}_0`,
          name: '张老师',
          role: 'teacher',
          persona: '经验丰富的CSP初赛教练，熟悉历年真题考点，讲解清晰且直击要点，耐心引导学员分析每道题的解题思路。',
          avatar: '/avatars/teacher.png',
          color: '#3b82f6',
          priority: 10,
        },
        {
          id: `imp_agent_csp${group.code.toLowerCase()}${year % 100}${group.code.toLowerCase()}_1`,
          name: '小慧',
          role: 'assistant',
          persona: '聪明耐心的女助教，擅长总结归纳易错点，帮助学员梳理解题思路，在测验后给出鼓励和易错提醒。',
          avatar: '/avatars/assist.png',
          color: '#ec4899',
          priority: 7,
        },
      ],
      agentIds: [],
      scoreBreakdown: {
        choice: 30,
        read: 40,
        perfect: 30,
      },
    },
    scenes: [
      {
        id: `sc_csp${group.code.toLowerCase()}${year % 100}${group.code.toLowerCase()}_choice`,
        stageId: id,
        type: 'quiz',
        title: '一、单项选择题（共15题，每题2分，共计30分）',
        order: 1,
        content: {
          type: 'quiz',
          questions: [],
          kind: 'choice',
        },
        actions: [],
        multiAgent: {
          enabled: false,
          agentIds: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'choice',
      },
      {
        id: `sc_csp${group.code.toLowerCase()}${year % 100}${group.code.toLowerCase()}_read`,
        stageId: id,
        type: 'quiz',
        title: '二、阅读程序题（判断+选择，共计40分）',
        order: 2,
        content: {
          type: 'quiz',
          questions: [],
          kind: 'code-reading',
        },
        actions: [],
        multiAgent: {
          enabled: false,
          agentIds: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'read',
      },
      {
        id: `sc_csp${group.code.toLowerCase()}${year % 100}${group.code.toLowerCase()}_perfect`,
        stageId: id,
        type: 'quiz',
        title: '三、完善程序题（单空填空，共计30分）',
        order: 3,
        content: {
          type: 'quiz',
          questions: [],
          kind: 'code-completion',
        },
        actions: [],
        multiAgent: {
          enabled: false,
          agentIds: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        category: 'perfect',
      },
    ],
  };
}

let count = 0;
for (const year of jYears) {
  const obj = makeSkeleton(year, SPEC.j);
  writeFileSync(
    path.join(OUT_DIR, `${obj.id}.json`),
    JSON.stringify(obj, null, 2),
    'utf-8',
  );
  count++;
}
for (const year of sYears) {
  const obj = makeSkeleton(year, SPEC.s);
  writeFileSync(
    path.join(OUT_DIR, `${obj.id}.json`),
    JSON.stringify(obj, null, 2),
    'utf-8',
  );
  count++;
}

console.log(`OK: ${count} 套骨架已生成。`);
