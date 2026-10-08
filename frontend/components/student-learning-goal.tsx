'use client';

import { useCallback, useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type GoalType = 'practice_questions' | 'perfect_quiz_scenes';
type Goal = { goalType: GoalType; target: number; updatedAt: string } | null;
type GoalResponse = { goal: Goal; progress: number };

const TARGETS: Record<GoalType, number[]> = {
  practice_questions: [5, 10, 15],
  perfect_quiz_scenes: [1, 2, 3],
};

async function readResponse(response: Response): Promise<GoalResponse> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? '目标暂时无法保存，请稍后重试。');
  }
  return data as GoalResponse;
}

export function StudentLearningGoal() {
  const [goal, setGoal] = useState<Goal>(null);
  const [progress, setProgress] = useState(0);
  const [goalType, setGoalType] = useState<GoalType>('practice_questions');
  const [target, setTarget] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResponse = useCallback((data: GoalResponse) => {
    setGoal(data.goal);
    setProgress(data.progress);
    if (data.goal) {
      setGoalType(data.goal.goalType);
      setTarget(data.goal.target);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/student/goal', { cache: 'no-store' })
      .then(readResponse)
      .then((data) => {
        if (active) applyResponse(data);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '加载目标失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyResponse]);

  const onGoalTypeChange = (nextType: GoalType) => {
    setGoalType(nextType);
    setTarget(TARGETS[nextType][0]);
  };

  const saveGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/student/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalType, target }),
      });
      applyResponse(await readResponse(response));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '目标暂时无法保存，请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const goalLabel =
    goalType === 'practice_questions' ? '完成答题（含订正）' : '测验场景全对';
  const progressPct = goal ? Math.min(100, Math.round((progress / goal.target) * 100)) : 0;

  return (
    <Card className="max-w-6xl mx-auto border-slate-200/80 shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">我的本周目标</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          由你来选目标。进度按最近七天统计，可以随时调整，不会因为没完成而清零。
        </p>

        {goal && (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-slate-800">
                {goalLabel}：{Math.min(progress, goal.target)} / {goal.target}
                {goalType === 'practice_questions' ? ' 题' : ' 个场景'}
              </span>
              <span className="text-xs text-slate-500">
                {progress >= goal.target ? '目标已达成，可以继续或调整目标。' : '按自己的节奏继续。'}
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white"
              role="progressbar"
              aria-label="本周目标进度"
              aria-valuemin={0}
              aria-valuemax={goal.target}
              aria-valuenow={Math.min(progress, goal.target)}
            >
              <div
                className="h-full rounded-full bg-indigo-500 transition-[width]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <form onSubmit={saveGoal} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-1.5 text-sm font-medium text-slate-700">
            目标内容
            <select
              value={goalType}
              onChange={(event) => onGoalTypeChange(event.target.value as GoalType)}
              disabled={loading || saving}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="practice_questions">完成答题（含订正）</option>
              <option value="perfect_quiz_scenes">测验场景全对</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            本周目标
            <select
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
              disabled={loading || saving}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              {TARGETS[goalType].map((value) => (
                <option key={value} value={value}>
                  {value}{goalType === 'practice_questions' ? ' 题' : ' 个场景'}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={loading || saving}>
            {saving ? '正在保存…' : goal ? '调整目标' : '设定目标'}
          </Button>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      </CardContent>
    </Card>
  );
}
