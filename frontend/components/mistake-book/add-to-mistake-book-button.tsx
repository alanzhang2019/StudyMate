'use client';

import { useState, useCallback, type ComponentProps } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  addMistakeBook,
  MistakeBookApiError,
  type MistakeBookAddInput,
  type MistakeBookItem,
} from '@/lib/mistake-book/api';

type State = 'idle' | 'saving' | 'saved' | 'error';

export interface AddToMistakeBookButtonProps
  extends Omit<ComponentProps<typeof Button>, 'onClick' | 'children' | 'disabled'> {
  /**
   * The data to save. Either `problemText` or `mistakeSessionId`
   * is required — the server will hydrate the rest from the
   * persisted MistakeSession when only the id is provided.
   */
  data: MistakeBookAddInput;
  /** Fires after a successful add (or dedup hit). */
  onSaved?: (item: MistakeBookItem, deduplicated: boolean) => void;
  /** Override the default "加入错题本" / "已加入错题本" labels. */
  labels?: { idle?: string; saving?: string; saved?: string; error?: string };
  /** When true, after a successful add the button auto-resets to
   *  "idle" after a few seconds so the user can keep adding. */
  autoReset?: boolean;
  /** Disable the button externally (e.g. when the problem text
   *  hasn't been confirmed yet). */
  disabled?: boolean;
}

const DEFAULT_LABELS = {
  idle: '加入错题本',
  saving: '加入中…',
  saved: '已加入',
  error: '重试加入',
};

/**
 * Button that adds the current question to the visitor's mistake
 * book. Designed to be dropped into both the OCR result card and
 * the post-classroom shell — anywhere we know the problem text.
 *
 * The component owns its own state machine (idle / saving / saved
 * / error) and tolerates double-clicks via the server's 5-minute
 * dedup window.
 */
export function AddToMistakeBookButton({
  data,
  onSaved,
  labels,
  autoReset = false,
  size = 'sm',
  variant = 'outline',
  disabled: disabledProp = false,
  ...buttonProps
}: AddToMistakeBookButtonProps) {
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const text = { ...DEFAULT_LABELS, ...labels };

  const handleClick = useCallback(async () => {
    if (state === 'saving' || state === 'saved') return;
    const hasProblem = typeof data.problemText === 'string' && data.problemText.trim().length > 0;
    const hasSession = typeof data.mistakeSessionId === 'string' && data.mistakeSessionId.length > 0;
    if (!hasProblem && !hasSession) {
      setState('error');
      setErrorMsg('没有可收藏的题目');
      return;
    }
    setState('saving');
    setErrorMsg('');
    try {
      const res = await addMistakeBook(data);
      setState('saved');
      onSaved?.(res.item, Boolean(res.deduplicated));
      if (autoReset) {
        setTimeout(() => setState('idle'), 2500);
      }
    } catch (err) {
      setState('error');
      setErrorMsg(
        err instanceof MistakeBookApiError ? err.message : '加入失败，请重试',
      );
    }
  }, [data, onSaved, state, autoReset]);

  const isBusy = state === 'saving' || state === 'saved';
  const isDisabled = disabledProp || isBusy;

  return (
    <Button
      type="button"
      onClick={handleClick}
      size={size}
      variant={state === 'saved' ? 'default' : variant}
      disabled={isDisabled}
      // Re-enable pointer events when the button is dropped inside
      // a click-through container (e.g. the floating classroom
      // overlay uses `pointer-events-none` on its wrapper).
      className={['pointer-events-auto', buttonProps.className]
        .filter(Boolean)
        .join(' ')}
      title={errorMsg || undefined}
      {...buttonProps}
    >
      {state === 'saving' ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : state === 'saved' ? (
        <BookmarkCheck className="mr-2 h-4 w-4" />
      ) : (
        <Bookmark className="mr-2 h-4 w-4" />
      )}
      {state === 'saving'
        ? text.saving
        : state === 'saved'
        ? text.saved
        : state === 'error'
        ? text.error
        : text.idle}
    </Button>
  );
}
