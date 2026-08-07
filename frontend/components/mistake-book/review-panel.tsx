'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  ListChecks,
  PartyPopper,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  computeReviewStage,
  REVIEW_STAGE_LABELS,
  reviewProgressSteps,
  type ReviewStage,
} from '@/lib/mistake-book/review';
import type { MistakeBookItem } from '@/lib/mistake-book/api';

import { Stage1Cause } from './stage-1-cause';
import { Stage2Solution } from './stage-2-solution';
import { Stage3Variant } from './stage-3-variant';

interface ReviewPanelProps {
  item: MistakeBookItem;
  /**
   * 当父组件 (错题卡片) 收到最新的 item 时, 用这个回调把"已掌握"
   * 状态冒泡上去 — 父组件再决定是否自动 toggle resolved.
   * 不强制父组件做, 父组件可以忽略, 让学生自己手动 toggle.
   */
  onItemUpdate: (next: MistakeBookItem) => void;
  /** 三段都完成 (reviewedAt 已打) 时, 父组件可一键"标记掌握". */
  onMarkMastered?: () => void;
}

type StepNumber = 1 | 2 | 3;

/**
 * 从 review stage 推出"当前激活段" (1/2/3). 默认:
 *   - not_started        → 1
 *   - cause_recorded     → 2
 *   - solution_ready     → 3
 *   - variant_ready      → 3
 *   - variant_attempted  → 3
 *   - mastered           → 3
 */
function stageToActiveStep(stage: ReviewStage): StepNumber {
  switch (stage) {
    case 'not_started':
    case 'cause_recorded':
      return stage === 'cause_recorded' ? 2 : 1;
    case 'solution_ready':
    case 'variant_ready':
    case 'variant_attempted':
    case 'mastered':
      return 3;
  }
}

/**
 * 错题三段复盘面板:
 *   1. 错因自述
 *   2. AI 标准正解
 *   3. 同类变式题 + 判分
 *
 * 三段全部完成 (reviewedAt 被打) → 提示"已掌握", 父组件可自动 toggle.
 */
export function ReviewPanel({ item, onItemUpdate, onMarkMastered }: ReviewPanelProps) {
  const stage = computeReviewStage(item);
  const { done, total } = reviewProgressSteps(stage);
  const [activeStep, setActiveStep] = useState<StepNumber>(() =>
    stageToActiveStep(stage),
  );

  // 当 item 变化 (例如阶段推进) 但当前激活步骤已经完成, 自动跳到下一步.
  // 这样父组件只需要更新 item, 不用关心下一步的导航.
  useEffect(() => {
    const next = stageToActiveStep(stage);
    if (next > activeStep) {
      setActiveStep(next);
    }
  }, [stage, activeStep]);

  return (
    <div className="grid gap-4 rounded-2xl border bg-card/40 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="h-4 w-4 text-primary" />
          三段复盘
        </div>
        <Badge variant={stage === 'mastered' ? 'default' : 'secondary'}>
          {REVIEW_STAGE_LABELS[stage]}
        </Badge>
      </header>

      <Progress value={(done / total) * 100} />

      {/* 步骤指示器 */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {STEP_META.map((s) => {
          const completed = done >= s.idx;
          const active = activeStep === s.idx;
          return (
            <li key={s.idx}>
              <button
                type="button"
                onClick={() => setActiveStep(s.idx)}
                className={[
                  'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                <StepIcon completed={completed} active={active} />
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{s.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {s.subtitle}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <Separator />

      {/* 阶段主体 */}
      {activeStep === 1 ? (
        <Stage1Cause
          item={item}
          onUpdated={onItemUpdate}
          onAdvance={() => setActiveStep(2)}
        />
      ) : null}

      {activeStep === 2 ? (
        <Stage2Solution
          item={item}
          onUpdated={onItemUpdate}
          onBack={() => setActiveStep(1)}
          onAdvance={() => setActiveStep(3)}
        />
      ) : null}

      {activeStep === 3 ? (
        <Stage3Variant
          item={item}
          onUpdated={onItemUpdate}
          onBack={() => setActiveStep(2)}
          onCompleted={() => {
            // 父组件可以一键"标记掌握" (前端 toggle)
            onMarkMastered?.();
          }}
        />
      ) : null}

      {/* 三段完成态提示 */}
      {stage === 'mastered' ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <PartyPopper className="h-4 w-4" />
            三段复盘完成, 这道题你已经真正掌握了.
          </div>
          {onMarkMastered ? (
            <Button size="sm" variant="outline" onClick={onMarkMastered}>
              标记掌握
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STEP_META: Array<{ idx: StepNumber; title: string; subtitle: string }> = [
  { idx: 1, title: '错因自述', subtitle: '我错在哪一类, 当时怎么想的' },
  { idx: 2, title: 'AI 正解', subtitle: '看 AI 怎么解这道题' },
  { idx: 3, title: '同类变式', subtitle: '做一道同型题巩固' },
];

function StepIcon({
  completed,
  active,
}: {
  completed: boolean;
  active: boolean;
}) {
  if (completed) {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  }
  if (active) {
    return <CircleDot className="h-5 w-5 text-primary" />;
  }
  return <Circle className="h-5 w-5 text-muted-foreground/40" />;
}
