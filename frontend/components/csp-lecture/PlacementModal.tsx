'use client';

/**
 * PlacementModal — CSP 初赛水平摸底表单
 *
 * Single-page long form (per user feedback 2026-07-27). The 5 base
 * questions + 6 contest blocks (province, CSP-J1, CSP-S1, CSP-J2,
 * CSP-S2, GESP, other contests) all live on one scrollable page;
 * no step-by-step wizard. Submit POSTs the form to
 * `/api/csp-quiz/placement` and re-fetches the canonical record so
 * the parent `PlacementBanner` gets a complete `placement` object.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

type PlacementAnswers = {
  grade: string;
  studyMonths: string;
  selfRating: string;
  goal: string;
  hoursPerWeek: string;
  province: string | null;
  cspJ1: { year: number; score: number } | null;
  cspS1: { year: number; score: number } | null;
  cspJ2: { year: number; rank: string } | null;
  cspS2: { year: number; rank: string } | null;
  gesp: { year: number; level: number; passed: boolean } | null;
  otherContests: string | null;
};

const YEARS = ['2025', '2024', '2023', '2022', '2021'];
const NO_PARTICIPATED = '__none__';

const GRADES = ['初一', '初二', '初三', '高一', '高二', '高三'];
const STUDY = [
  { v: 'lt3', l: '<3 个月' },
  { v: '3-6', l: '3-6 个月' },
  { v: '6-12', l: '6-12 个月' },
  { v: '12-24', l: '1-2 年' },
  { v: 'gt24', l: '2 年以上' },
];
const RATING = [
  { v: 'low', l: '入门' },
  { v: 'mid', l: '中级' },
  { v: 'high', l: '高级' },
];
const GOAL = [
  { v: 'pass-j1', l: '通过 J1' },
  { v: 'pass-j2', l: '通过 J2' },
  { v: 'high-rank', l: '争取高名次' },
  { v: 'try-best', l: '全力以赴' },
];
const HOURS = [
  { v: 'lt2', l: '<2 小时' },
  { v: '2-5', l: '2-5 小时' },
  { v: '5-10', l: '5-10 小时' },
  { v: 'gt10', l: '10+ 小时' },
];
// CSP 复赛奖项只有一等奖 / 二等奖 / 三等奖 三档，不再区分省奖和国奖。
// 跟 lib/server/csp-placement.ts 的 PlacementAnswers.cspJ2/cspS2
// 字面量联合 + route.ts 的 VALID_RANKS 三处保持一致。
const RANKS = ['一等奖', '二等奖', '三等奖'];
const GESP_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];

const PROVINCES = [
  '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
  '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾',
  '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门',
];

export type PlacementResponse = {
  level: 'beginner' | 'intermediate' | 'advanced';
  recommendedIds: string[];
  aiReason: string;
  aiStatus: 'ok' | 'fallback' | 'pending';
  updatedAt: string;
};

export function PlacementModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: (placement: PlacementResponse) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PlacementAnswers>({
    grade: '初二',
    studyMonths: '6-12',
    selfRating: 'mid',
    goal: 'pass-j1',
    hoursPerWeek: '2-5',
    province: null,
    cspJ1: null,
    cspS1: null,
    cspJ2: null,
    cspS2: null,
    gesp: null,
    otherContests: null,
  });

  const update = <K extends keyof PlacementAnswers>(
    key: K,
    value: PlacementAnswers[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  // Contest blocks share the same update path. BlockValue is a
  // generic `{ year, [k]: v }` shape (year-only after picking
  // a year; full record after the user fills in score/rank/...).
  // We cast to the specific contest-block type at the call
  // site; the field-specific extraField reads from `form` so
  // the cast doesn't lose data.
  const updateBlock = <K extends keyof PlacementAnswers>(
    key: K,
    value: BlockValue,
  ) => update(key, value as PlacementAnswers[K]);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/csp-quiz/placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || '提交失败');
      }
      // Re-fetch the canonical record so we get a row with
      // the final aiStatus / recommendedIds (which the POST
      // also returns, but going through GET is the same
      // path the banner uses on initial load — keeps the
      // shapes identical).
      const get = await fetch('/api/csp-quiz/placement');
      const getData = await get.json();
      if (!getData.placement) {
        throw new Error('提交后无法读取结果');
      }
      onSubmitted(getData.placement);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '提交失败，请重试';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <h2 className="text-lg font-bold text-slate-900">
              CSP 初赛水平摸底
            </h2>
            <button
              onClick={onClose}
              aria-label="关闭"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* 基础信息 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                📋 基础信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="年级">
                  <select
                    value={form.grade}
                    onChange={(e) => update('grade', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="学 C++ 时长">
                  <select
                    value={form.studyMonths}
                    onChange={(e) => update('studyMonths', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    {STUDY.map((s) => (
                      <option key={s.v} value={s.v}>
                        {s.l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="自评水平">
                  <select
                    value={form.selfRating}
                    onChange={(e) => update('selfRating', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    {RATING.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="目标">
                  <select
                    value={form.goal}
                    onChange={(e) => update('goal', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    {GOAL.map((g) => (
                      <option key={g.v} value={g.v}>
                        {g.l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="每周投入">
                  <select
                    value={form.hoursPerWeek}
                    onChange={(e) => update('hoursPerWeek', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    {HOURS.map((h) => (
                      <option key={h.v} value={h.v}>
                        {h.l}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            {/* 比赛成绩 */}
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                🏆 比赛成绩（可选）
              </h3>
              <div className="space-y-3">
                <Field label="省份">
                  <select
                    value={form.province ?? ''}
                    onChange={(e) =>
                      update('province', e.target.value || null)
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">不填</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>

                <ContestBlock
                  label="CSP-J1 初赛"
                  value={form.cspJ1}
                  onChange={(v) => updateBlock('cspJ1', v)}
                  extraField={(year) => (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.cspJ1?.score ?? ''}
                      onChange={(e) =>
                        update('cspJ1', {
                          year: Number(year),
                          score: Number(e.target.value),
                        })
                      }
                      placeholder="分数 0-100"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  )}
                />

                <ContestBlock
                  label="CSP-S1 初赛"
                  value={form.cspS1}
                  onChange={(v) => updateBlock('cspS1', v)}
                  extraField={(year) => (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.cspS1?.score ?? ''}
                      onChange={(e) =>
                        update('cspS1', {
                          year: Number(year),
                          score: Number(e.target.value),
                        })
                      }
                      placeholder="分数 0-100"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  )}
                />

                <ContestBlock
                  label="CSP-J2 复赛"
                  value={form.cspJ2}
                  onChange={(v) => updateBlock('cspJ2', v)}
                  extraField={(year) => (
                    <select
                      value={form.cspJ2?.rank ?? ''}
                      onChange={(e) =>
                        update('cspJ2', {
                          year: Number(year),
                          rank: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">选择等级</option>
                      {RANKS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                />

                <ContestBlock
                  label="CSP-S2 复赛"
                  value={form.cspS2}
                  onChange={(v) => updateBlock('cspS2', v)}
                  extraField={(year) => (
                    <select
                      value={form.cspS2?.rank ?? ''}
                      onChange={(e) =>
                        update('cspS2', {
                          year: Number(year),
                          rank: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">选择等级</option>
                      {RANKS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                />

                <ContestBlock
                  label="GESP 等级"
                  value={form.gesp}
                  onChange={(v) => updateBlock('gesp', v)}
                  extraField={(year) => (
                    <div className="flex gap-2 items-center flex-wrap">
                      <select
                        value={form.gesp?.level ?? ''}
                        onChange={(e) =>
                          update('gesp', {
                            year: Number(year),
                            level: Number(e.target.value),
                            passed: form.gesp?.passed ?? true,
                          })
                        }
                        className="flex-1 min-w-[100px] rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="">级别</option>
                        {GESP_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l} 级
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.gesp?.passed ?? false}
                          onChange={(e) =>
                            update('gesp', {
                              year: Number(year),
                              level: form.gesp?.level ?? 1,
                              passed: e.target.checked,
                            })
                          }
                        />
                        已通过
                      </label>
                    </div>
                  )}
                />

                <Field label="其它奖项">
                  <input
                    type="text"
                    value={form.otherContests ?? ''}
                    onChange={(e) =>
                      update('otherContests', e.target.value || null)
                    }
                    placeholder="如：蓝桥杯省二 2024"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </Field>
              </div>
            </section>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-100 transition"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition disabled:opacity-50"
            >
              {submitting ? '分析中…' : '查看我的推荐 →'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-600 mb-1">{label}</div>
      {children}
    </label>
  );
}

type BlockValue = { year: number; [k: string]: unknown } | null;

function ContestBlock({
  label,
  value,
  onChange,
  extraField,
}: {
  label: string;
  value: BlockValue;
  onChange: (v: BlockValue) => void;
  extraField: (year: string) => React.ReactNode;
}) {
  const currentYear = value?.year ? String(value.year) : NO_PARTICIPATED;
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
      <div className="text-sm font-medium text-slate-700 mb-2">{label}</div>
      <div className="flex gap-2 items-center flex-wrap">
        <select
          value={currentYear}
          onChange={(e) => {
            if (e.target.value === NO_PARTICIPATED) onChange(null);
            else onChange({ year: Number(e.target.value) });
          }}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm bg-white"
        >
          <option value={NO_PARTICIPATED}>我没参加过</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {value && extraField(currentYear)}
      </div>
    </div>
  );
}
