// /lib/server/csp-mistake-book.ts
//
// 共用的 CSP 错题本聚合逻辑。被 /api/mistake-book/csp
// （机器消费，JSON）和 /student/csp-mistakes 页面
// （RSC 直接调用，渲染 UI）共享，避免双份代码。
//
// 数据来源：csp_quiz_submissions 表的 answersJson 字段
// （每项含 questionId / correct / choice / points），加上
// classroom JSON 里的题面 / 选项 / 答案 / 解析。

import { db } from '@/lib/db';
import { readClassroom } from '@/lib/server/classroom-storage';

export type MistakeRecord = {
  sceneId: string;
  sceneTitle: string;
  questionId: string;
  questionText: string;
  options: Array<{ value: string; label: string }>;
  correctAnswer: string | string[];
  userAnswer: string | string[];
  points: number;
  analysis: string;
  /** 最近一次答错时间，ISO 字符串 */
  at: string;
  /** 该题累计答错次数 */
  mistakeCount: number;
};

export type MistakeGroup = {
  classroomId: string;
  classroomTitle: string;
  /** 该课件下错题数（去重后） */
  mistakeCount: number;
  /** 该课件最近一次答错时间 */
  lastMistakeAt: string;
  mistakes: MistakeRecord[];
};

export type MistakeBook = {
  totalMistakes: number;
  groups: MistakeGroup[];
};

type AnswerEntry = {
  questionId?: string;
  choice?: string | string[];
  correct?: boolean;
  ms?: number;
  points?: number;
};

/**
 * 加载当前用户的所有 CSP 错题，按课件标题分组。
 * 同一题在多次答错时只保留一条，mistakeCount 累加。
 */
export async function loadCspMistakeBook(userId: string): Promise<MistakeBook> {
  const rows = db.cspQuizSubmission.findAllByUser(userId);
  if (rows.length === 0) {
    return { totalMistakes: 0, groups: [] };
  }

  // Cache classroom JSONs so each file is read at most once even
  // if it has multiple scenes.
  const classroomCache = new Map<
    string,
    Awaited<ReturnType<typeof readClassroom>>
  >();

  // dedup key: classroomId::sceneId::questionId
  // value 是构建好的 MistakeRecord
  const dedup = new Map<string, MistakeRecord>();

  for (const row of rows) {
    let entries: AnswerEntry[] = [];
    try {
      const parsed = JSON.parse(row.answersJson ?? '[]');
      if (Array.isArray(parsed)) entries = parsed as AnswerEntry[];
    } catch {
      continue;
    }
    const wrong = entries.filter((e) => e.correct === false);
    if (wrong.length === 0) continue;

    let classroom = classroomCache.get(row.classroomId);
    if (classroom === undefined) {
      classroom = await readClassroom(row.classroomId);
      classroomCache.set(row.classroomId, classroom);
    }
    if (!classroom) continue;

    const scene = (classroom.scenes ?? []).find((s) => s?.id === row.sceneId);
    const sceneTitle = (scene as any)?.title ?? row.sceneId;
    const questions: any[] = (scene as any)?.content?.questions ?? [];
    const at: string = row.submittedAt ?? new Date().toISOString();

    for (const e of wrong) {
      if (!e.questionId) continue;
      const q = questions.find((it) => it.id === e.questionId);
      if (!q) continue;

      const key = `${row.classroomId}::${row.sceneId}::${e.questionId}`;
      const existing = dedup.get(key);
      if (existing) {
        existing.mistakeCount += 1;
        // 保留最近一次答错时间。csp_quiz_submissions rows
        // 已按 submittedAt DESC 返回，所以 existing 已是最新；
        // 这里仅在出现更新的时间时再覆盖。
        if (at > existing.at) existing.at = at;
        continue;
      }
      dedup.set(key, {
        sceneId: row.sceneId,
        sceneTitle,
        questionId: e.questionId,
        questionText: q.question ?? '',
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.answer ?? [],
        userAnswer: e.choice ?? '',
        points: typeof q.points === 'number' ? q.points : e.points ?? 1,
        analysis: typeof q.analysis === 'string' ? q.analysis : '',
        at,
        mistakeCount: 1,
      });
    }
  }

  // 按课件分组
  const groupByClassroom = new Map<string, MistakeGroup>();
  for (const [key, rec] of dedup.entries()) {
    const classroomId = key.split('::')[0];
    const classroom = classroomCache.get(classroomId);
    const classroomTitle = classroom?.stage?.name ?? classroomId;
    if (!groupByClassroom.has(classroomId)) {
      groupByClassroom.set(classroomId, {
        classroomId,
        classroomTitle,
        mistakeCount: 0,
        lastMistakeAt: rec.at,
        mistakes: [],
      });
    }
    const g = groupByClassroom.get(classroomId)!;
    g.mistakes.push(rec);
    g.mistakeCount += 1;
    if (rec.at > g.lastMistakeAt) g.lastMistakeAt = rec.at;
  }

  // 组内按 at 倒序、组间按 lastMistakeAt 倒序
  for (const g of groupByClassroom.values()) {
    g.mistakes.sort((a, b) => b.at.localeCompare(a.at));
  }
  const groups = Array.from(groupByClassroom.values()).sort(
    (a, b) => b.lastMistakeAt.localeCompare(a.lastMistakeAt),
  );

  return {
    totalMistakes: dedup.size,
    groups,
  };
}
