/**
 * Parent dashboard data assembly.
 *
 * Pulls a student's saved mistakes from `mistake_book`, computes
 * the headline KPIs and chart data, and either returns a cached
 * AI commentary (parent_ai_insights) or generates a fresh one
 * via the configured default model.
 *
 * The AI cache key is a hash of the student's mistake set, so any
 * add / remove / resolve automatically invalidates the previous
 * insight without explicit cleanup. We also force-regenerate
 * commentary older than 24h.
 */

import { createHash } from 'node:crypto';
import { generateText } from 'ai';
import { db } from '@/lib/db';
import { resolveModel } from '@/lib/server/resolve-model';
import { getBindingById, listActiveBindingsForParent } from '@/lib/parent/invite';

const INSIGHT_MAX_AGE_HOURS = 24;
const INSIGHT_TRUNCATE_MISTAKES = 30; // 喂给 LLM 的错题上限
const DAILY_BUCKETS = 7;

export interface DashboardMistake {
  id: string;
  problemText: string;
  userAnswer: string | null;
  correctAnswer: string | null;
  subject: string | null;
  grade: string | null;
  isResolved: number;
  createdAt: string;
}

export interface SubjectSlice {
  subject: string;
  count: number;
}

export interface DailySlice {
  /** YYYY-MM-DD in local time */
  date: string;
  /** YYYY-MM-DD 的人类友好形式 */
  label: string;
  count: number;
}

export interface DashboardKpis {
  total: number;
  resolved: number;
  unresolved: number;
  /** 最近 7 天新增 */
  recent7d: number;
  /** 掌握率 (0-1) */
  masteryRate: number;
}

