'use client';

// /components/csp-lecture/paper-analysis-report.tsx
//
// 单套历年真题 AI 分析报告 — 模态对话框。
//
// 使用：在 FinalSummary 渲染完成后挂一个 "查看 AI 分析报告" 按钮，
// 按钮 onClick 切换 open 状态。open=true 时本组件 fetch
// /api/csp-quiz/analyze-paper 并按 4 个板块渲染：
//
//   1. 总体诊断 (overallDiagnosis) — 顶部一句话
//   2. 薄弱知识点 (weakKnowledgePoints) — 进度条列表
//   3. 根因分析 (rootCauses) — 带 type 标签的卡片列表
//   4. 下一步建议 (nextSteps) — 优先级排序的行动列表
//
// 三态：idle / loading (skeleton) / error (重试按钮) / rendered。
// 已有缓存 (meta.cached=true) 时右上角显示一个小徽章，避免学生
// 误以为每次都是新算的。

import { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  RefreshCcw,
  AlertTriangle,
  Target,
  Stethoscope,
  ListChecks,
  CheckCircle2,
  X,
  Clock,
  AlertCircle,
  Trophy,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Lightbulb,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  classifyAward,
  getScoreLine,
  AWARD_LABEL,
  SCORE_LINE_META,
  AWARD_COLOR,
  type CspGroup,
} from '@/lib/csp-score-lines';
import { useBrowserTTS } from '@/lib/hooks/use-browser-tts';
import { useSettingsStore } from '@/lib/store/settings';

type RootCauseType =
  | 'concept-confusion'
  | 'blind-spot'
  | 'calculation'
  | 'reading'
  | 'edge-case'
  | 'logic'
  | 'memory';

const ROOT_CAUSE_LABEL: Record<RootCauseType, string> = {
  'concept-confusion': '概念混淆',
  'blind-spot': '知识点盲区',
  'calculation': '计算错误',
  'reading': '审题不清',
  'edge-case': '边界遗漏',
  'logic': '逻辑错误',
  'memory': '记忆遗漏',
};

const ROOT_CAUSE_COLOR: Record<RootCauseType, string> = {
  'concept-confusion': 'bg-rose-100 text-rose-700 border-rose-200',
  'blind-spot': 'bg-orange-100 text-orange-700 border-orange-200',
  'calculation': 'bg-amber-100 text-amber-700 border-amber-200',
  'reading': 'bg-sky-100 text-sky-700 border-sky-200',
  'edge-case': 'bg-purple-100 text-purple-700 border-purple-200',
  'logic': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'memory': 'bg-slate-100 text-slate-700 border-slate-200',
};

type SeverityLevel = 'low' | 'medium' | 'high';

const SEVERITY_META: Record<
  SeverityLevel,
  { label: string; bar: string; chip: string }
