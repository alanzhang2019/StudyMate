'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  saveReviewCause,
  type MistakeBookItem,
  MistakeBookApiError,
} from '@/lib/mistake-book/api';
import {
  ERROR_CAUSE_CATEGORIES,
  type ErrorCauseCategory,
} from '@/lib/mistake-book/review';

interface Stage1CauseProps {
  item: MistakeBookItem;
  onUpdated: (next: MistakeBookItem) => void;
  /** 走完后切到第 2 段 */
  onAdvance: () => void;
}

const MAX_CAUSE_LEN = 500;

/**
 * 第 1 段: 错因自述.
 * - 选择错因分类 (4 选 1)
 * - 写一句"我做错在哪里" (50-500 字)
 * - 提交 → 触发 onAdvance (切到第 2 段)
 */
export function Stage1Cause({ item, onUpdated, onAdvance }: Stage1CauseProps) {
  const [category, setCategory] = useState<ErrorCauseCategory | ''>(
    (item.errorCauseCategory as ErrorCauseCategory | null) ?? '',
  );
  const [cause, setCause] = useState(item.errorCause ?? '');
  const [submitting, setSubmitting] = useState(false);

  const trimmedCause = cause.trim();
  const causeValid = trimmedCause.length >= 5;
  const canSubmit = !!category && causeValid && !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !category) return;
    setSubmitting(true);
    try {
      const res = await saveReviewCause(item.id, {
        cause: trimmedCause,
        category,
      });
      onUpdated(res.item);
      toast.success('错因已记录, 接下来看 AI 怎么解这道题');
      onAdvance();
    } catch (err) {
      const msg = err instanceof MistakeBookApiError ? err.message : '保存失败';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label className="text-sm font-medium text-foreground">
          1. 这道题你觉得自己错在哪?
        </Label>
        <p className="text-xs text-muted-foreground">
          先选一个分类, 再用一两句话描述你当时的思路.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ERROR_CAUSE_CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                disabled={submitting}
                onClick={() => setCategory(c.value)}
                className={[
                  'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  'hover:border-primary/60 disabled:opacity-50',
                  active
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground',
                ].join(' ')}
              >
                <div className="font-medium">{c.label.split(' (')[0]}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {c.label.match(/\(([^)]+)\)/)?.[1] ?? ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="review-cause-text" className="text-sm font-medium text-foreground">
          2. 当时是怎么想的? (可选, 越具体越有用)
        </Label>
        <Textarea
          id="review-cause-text"
          value={cause}
          onChange={(e) => setCause(e.target.value.slice(0, MAX_CAUSE_LEN))}
          placeholder="例如: 我用对了公式, 但代入时把 3 当成了 4, 算到最后才发现不对…"
          rows={4}
          maxLength={MAX_CAUSE_LEN}
          disabled={submitting}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {causeValid
              ? `已写 ${trimmedCause.length} 字`
              : '至少 5 个字, 让 AI 能针对性讲解'}
          </span>
          <span>{trimmedCause.length}/{MAX_CAUSE_LEN}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="min-w-32"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              保存中…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              下一步: 看 AI 正解
            </>
          )}
        </Button>
      </div>

      {item.errorCauseCategory && !submitting ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          第 1 段已记录 — 想改可以重新点提交
        </p>
      ) : null}
    </div>
  );
}