export interface ParentDashboard {
  parentVisitorId: string;
  studentVisitorId: string;
  kpis: DashboardKpis;
  subjectDistribution: SubjectSlice[];
  dailyTrend: DailySlice[];
  recentMistakes: DashboardMistake[];
  insight: { content: string; generatedAt: string; fromCache: boolean } | null;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function computeMistakeHash(mistakes: DashboardMistake[]): string {
  // A stable, content-based hash. Order is not normalized because
  // the caller (getDashboardData) sorts by createdAt desc; the
  // resulting hash still changes whenever any underlying record
  // changes, which is what we want for cache invalidation.
  const payload = mistakes
    .map((m) => `${m.id}:${m.isResolved}:${m.problemText.slice(0, 80)}`)
    .join('|');
  return createHash('sha256').update(payload).digest('hex');
}

async function callDefaultLLM(prompt: string): Promise<string> {
  // No client-supplied params — let resolveModel fall back to
  // server-side env (DEFAULT_MODEL, KIMI_API_KEY, etc.).
  const { model } = await resolveModel({});
  const { text } = await generateText({ model, prompt });
  return text.trim();
}

function buildInsightPrompt(
  kpis: DashboardKpis,
  subjectDistribution: SubjectSlice[],
  recentMistakes: DashboardMistake[],
): string {
  const subjectSummary =
    subjectDistribution
      .map((s) => `${s.subject} ${s.count} 道`)
      .join('，') || '无分类数据';
  const recentSummary = recentMistakes
    .slice(0, 6)
    .map((m, i) => {
      const q = m.problemText.replace(/\s+/g, ' ').slice(0, 40);
      return `${i + 1}. ${q}${m.userAnswer ? `（答：${m.userAnswer}）` : ''}`;
    })
    .join('\n');

  return [
    '你是一位面向中国小学生的家长写学习点评的老师。请基于下面的数据用中文写一段 120-180 字的简短评语。',
    '要求：',
    '1) 用第二人称称呼家长（"您可以"），不要直接说"妈妈/爸爸"。',
    '2) 先肯定一个亮点（具体到学科/掌握率），再给两条可执行建议（每条不超过 25 字）。',
    '3) 不要复述原始数据，不要使用 markdown / 标题。',
    '4) 语气温和、不引发焦虑；如错题为 0 也要给出鼓励。',
    '',
    `总错题：${kpis.total}，已掌握：${kpis.resolved}，未掌握：${kpis.unresolved}`,
    `最近 7 天新增：${kpis.recent7d}，掌握率：${Math.round(kpis.masteryRate * 100)}%`,
    `学科分布：${subjectSummary}`,
    '近 6 条错题摘录：',
    recentSummary || '（暂无具体错题）',
  ].join('\n');
}

function freshInsightIsStale(
  row: { generatedAt?: unknown; mistakeHash?: unknown },
  hash: string,
): boolean {
  if (typeof row.mistakeHash !== 'string' || typeof row.generatedAt !== 'string') {
    return true;
  }
  if (row.mistakeHash !== hash) return true;
  const ageMs = Date.now() - new Date(row.generatedAt).getTime();
  return ageMs > INSIGHT_MAX_AGE_HOURS * 60 * 60 * 1000;
}

async function loadOrGenerateInsight(
  studentVisitorId: string,
  mistakes: DashboardMistake[],
  kpis: DashboardKpis,
  subjectDistribution: SubjectSlice[],
): Promise<ParentDashboard['insight']> {
  const hash = computeMistakeHash(mistakes);
  const cached = db.parentAiInsight.findFirst({
    where: { studentVisitorId },
    orderBy: { generatedAt: 'desc' },
  });
  if (cached && !freshInsightIsStale(cached, hash)) {
    return {
      content: cached.content,
      generatedAt: cached.generatedAt,
      fromCache: true,
    };
  }

  let content: string;
  try {
    const prompt = buildInsightPrompt(kpis, subjectDistribution, mistakes);
    content = await callDefaultLLM(prompt);
  } catch (err) {
    console.error('[parent/dashboard] LLM call failed, using fallback:', err);
    content = buildFallbackInsight(kpis, subjectDistribution);
  }

  const row = db.parentAiInsight.create({
    data: {
      studentVisitorId,
      content,
      mistakeHash: hash,
    },
  });

  return { content: row.content, generatedAt: row.generatedAt, fromCache: false };
}

function buildFallbackInsight(
  kpis: DashboardKpis,
  subjectDistribution: SubjectSlice[],
): string {
  if (kpis.total === 0) {
    return '孩子目前还没有错题记录。建议您陪孩子在错题本里加几道，让 AI 一起分析薄弱点。';
  }
  const top = subjectDistribution[0];
  const topText = top ? `${top.subject} 共 ${top.count} 道` : '暂无学科分类';
  const masteryPct = Math.round(kpis.masteryRate * 100);
  return `目前共 ${kpis.total} 道错题（${topText}），掌握率 ${masteryPct}%。建议每天抽 10 分钟复习未掌握的题目，重点看最近 7 天的新增。`;
}

/**
 * Resolve the parent cookie to a dashboard. Returns null when the
 * caller has no active binding — the API route treats null as
 * "redirect to /parent/bind".
 */
export async function getDashboardForParent(
  parentVisitorId: string,
): Promise<ParentDashboard | null> {
  const bindings = listActiveBindingsForParent(parentVisitorId);
  if (bindings.length === 0) return null;

  // MVP: one parent -> one child. We pick the most recent binding
  // and surface a "switch child" UI on the page if the parent has
  // more than one.
  const binding = bindings[0];
  const studentVisitorId = binding.studentVisitorId;
  const bindingRow = getBindingById(binding.id);
  if (!bindingRow || bindingRow.revokedAt) return null;

  const rawMistakes = db.mistakeBook.findMany({
    where: { visitorId: studentVisitorId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const mistakes = rawMistakes as unknown as DashboardMistake[];

  const total = mistakes.length;
  const resolved = mistakes.filter((m) => m.isResolved === 1).length;
  const unresolved = total - resolved;

  // 7-day trend
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const buckets: DailySlice[] = [];
  for (let i = DAILY_BUCKETS - 1; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(todayStart.getDate() - i);
    buckets.push({
      date: formatYmd(d),
      label: formatLabel(d),
      count: 0,
    });
  }
  const bucketIndex = new Map(buckets.map((b, i) => [b.date, i]));
  let recent7d = 0;
  for (const m of mistakes) {
    const d = new Date(m.createdAt);
    const key = formatYmd(startOfLocalDay(d));
    const idx = bucketIndex.get(key);
    if (idx !== undefined) {
      buckets[idx].count += 1;
      recent7d += 1;
    }
  }

  // Subject distribution
  const subjectMap = new Map<string, number>();
  for (const m of mistakes) {
    const subject = m.subject?.trim() || '未分类';
    subjectMap.set(subject, (subjectMap.get(subject) ?? 0) + 1);
  }
  const subjectDistribution: SubjectSlice[] = Array.from(subjectMap.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);

  const kpis: DashboardKpis = {
    total,
    resolved,
    unresolved,
    recent7d,
    masteryRate: total > 0 ? resolved / total : 0,
  };

  const recentMistakes = mistakes.slice(0, INSIGHT_TRUNCATE_MISTAKES);

  const insight = await loadOrGenerateInsight(
    studentVisitorId,
    mistakes,
    kpis,
    subjectDistribution,
  );

  return {
    parentVisitorId,
    studentVisitorId,
    kpis,
    subjectDistribution,
    dailyTrend: buckets,
    recentMistakes,
    insight,
  };
}
