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

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  classifyAward,
  getScoreLine,
  AWARD_LABEL,
  SCORE_LINE_META,
  AWARD_COLOR,
  type CspGroup,
} from '@/lib/csp-score-lines';

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

// 静默抑制未使用的导入 (X 在某些代码路径下会用到)
void X;
void CheckCircle2;