> = {
  high: { label: '严重', bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700' },
  medium: { label: '中等', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  low: { label: '轻微', bar: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
};

interface Report {
  overallDiagnosis: string;
  weakKnowledgePoints: Array<{
    topic: string;
    wrongCount: number;
    totalCount: number;
    accuracy: number;
    severity: SeverityLevel;
    relatedQuestionIds: string[];
  }>;
  rootCauses: Array<{
    type: RootCauseType;
    label: string;
    description: string;
    affectedQuestionIds: string[];
  }>;
  nextSteps: Array<{
    priority: 1 | 2 | 3;
    action: string;
    rationale: string;
  }>;
  meta: {
    classroomId: string;
    title: string;
    group: 'J' | 'S';
    year: number;
    wrongCount: number;
    totalCount: number;
    score: number;
    generatedAt: string;
    cached: boolean;
    wrongQuestions: Array<{
      id: string;
      sceneId: string;
      sceneTitle: string;
      sceneCategory: 'choice' | 'read' | 'perfect' | null;
      text: string;
      options: Array<{ label: string; value: string; text: string }>;
      correctAnswer: string | string[];
      userAnswer: string | string[];
      analysis: string;
      points: number;
    }>;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
}

export function PaperAnalysisReport({ open, onOpenChange, classroomId }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (force = false) => {
    if (!classroomId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/csp-quiz/analyze-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId, forceRefresh: force }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setReport(json.report as Report);
    } catch (e: any) {
      setError(e?.message ?? 'AI 分析失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // open=false → false 时清理，避免下次打开看到旧数据闪烁
  useEffect(() => {
    if (open) {
      if (!report || report.meta.classroomId !== classroomId) {
        void fetchReport(false);
      }
    } else {
      // keep data so reopen is instant, but reset error
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classroomId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-3xl max-h-[88vh] overflow-y-auto p-0 sm:p-0"
      >
        {/* 顶部 hero 渐变区 */}
        <div className="relative bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-600 text-white px-6 py-5 sm:px-8 sm:py-7">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/30">
                <Sparkles className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-white/85">
                AI 学习诊断报告
              </span>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white leading-snug">
              {report ? `${report.meta.year} 年 ${report.meta.group} 组 · ${report.meta.title}` : 'AI 正在分析你的真题表现'}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              基于你本次答错的题目，AI 全方位分析知识漏洞与根因，并给出下一步学习建议。
            </DialogDescription>
          </DialogHeader>
          {report && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Stat label="本次得分" value={`${report.meta.score}`} unit="分" />
              <Stat
                label="错题"
                value={`${report.meta.wrongCount}`}
                unit={`/ ${report.meta.totalCount}`}
              />
              <Stat
                label="分析时间"
                value={formatTime(report.meta.generatedAt)}
                unit=""
                tiny
              />
            </div>
          )}
          {report?.meta.cached && (
            <span className="absolute top-3 right-12 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/85 bg-white/15 border border-white/20 rounded-full px-2 py-0.5">
              <Clock className="w-3 h-3" /> 缓存
            </span>
          )}
        </div>

        {/* 内容区 */}
        <div className="px-6 py-5 sm:px-8 sm:py-7 space-y-6">
          {loading && !report && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <p className="mt-3 text-sm">AI 正在分析你的错题，预计需要 15-30 秒…</p>
              <p className="text-xs text-slate-400 mt-1">
                知识图谱 + 根因分类 + 学习建议
              </p>
            </div>
          )}

          {error && !report && (
            <div className="py-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">{error}</p>
              <p className="text-xs text-slate-500 mt-1">
                可能是网络问题或 AI 暂时繁忙
              </p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => fetchReport(false)}
              >
                <RefreshCcw className="w-4 h-4 mr-1" /> 重试
              </Button>
            </div>
          )}

          {report && (
            <>
              {/* 分数对照：把本次得分跟该年广东晋级 + 全国一/二/三等线
                  摆在一起, 学生一眼看到"差几分到晋级"或"已经摸到哪档"。
                  数据来源 /lib/csp-score-lines.ts (与 K线图共享)。 */}
              {(() => {
                const line = getScoreLine(report.meta.year, report.meta.group as CspGroup);
                if (!line) return null;
                const score = report.meta.score;
                const band = classifyAward(score, report.meta.year, report.meta.group as CspGroup);
                const passedPromotion = score >= line.promotion;
                const gap = (target: number) => {
                  const diff = score - target;
                  return diff >= 0
                    ? { text: `+${diff.toFixed(1)}`, passed: true }
                    : { text: diff.toFixed(1), passed: false };
                };
                const awardColor = AWARD_COLOR[band];
                return (
                  <div
                    className="rounded-2xl border-2 p-4 sm:p-5"
                    style={{
                      borderColor: awardColor,
                      background: `linear-gradient(135deg, ${awardColor}10 0%, transparent 100%)`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4" style={{ color: awardColor }} />
                      <span className="text-sm font-semibold text-slate-800">
                        本次得分对照
                      </span>
                      <span
                        className="ml-auto text-xs font-semibold rounded-full px-2.5 py-0.5"
                        style={{
                          color: awardColor,
                          background: `${awardColor}1A`,
                          border: `1px solid ${awardColor}55`,
                        }}
                      >
                        {AWARD_LABEL[band]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['promotion', 'first', 'second', 'third'] as const).map((k) => {
                        const meta = SCORE_LINE_META[k];
                        const g = gap(line[k]);
                        return (
                          <div
                            key={k}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 mb-1">
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full"
                                style={{ background: meta.color }}
                                aria-hidden="true"
                              />
                              {meta.label.replace('线', '')}
                            </div>
                            <div className="text-base font-bold text-slate-800 tabular-nums">
                              {line[k]}
                            </div>
                            <div
                              className={
                                'text-[11px] tabular-nums ' +
                                (g.passed ? 'text-emerald-600' : 'text-rose-500')
                              }
                            >
                              {g.passed ? `已超过 ${g.text}` : `还差 ${Math.abs(parseFloat(g.text)).toFixed(1)}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
                      {passedPromotion
                        ? `🎉 你的 ${score} 分已经超过该年广东晋级线（${line.promotion}），可以去复赛。`
                        : `距离广东晋级线还差 ${(line.promotion - score).toFixed(1)} 分，建议针对性补强薄弱知识点后再挑战。`}
                    </p>
                  </div>
                );
              })()}

              {/* 板块 1：总诊断 */}
              <Section
                icon={<Target className="w-4 h-4" />}
                title="总体诊断"
                accent="from-violet-500/15 to-fuchsia-500/5 border-violet-200/60"
                badgeClass="bg-violet-100 text-violet-700"
              >
                <p className="text-[15px] leading-relaxed text-slate-800 font-medium">
                  {report.overallDiagnosis}
                </p>
              </Section>

              {/* 板块 2：薄弱知识点 */}
              {report.weakKnowledgePoints.length > 0 && (
                <Section
                  icon={<AlertCircle className="w-4 h-4" />}
                  title="薄弱知识点"
                  accent="from-rose-500/15 to-amber-500/5 border-rose-200/60"
                  badgeClass="bg-rose-100 text-rose-700"
                  badge={`${report.weakKnowledgePoints.length} 个`}
                >
                  <div className="space-y-3">
                    {report.weakKnowledgePoints.map((kp, i) => {
                      const sev = SEVERITY_META[kp.severity];
                      return (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              {kp.topic}
                            </span>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${sev.chip}`}
                            >
                              {sev.label}
                            </span>
                            <span className="text-xs text-slate-500 tabular-nums ml-auto">
                              错 {kp.wrongCount} / {kp.totalCount} 题 · 正确率 {kp.accuracy}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${sev.bar}`}
                              style={{ width: `${kp.accuracy}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* 板块 3：根因分析 */}
              {report.rootCauses.length > 0 && (
                <Section
                  icon={<Stethoscope className="w-4 h-4" />}
                  title="根因分析"
                  accent="from-indigo-500/15 to-sky-500/5 border-indigo-200/60"
                  badgeClass="bg-indigo-100 text-indigo-700"
                  badge={`${report.rootCauses.length} 类`}
                >
                  <div className="space-y-3">
                    {report.rootCauses.map((rc, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider rounded-full border px-2 py-0.5 ${
                              ROOT_CAUSE_COLOR[rc.type]
                            }`}
                          >
                            {ROOT_CAUSE_LABEL[rc.type] || rc.label}
                          </span>
                          <span className="text-xs text-slate-500">
                            影响 {rc.affectedQuestionIds.length} 题
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {rc.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 板块 4：下一步建议 */}
              {report.nextSteps.length > 0 && (
                <Section
                  icon={<ListChecks className="w-4 h-4" />}
                  title="下一步学习建议"
                  accent="from-emerald-500/15 to-teal-500/5 border-emerald-200/60"
                  badgeClass="bg-emerald-100 text-emerald-700"
                  badge={`${report.nextSteps.length} 条`}
                >
                  <ol className="space-y-2.5">
                    {report.nextSteps.map((s, i) => {
                      const priorityStyles =
                        s.priority === 1
                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                          : s.priority === 2
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-sky-100 text-sky-700 border-sky-200';
                      return (
                        <li
                          key={i}
                          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                        >
                          <span
                            className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${priorityStyles}`}
                          >
                            P{s.priority}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800">
                              {s.action}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                              {s.rationale}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Section>
              )}

              {/* 板块 5：错题逐题详解 & AI 答疑 (per-question Q&A)。
                  数据来自 report.meta.wrongQuestions, 整体报告接口
                  一次性返回。Q&A 调用 /api/csp-quiz/qa, 同一题 + 同
                  一提问 5 分钟内复用。 */}
              {report.meta.wrongQuestions.length > 0 && (
                <Section
                  icon={<MessageCircle className="w-4 h-4" />}
                  title="错题逐题详解 & AI 答疑"
                  accent="from-sky-500/15 to-cyan-500/5 border-sky-200/60"
                  badgeClass="bg-sky-100 text-sky-700"
                  badge={`${report.meta.wrongQuestions.length} 题`}
                >
                  <WrongQuestionList
                    questions={report.meta.wrongQuestions}
                    classroomId={report.meta.classroomId}
                  />
                </Section>
              )}

              {/* 报告为空时的兜底：所有板块都为空 */}
              {report.weakKnowledgePoints.length === 0 &&
                report.rootCauses.length === 0 &&
                report.nextSteps.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    本次 AI 没有给出具体细分建议，仅总诊断如上。
                  </p>
                )}

              {/* 底部操作区 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <p className="text-[11px] text-slate-400">
                  本报告由 AI 生成，仅供参考。具体知识点请以官方教材为准。
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchReport(true)}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-3.5 h-3.5 mr-1" />
                  )}
                  重新分析
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon,
  title,
  badge,
  badgeClass,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeClass?: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-gradient-to-br ${accent} px-5 py-4`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/70 text-slate-700 ring-1 ring-slate-200/60">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {badge && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${badgeClass ?? 'bg-slate-100 text-slate-700'}`}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  tiny,
}: {
  label: string;
  value: string;
  unit?: string;
  tiny?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/75">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline justify-center gap-1">
        <span className={`font-bold text-white tabular-nums ${tiny ? 'text-sm' : 'text-xl'}`}>
          {value}
        </span>
        {unit && (
          <span className="text-[11px] text-white/80 tabular-nums">{unit}</span>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ── 错题逐题列表 + AI 答疑 ───────────────────────────────────────

type WrongQuestion = Report['meta']['wrongQuestions'][number];

const CATEGORY_LABEL: Record<
  NonNullable<WrongQuestion['sceneCategory']>,
  string
> = {
  choice: '单项选择',
  read: '阅读程序',
  perfect: '完善程序',
};

function WrongQuestionList({
  questions,
  classroomId,
}: {
  questions: WrongQuestion[];
  classroomId: string;
}) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <WrongQuestionCard
          key={q.id}
          index={i + 1}
          question={q}
          classroomId={classroomId}
        />
      ))}
    </div>
  );
}

function WrongQuestionCard({
  index,
  question,
  classroomId,
}: {
  index: number;
  question: WrongQuestion;
  classroomId: string;
}) {
  const [showQa, setShowQa] = useState(false);
  // pendingQuestion: 父组件 (这里就是卡片本身) 给 QaChat 投递的"待
  // 发"问题。点击下方话术 chip 时, 先把它设上, 再展开聊天 — QaChat
  // 的 useEffect 监听到变化后自动 send, 然后回调 onPendingConsumed
  // 把这个 prop 清空, 避免重复触发。
  const [pendingQuestion, setPendingQuestion] = useState<string>('');
  const cat = question.sceneCategory;
  const isChoice = cat === 'choice';

  // 点话术 chip 的一站式行为: 展开聊天 + 投递问题。
  // 同一句再次点击会被 QaChat 的 lastPendingRef 去重, 不会重复发。
  const askSuggestion = (q: string) => {
    setShowQa(true);
    setPendingQuestion(q);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* 题目区：题干 + 选项 + 答案对比 */}
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs font-bold">
            {index}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {cat ? CATEGORY_LABEL[cat] : '其他'}
          </span>
          <span className="text-[10px] text-slate-400">
            {question.sceneTitle} · {question.points} 分
          </span>
        </div>

        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
          {question.text}
        </p>

        {isChoice && question.options.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {question.options.map((o) => {
              const isCorrect = Array.isArray(question.correctAnswer)
                ? question.correctAnswer.includes(o.value)
                : question.correctAnswer === o.value;
              const isUser =
                (Array.isArray(question.userAnswer)
                  ? question.userAnswer.includes(o.value)
                  : question.userAnswer === o.value) && !isCorrect;
              return (
                <li
                  key={o.value || o.label}
                  className={
                    'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs ' +
                    (isCorrect
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                      : isUser
                        ? 'border-rose-200 bg-rose-50/70 text-rose-700 line-through decoration-rose-300'
                        : 'border-slate-200 bg-slate-50/40 text-slate-700')
                  }
                >
                  <span className="font-mono font-semibold shrink-0 w-4">
                    {o.label}
                  </span>
                  <span className="flex-1">{o.text}</span>
                  {isCorrect && (
                    <span className="text-[10px] font-semibold text-emerald-600 shrink-0">
                      ✓ 正解
                    </span>
                  )}
                  {isUser && (
                    <span className="text-[10px] font-semibold text-rose-500 shrink-0">
                      你的选择
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-2.5 py-1.5">
            <div className="text-[10px] font-semibold text-emerald-700 mb-0.5">
              正确答案
            </div>
            <div className="text-emerald-800 font-mono">
              {Array.isArray(question.correctAnswer)
                ? question.correctAnswer.join(', ')
                : question.correctAnswer || '—'}
            </div>
          </div>
          <div className="rounded-lg border border-rose-100 bg-rose-50/40 px-2.5 py-1.5">
            <div className="text-[10px] font-semibold text-rose-700 mb-0.5">
              你的答案
            </div>
            <div className="text-rose-700 font-mono">
              {Array.isArray(question.userAnswer)
                ? question.userAnswer.join(', ')
                : question.userAnswer || '未作答'}
            </div>
          </div>
        </div>

        {question.analysis && (
          <div className="mt-2.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-700">原题解析：</span>
            {question.analysis}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={showQa ? 'default' : 'outline'}
            className={
              showQa
                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600'
                : ''
            }
            onClick={() => setShowQa((v) => !v)}
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
            问 AI
            {showQa ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1" />
            )}
          </Button>
          <span className="text-[11px] text-slate-500">
            没看懂? 下面任选一句直接发给 AI 老师
          </span>
        </div>

        {/* 话术 chip 区 — 这是用户提到的"更明显的指引"。即使
            聊天还没展开, 学生也能一眼看到建议的问法, 点一下
            就同时打开聊天 + 自动发送, 减少"我不会问"的门槛。
            不展示所有 5 句, 取前 3 句最常用的, 其余进聊天里还有。 */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => askSuggestion(q)}
              className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] text-sky-800 hover:bg-sky-100 hover:border-sky-300 transition-colors"
            >
              <Lightbulb className="w-3 h-3" />
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* AI 答疑区：展开后内联渲染聊天 */}
      {showQa && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
          <QaChat
            classroomId={classroomId}
            question={question}
            pendingQuestion={pendingQuestion}
            onPendingConsumed={() => setPendingQuestion('')}
          />
        </div>
      )}
    </div>
  );
}

// 单题 AI 答疑：内联 chat, history 跟当前题目绑定, 关闭后保留但
// 不会跨题目共享。每次 send 调 /api/csp-quiz/qa, 把之前的对话历史
// 一起发给后端, 让 LLM 看到完整上下文。
type QaMessage = {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
};

// 卡片里展示的快捷问句 + 聊天初次打开时的推荐话术。
// 设计原则：贴近学生真实口语, 而不是"解题八股" — "为什么不对" /
// "知识点是啥"这种太书面, 学生平时不会这样说话。下面这一组更像
// 一个真实学生问老师的话: "给我讲讲", "我没懂", "再细一点" …
const SUGGESTED_QUESTIONS = [
  '给我讲解一下这道题',
  '有点不懂，能再详细一点吗？',
  '为什么选这个答案？',
  '能再讲讲这个知识点吗？',
  '还有类似的题目吗？',
];

function QaChat({
  classroomId,
  question,
  pendingQuestion,
  onPendingConsumed,
}: {
  classroomId: string;
  question: WrongQuestion;
  /**
   * 父组件 (WrongQuestionCard) 可以通过这个 prop 触发"一键提问":
   * 把它设成一句话 (例如点了一个建议话术 chip), QaChat 内部会在
   * pendingQuestion 变化时自动 send 一次, 然后调用 onPendingConsumed
   * 让父组件清空这个 prop, 这样学生点同一句不会重复发。
   */
  pendingQuestion?: string;
  onPendingConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 哪一条 AI 消息正在被 TTS 朗读. 一个聊天里只允许一个 TTS 在播,
  // 新的会打断旧的 (useBrowserTTS.speak 内部 cancel 上一个).
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);

  // 读全局 TTS 设置 (静音 / 音量 / 语速). 没有从 settings 里读 enabled,
  // 因为即便全局禁用了, 答疑区的朗读仍可手动开启 (跟其它"主动触发"
  // 的 TTS 行为一致 —— 学生在阅读 AI 长文时希望可以听一遍)。
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);

  const {
    speak: ttsSpeak,
    pause: ttsPause,
    resume: ttsResume,
    cancel: ttsCancel,
    isSpeaking,
    isPaused,
  } = useBrowserTTS({
    rate: ttsSpeed,
    volume: ttsMuted ? 0 : ttsVolume,
    lang: 'zh-CN',
    onEnd: () => setSpeakingMsgId(null),
    onError: () => setSpeakingMsgId(null),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // 组件卸载时取消正在播的 TTS, 避免遗留朗读 (切到别的题目或关闭报告
  // 的时候还听到上一个 AI 在说话, 体验很怪)。
  useEffect(() => {
    return () => {
      ttsCancel();
    };
  }, [ttsCancel]);

  // 监听 pendingQuestion: 父组件点了一个建议话术 → 这里自动 send。
  // 用 ref 记录上次消费过的值, 防止 React 18 严格模式下 effect 重跑
  // 造成重复 send。
  const lastPendingRef = useRef<string | null>(null);
  useEffect(() => {
    const q = (pendingQuestion ?? '').trim();
    if (!q) return;
    if (lastPendingRef.current === pendingQuestion) return;
    lastPendingRef.current = pendingQuestion;
    void send(q);
    onPendingConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > 600) {
      setMessages((m) => [
        ...m,
        { role: 'user', content: trimmed },
        {
          role: 'assistant',
          content: '问题太长, 请控制在 600 字符以内再提问。',
          error: true,
        },
      ]);
      setInput('');
      return;
    }
    const userMsg: QaMessage = { role: 'user', content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/csp-quiz/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId,
          questionId: question.id,
          userQuestion: trimmed,
          // 发送前序对话, 让 LLM 看到上下文 (后端会再截断到 8 轮)
          history: nextHistory
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: json.answer as string },
      ]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: e?.message ?? 'AI 答疑失败, 请稍后再试',
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // AI 回复的 TTS 控制 — 同一时刻只允许一个消息在播。
  // 行为：
  //   - 空闲时点 🔊      → speak(content), 把 speakingMsgId 设为 i
  //   - 正在播同一条时点  → pause
  //   - 暂停时点 ▶        → resume
  //   - 正在播时点 🔊     → cancel + speak(content) (从头开始)
  const handleSpeak = (idx: number, content: string) => {
    if (speakingMsgId === idx) {
      if (isPaused) {
        ttsResume();
      } else {
        ttsPause();
      }
      return;
    }
    ttsCancel();
    setSpeakingMsgId(idx);
    ttsSpeak(content);
  };

  return (
    <div>
      {/* 对话历史 */}
      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto pr-1 space-y-2 mb-3"
      >
        {messages.length === 0 && (
          <div className="rounded-lg border border-sky-200/70 bg-sky-50/40 px-3 py-2.5 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 text-sky-700 font-semibold">
              <Lightbulb className="w-3.5 h-3.5" />
              点下面任一话术, 直接向 AI 老师提问
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="px-2.5 py-1 rounded-full bg-white border border-sky-200 text-slate-700 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-800 transition-colors text-[11px]"
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              也可以在下方输入框自由提问 (⌘/Ctrl+Enter 发送), AI 会
              针对这一题作答。
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')
            }
          >
            <div
              className={
                'max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line ' +
                (m.role === 'user'
                  ? 'bg-sky-500 text-white rounded-br-sm'
                  : m.error
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 rounded-bl-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm')
              }
            >
              <div>{m.content}</div>
              {/* AI 回复才有朗读按钮: user 不朗读自己的话; error 状态
                  的也算"AI 回复", 但学生一般不需要听报错, 仍给个
                  按钮方便看不动的用户听。 */}
              {m.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => handleSpeak(i, m.content)}
                  title={
                    speakingMsgId === i
                      ? isPaused
                        ? '继续朗读'
                        : '暂停朗读'
                      : '朗读这条 AI 回复'
                  }
                  aria-label={
                    speakingMsgId === i
                      ? isPaused
                        ? '继续朗读'
                        : '暂停朗读'
                      : '朗读这条 AI 回复'
                  }
                  className={
                    'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ' +
                    (speakingMsgId === i && isSpeaking && !isPaused
                      ? 'bg-sky-100 text-sky-700 border border-sky-200 hover:bg-sky-200'
                      : speakingMsgId === i && isPaused
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                        : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200')
                  }
                >
                  {speakingMsgId === i && isSpeaking && !isPaused ? (
                    <>
                      <Pause className="w-3 h-3" />
                      朗读中… 点这里暂停
                    </>
                  ) : speakingMsgId === i && isPaused ? (
                    <>
                      <Play className="w-3 h-3" />
                      已暂停, 点这里继续
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3" />
                      朗读
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              AI 正在思考…
            </div>
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="针对这一题提问, ⌘/Ctrl+Enter 发送"
          rows={2}
          maxLength={600}
          disabled={sending}
          className="flex-1 resize-none text-sm"
        />
        <Button
          size="sm"
          onClick={() => send(input)}
          disabled={sending || input.trim().length === 0}
          className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 h-auto px-3 py-2"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// 静默抑制未使用的导入 (X 在某些代码路径下会用到)
void X;
void CheckCircle2;
