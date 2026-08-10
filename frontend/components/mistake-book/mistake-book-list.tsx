'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCcw,
  Trash2,
  ExternalLink,
  ImageIcon,
  ListChecks,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { formatDateTimeBeijing } from '@/lib/utils/date';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  deleteMistakeBook,
  listMistakeBook,
  MistakeBookApiError,
  toggleResolvedMistakeBook,
  type MistakeBookItem,
  type MistakeBookListResponse,
} from '@/lib/mistake-book/api';
import {
  canMarkMastered,
  computeReviewStage,
  REVIEW_STAGE_LABELS,
  REVIEW_STAGE_SHORT,
} from '@/lib/mistake-book/review';
import { ReviewPanel } from '@/components/mistake-book/review-panel';

interface MistakeBookListProps {
  initial?: MistakeBookListResponse | null;
}

type LoadState = 'loading' | 'ready' | 'error';

export function MistakeBookList({ initial }: MistakeBookListProps) {
  const [state, setState] = useState<LoadState>(initial ? 'ready' : 'loading');
  const [data, setData] = useState<MistakeBookListResponse | null>(
    initial ?? null,
  );
  // server 端已经把已掌握 + 未掌握都注入到 initial；这里默认 false
  // （「仅显示未掌握」开关 = 关），和 SSR 出来的初始视图一致。
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchList = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setState('loading');
    setErrorMsg('');
    try {
      const res = await listMistakeBook({
        includeResolved: !onlyUnresolved,
        limit: 100,
      });
      setData(res);
      setState('ready');
    } catch (err) {
      const msg =
        err instanceof MistakeBookApiError ? err.message : '加载失败';
      setErrorMsg(msg);
      setState('error');
    }
  }, [onlyUnresolved]);

  useEffect(() => {
    // SSR 注入的 initial 已经包含全部（已掌握 + 未掌握），
    // 不需要再发一次请求去拿同形状的数据。
    if (!initial) {
      fetchList();
    }
    // We intentionally only run on mount — `initial` is set once
    // and subsequent toggles trigger fetchList via the dependency above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggleResolved = useCallback(
    async (item: MistakeBookItem) => {
      setPendingId(item.id);
      try {
        const res = await toggleResolvedMistakeBook(item.id);
        setData((prev) => {
          if (!prev) return prev;
          const next = prev.items.map((it) =>
            it.id === res.item.id ? res.item : it,
          );
          // If the user is in "only unresolved" mode, hide the row
          // the moment it becomes resolved.
          const filtered = onlyUnresolved
            ? next.filter((it) => it.isResolved === 0)
            : next;
          const total = prev.total;
          const unresolved = Math.max(0, prev.unresolved + (res.item.isResolved === 1 ? -1 : 1));
          return {
            ...prev,
            items: filtered,
            unresolved,
            total,
          };
        });
        toast.success(
          res.item.isResolved === 1 ? '已标记为已掌握' : '已标记为未掌握',
        );
      } catch (err) {
        const msg = err instanceof MistakeBookApiError ? err.message : '操作失败';
        toast.error(msg);
      } finally {
        setPendingId(null);
      }
    },
    [onlyUnresolved],
  );

  // ReviewPanel 的 item 更新: 直接替换列表里的同一项.
  const onItemUpdate = useCallback((next: MistakeBookItem) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) => (it.id === next.id ? next : it)),
      };
    });
  }, []);

  // ReviewPanel 在三段都完成时调用: 自动把"已掌握"打上.
  // 仅在当前未掌握时触发, 不允许"撤销" (撤销走卡片右上角的"撤销"按钮).
  const onAutoMarkMastered = useCallback(
    (item: MistakeBookItem) => {
      if (item.isResolved === 1) return;
      void onToggleResolved(item);
    },
    [onToggleResolved],
  );

  const onDelete = useCallback(
    async (item: MistakeBookItem) => {
      setPendingId(item.id);
      try {
        await deleteMistakeBook(item.id);
        setData((prev) => {
          if (!prev) return prev;
          const wasResolved = item.isResolved === 1;
          const next = prev.items.filter((it) => it.id !== item.id);
          return {
            ...prev,
            items: next,
            total: Math.max(0, prev.total - 1),
            unresolved: wasResolved
              ? prev.unresolved
              : Math.max(0, prev.unresolved - 1),
          };
        });
        toast.success('已从错题本移除');
      } catch (err) {
        const msg = err instanceof MistakeBookApiError ? err.message : '删除失败';
        toast.error(msg);
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  // --- render ---

  if (state === 'loading' && !data) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                正在加载错题本…
              </span>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (state === 'error' && !data) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-destructive mb-3">{errorMsg}</p>
        <Button onClick={() => fetchList()} variant="outline" size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          重试
        </Button>
      </Card>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const unresolved = data?.unresolved ?? 0;
  const resolved = Math.max(0, total - unresolved);

  return (
    <div className="grid gap-4">
      {/* Summary header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">共 </span>
            <span className="font-semibold text-foreground">{total}</span>
            <span className="text-muted-foreground"> 题</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <div>
            <span className="text-muted-foreground">未掌握 </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {unresolved}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">已掌握 </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {resolved}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Switch
            id="only-unresolved"
            checked={onlyUnresolved}
            onCheckedChange={(v) => {
              setOnlyUnresolved(v);
              // Refetch on next tick with the new filter.
              setTimeout(() => fetchList({ silent: false }), 0);
            }}
            disabled={state === 'loading'}
          />
          <label
            htmlFor="only-unresolved"
            className="cursor-pointer text-muted-foreground"
          >
            仅显示未掌握
          </label>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <Card className="p-10 text-center">
          <BookmarkCheck className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold text-foreground">
            {onlyUnresolved ? '没有未掌握的错题' : '错题本是空的'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            在讲题页或拍题识别后点击「加入错题本」即可收藏这道题。
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <MistakeBookCard
              key={item.id}
              item={item}
              pending={pendingId === item.id}
              onToggleResolved={() => onToggleResolved(item)}
              onDelete={() => onDelete(item)}
              onItemUpdate={onItemUpdate}
              onAutoMarkMastered={() => onAutoMarkMastered(item)}
            />
          ))}
        </div>
      )}

      {state === 'error' && data ? (
        <p className="text-xs text-destructive text-center">{errorMsg}</p>
      ) : null}
    </div>
  );
}

interface MistakeBookCardProps {
  item: MistakeBookItem;
  pending: boolean;
  onToggleResolved: () => void;
  onDelete: () => void;
  onItemUpdate: (next: MistakeBookItem) => void;
  onAutoMarkMastered: () => void;
}

function MistakeBookCard({
  item,
  pending,
  onToggleResolved,
  onDelete,
  onItemUpdate,
  onAutoMarkMastered,
}: MistakeBookCardProps) {
  const resolved = item.isResolved === 1;
  const reviewStage = computeReviewStage(item);
  const canMaster = canMarkMastered(item);
  const stageShort = REVIEW_STAGE_SHORT[reviewStage];
  // 没有用过复盘, 默认收起; 用过 (任何 stage) 默认展开
  const hasReviewed =
    !!item.errorCauseCategory || !!item.correctSolution || !!item.variantQuestion;
  return (
    <Card
      className={`p-4 transition-opacity ${pending ? 'opacity-60' : ''} ${
        resolved ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
        {item.imageUrl ? (
          <a
            href={item.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="block h-20 w-20 overflow-hidden rounded-xl border bg-muted"
            title="查看原图"
          >
            {/* Using a plain <img> rather than next/image: imageUrl
                may point at a third-party storage that we don't
                pre-configure into next.config. Browsing the original
                is the safest contract. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title ?? '错题原图'}
              className="h-full w-full object-cover"
            />
          </a>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}

        <div className="min-w-0 grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground line-clamp-1">
              {item.title ?? item.problemText.slice(0, 30)}
            </h3>
            {resolved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                已掌握
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                未掌握
              </span>
            )}
            {item.subject ? (
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {item.subject}
                {item.grade ? ` · ${item.grade}` : ''}
              </span>
            ) : null}
            {!resolved && hasReviewed ? (
              <span
                className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  reviewStage === 'mastered'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                ].join(' ')}
                title={REVIEW_STAGE_LABELS[reviewStage]}
              >
                <ListChecks className="mr-1 h-3 w-3" />
                复盘 {stageShort}
              </span>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {item.problemText}
          </p>

          <p className="text-xs text-muted-foreground/80">
            收藏于 {formatDateTimeBeijing(item.createdAt)}
            {item.resolvedAt ? ` · 掌握于 ${formatDateTimeBeijing(item.resolvedAt)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {item.classroomId ? (
            <Button asChild size="sm" variant="default">
              <a
                href={`/classroom/${item.classroomId}`}
                title="重新查看讲题"
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                看讲解
              </a>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={resolved ? 'outline' : 'secondary'}
            onClick={onToggleResolved}
            disabled={pending || (!resolved && !canMaster)}
            title={
              resolved
                ? '点击标记为未掌握'
                : canMaster
                  ? '点击标记为已掌握'
                  : '三段复盘都完成 (变式题答对) 才能标记掌握'
            }
          >
            {resolved ? (
              <>
                <RotateCcw className="mr-1 h-4 w-4" />
                撤销
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {canMaster ? '已掌握' : '做完整三段才能掌握'}
              </>
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                title="从错题本移除"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>从错题本移除？</AlertDialogTitle>
                <AlertDialogDescription>
                  这道题将永久从你的错题本中移除。后续仍可在拍题页或讲题页重新加入。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>确认移除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 三段复盘 (可折叠). 已掌握时折叠展示 (只读历史), 未掌握时默认按
          hasReviewed 决定: 复盘过 -> 展开, 没复盘过 -> 折叠. */}
      <Collapsible
        className="mt-3 border-t pt-3"
        defaultOpen={hasReviewed && !resolved}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="font-medium">三段复盘</span>
              <span className="text-xs text-muted-foreground">
                {REVIEW_STAGE_LABELS[reviewStage]}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <ReviewPanel
            item={item}
            onItemUpdate={onItemUpdate}
            onMarkMastered={onAutoMarkMastered}
          />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
