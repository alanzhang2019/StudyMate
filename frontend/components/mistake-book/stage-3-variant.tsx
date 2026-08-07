'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  generateReviewVariant,
  submitReviewVariant,
  type MistakeBookItem,
  MistakeBookApiError,
} from '@/lib/mistake-book/api';

interface Stage3VariantProps {
  item: MistakeBookItem;
  onUpdated: (next: MistakeBookItem) => void;
  onBack: () => void;
  /** 三段全部完成, 通知外部可以标记掌握了 */
  onCompleted: () => void;
}

const MAX_ANSWER_LEN = 500;

/**
 * 第 3 段: 同类变式题.
 * - 显示变式题 + 答题区
 * - 提交 → 服务端 AI 判分
 * - 答对 → reviewedAt 自动打, 触发 onCompleted
 * - 答错 → 可重答 (复用同一个变式题) 或重新出题
 */
export function Stage3Variant({
  item,
  onUpdated,
  onBack,
  onCompleted,
}: Stage3VariantProps) {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState(item.variantUserAnswer ?? '');

  // 当变式题生成/重新生成时, 清空旧答案
  useEffect(() => {
    setAnswer(item.variantUserAnswer ?? '');
  }, [item.variantQuestion, item.variantUserAnswer]);

  // 当 reviewedAt 刚刚被打上 (variantResult=1), 通知外层
  useEffect(() => {
    if (item.reviewedAt) {
      onCompleted();
    }
    // 只在 reviewedAt 从无到有时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.reviewedAt]);

  const onGenerate = async (force: boolean) => {
    setGenerating(true);
    try {
      const res = await generateReviewVariant(item.id, { force });
      onUpdated(res.item);
    } catch (err) {
      const msg =
        err instanceof MistakeBookApiError ? err.message : '生成失败';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const onSubmit = async () => {
    const trimmed = answer.trim();
    if (!trimmed) {
      toast.error('请先写答案');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitReviewVariant(item.id, { userAnswer: trimmed });
      onUpdated(res.item);
      if (res.correct) {
        toast.success('答对了! 这道题你掌握了');
      } else {
        toast.error('不对, 看看反馈再试一次');
      }
    } catch (err) {
      const msg =
        err instanceof MistakeBookApiError ? err.message : '提交失败';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const question = item.variantQuestion;
  const lastResult = item.variantResult; // 0/1/null
  const isMastered = !!item.reviewedAt;

  return (
    <div className="grid gap-4">
      {/* 变式题题目 */}
      {question ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              同类变式题
            </h4>
            <Button
              variant="ghost"
              size="sm"
              disabled={generating || submitting}
              onClick={() => onGenerate(true)}
              title="换一道题"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="ml-1">换一题</span>
            </Button>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {question}
          </div>
          {item.variantAnswer ? (
            <p className="text-xs text-muted-foreground">
              提示: 这道题的答案是 <span className="font-mono">{item.variantAnswer}</span> —
              但你先别看, 自己做完再对.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            还没出变式题, AI 会根据原题和你的错因出一道同型的题.
          </p>
          <Button onClick={() => onGenerate(false)} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在出题…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                出变式题
              </>
            )}
          </Button>
        </div>
      )}

      {/* 答题区 */}
      {question ? (
        <div className="grid gap-2">
          <label
            htmlFor="review-variant-answer"
            className="text-sm font-medium text-foreground"
          >
            你的答案
          </label>
          <Textarea
            id="review-variant-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, MAX_ANSWER_LEN))}
            placeholder="写下你的完整解答过程和最终答案"
            rows={4}
            maxLength={MAX_ANSWER_LEN}
            disabled={submitting}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{answer.trim().length}/{MAX_ANSWER_LEN}</span>
            {lastResult === 0 ? (
              <span className="text-destructive">上次的答案是错的</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 判分反馈 */}
      {lastResult !== null && lastResult !== undefined ? (
        <div
          className={[
            'rounded-xl border p-3 text-sm',
            lastResult === 1
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
              : 'border-destructive/30 bg-destructive/5',
          ].join(' ')}
        >
          <div
            className={[
              'flex items-center gap-1.5 font-medium',
              lastResult === 1
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-destructive',
            ].join(' ')}
          >
            {lastResult === 1 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {lastResult === 1 ? '回答正确' : '回答错误'}
          </div>
          {item.variantAnswer ? (
            <p className="mt-1 text-xs text-muted-foreground">
              标准答案: <span className="font-mono">{item.variantAnswer}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={submitting}>
          ← 回到正解
        </Button>
        {question ? (
          isMastered ? (
            <Button variant="outline" onClick={() => onGenerate(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              已掌握 — 再做一道
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {lastResult === 0 ? (
                <Button
                  variant="outline"
                  onClick={() => onGenerate(true)}
                  disabled={submitting}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  换一题
                </Button>
              ) : null}
              <Button
                onClick={onSubmit}
                disabled={!answer.trim() || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    判分中…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {lastResult === 0 ? '重答' : '提交'}
                  </>
                )}
              </Button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
