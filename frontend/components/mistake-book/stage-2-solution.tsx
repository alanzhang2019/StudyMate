'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  generateReviewSolution,
  type MistakeBookItem,
  MistakeBookApiError,
} from '@/lib/mistake-book/api';
import { ERROR_CAUSE_CATEGORIES } from '@/lib/mistake-book/review';

interface Stage2SolutionProps {
  item: MistakeBookItem;
  onUpdated: (next: MistakeBookItem) => void;
  onAdvance: () => void;
  onBack: () => void;
}

const categoryLabel = (value: string | null | undefined): string => {
  if (!value) return '未分类';
  return (
    ERROR_CAUSE_CATEGORIES.find((c) => c.value === value)?.label.split(' (')[0] ??
    value
  );
};

/**
 * 第 2 段: AI 正解展示.
 * - 显示题目 / 学生原答案 / 参考答案 / 自述错因
 * - 显示 AI 生成的标准解题思路
 * - 按钮"重新生成" (force=true)
 * - 按钮"出变式题" (触发 onAdvance)
 */
export function Stage2Solution({
  item,
  onUpdated,
  onAdvance,
  onBack,
}: Stage2SolutionProps) {
  const [generating, setGenerating] = useState(false);
  const solution = item.correctSolution;

  const onGenerate = async (force: boolean) => {
    setGenerating(true);
    try {
      const res = await generateReviewSolution(item.id, { force });
      onUpdated(res.item);
      if (force) {
        toast.success('已用新错因重新生成 AI 正解');
      }
    } catch (err) {
      const msg =
        err instanceof MistakeBookApiError ? err.message : '生成失败';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid gap-4">
      {/* 上下文回顾: 题目 / 学生答案 / 错因 */}
      <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
        <div>
          <span className="text-xs font-medium text-muted-foreground">题目</span>
          <p className="mt-0.5 text-foreground whitespace-pre-wrap">
            {item.problemText}
          </p>
        </div>
        {item.userAnswer ? (
          <div>
            <span className="text-xs font-medium text-muted-foreground">你当时写的</span>
            <p className="mt-0.5 text-foreground whitespace-pre-wrap">
              {item.userAnswer}
            </p>
          </div>
        ) : null}
        {item.correctAnswer ? (
          <div>
            <span className="text-xs font-medium text-muted-foreground">参考答案</span>
            <p className="mt-0.5 text-foreground whitespace-pre-wrap">
              {item.correctAnswer}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-background px-2 py-0.5 text-muted-foreground">
            错因: {categoryLabel(item.errorCauseCategory)}
          </span>
          {item.errorCause ? (
            <span className="text-muted-foreground line-clamp-1">
              &quot;{item.errorCause}&quot;
            </span>
          ) : null}
        </div>
      </div>

      {/* AI 正解主体 */}
      {solution ? (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              AI 标准解题思路
            </h4>
            <Button
              variant="ghost"
              size="sm"
              disabled={generating}
              onClick={() => onGenerate(true)}
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="ml-1">重新生成</span>
            </Button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border bg-card p-4 leading-relaxed">
            {/* 简化: 用 white-space + 换行处理, AI 的输出是结构化 markdown
                但格式是"复述 + 解题步骤 + 易错点", 段落已经分得清.
                避免引入 streamdown 进一步增加包体积. */}
            {solution.split(/\n{2,}/).map((block, idx) => (
              <p key={idx} className="whitespace-pre-wrap text-foreground">
                {renderInline(block)}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            还没有 AI 正解, 点下面按钮让 AI 给你讲一遍.
          </p>
          <Button onClick={() => onGenerate(false)} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在生成…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                生成 AI 正解
              </>
            )}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={generating}>
          ← 改一下错因
        </Button>
        <Button onClick={onAdvance} disabled={!solution || generating}>
          下一步: 出同类变式题
        </Button>
      </div>
    </div>
  );
}

/** 极简的 inline 渲染: 处理 **bold** 和 `code`, 其他原样. */
function renderInline(text: string): React.ReactNode {
  // 先拆出 **...** 段
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`b${key++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={`c${key++}`}
          className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIdx = match.index + token.length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}
