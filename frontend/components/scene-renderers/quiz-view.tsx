'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PieChart,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Check,
  BookOpenText,
  Loader2,
  Sparkles,
  ListChecks,
  Code2,
  PencilLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { createLogger } from '@/lib/logger';

const log = createLogger('QuizView');
import type { QuizCodeBlock, QuizKind, QuizQuestion } from '@/lib/types/stage';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { useCspProgress, type ReportQuizPayload } from '@/lib/hooks/use-csp-progress';
import { SpeechButton } from '@/components/audio/speech-button';
import { gradeChoiceQuestions, isShortAnswer, type QuestionResult } from '@/lib/quiz/grading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { scoreToLevel, levelLabel } from '@/lib/server/csp-placement';
import {
  clearSubmitted,
  draftKey,
  readSubmittedState,
  writeSubmittedAnswers,
  writeSubmittedResults,
  type SubmittedState,
} from '@/lib/quiz/persistence';

/**
 * Stringify a user's answer to a single field for the
 * /api/csp-quiz/submit payload. Single-choice questions
 * store a string, multiple-choice questions store a
 * string[] — we join multi-select answers with a comma so
 * the teacher dashboard can render them in one cell.
 */
function pickChoice(value: string | string[] | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join(',');
  return value;
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = 'not_started' | 'answering' | 'submitting' | 'grading' | 'reviewing' | 'finalized';

interface QuizViewProps {
  readonly questions: QuizQuestion[];
  readonly sceneId: string;
  /**
   * Required for the "重置" flow on the CSP final paper
   * total score page. Used to call POST /api/csp-quiz/reset
   * per-scene when the student clicks "重新答题".
   */
  readonly classroomId: string;
  readonly codeBlock?: QuizCodeBlock;
  readonly kind?: QuizKind;
}

/**
 * Paper-style code block rendered once above the question list.
 *
 * Visual style mimics the CSP 真题卷 paper: every line lives in
 * its own bordered row, a 2-digit line-number column sits to the
 * left with a faint background, and the whole listing is wrapped
 * in a single outer frame. The intent is that a student reading
 * "01 #include <iostream>" / "02 #include <vector>" / … can
 * directly map it to the same line in the printed paper.
 *
 *   ┌──────┬──────────────────────────────────────────┐
 *   │  01  │  #include <iostream>                     │
 *   │  02  │  #include <vector>                       │
 *   │  03  │  using namespace std;                    │
 *   │  ... │  ...                                     │
 *   └──────┴──────────────────────────────────────────┘
 *
 * Why each line is a separate bordered <div> instead of a
 * CSS grid (the previous version):
 *   - The previous CSS-grid approach aligned line numbers and
 *     code via shared `gridTemplateRows`, but the rows had no
 *     visible separator, so the listing looked like a wall of
 *     text — the very problem reported in QA. Adding row
 *     borders is the simplest, most reliable way to make each
 *     line a distinct visual unit (the "方格纸" look).
 *   - Per-row borders degrade gracefully on narrow viewports:
 *     only the inner content scrolls horizontally inside the
 *     `overflow-x-auto` code cell, while the gutter stays
 *     pinned on the left.
 *
 * Light mode only (the project opts out of system dark mode at
 * the UA level — see `app/layout.tsx` `colorScheme: 'light'`),
 * so we hardcode light-mode colors and skip the `dark:` variants.
 */
function CodeBlockView({ block }: { block: QuizCodeBlock }) {
  const startLine = block.startLine ?? 1;
  // Pad line numbers to 2 digits ("01" instead of "1") for the
  // CSP-paper aesthetic. If a block has 100+ lines we expand
  // automatically so the gutter never truncates.
  const maxLineNo = startLine + block.lines.length - 1;
  const gutterDigits = Math.max(2, String(maxLineNo).length);
  const pad = (n: number) => String(n).padStart(gutterDigits, '0');
  return (
    <div className="rounded-lg border-2 border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-800 shadow-sm max-h-[40vh] flex flex-col">
      {(block.title || block.description) && (
        <div className="px-4 py-2.5 border-b border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          {block.title && (
            <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {block.title}
            </div>
          )}
          {block.description && (
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              {block.description}
            </div>
          )}
        </div>
      )}
      {/* Code listing: one bordered row per line. We render the
          gutter and the code as siblings inside the same flex
          row, so the line number and the code share a single
          1px horizontal divider and stay perfectly aligned
          even if the user zooms in. The wrapper is
          `overflow-y-auto` so blocks longer than the parent's
          `max-h-[40vh]` (set on the outer div above) scroll
          inside the code block instead of pushing the
          questions below the viewport. */}
      <div className="font-mono text-[12.5px] leading-[1.7] text-slate-800 dark:text-slate-100 overflow-y-auto">
        {block.lines.map((line, i) => (
          <div
            key={`row-${i}`}
            className="flex items-stretch border-b border-slate-200 dark:border-slate-700 last:border-b-0 hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors"
          >
            {/* Gutter cell */}
            <div
              className="shrink-0 select-none text-right pr-3 pl-3 py-1 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 tabular-nums"
              style={{ minWidth: `${gutterDigits + 2}ch` }}
              aria-hidden="true"
            >
              {pad(startLine + i)}
            </div>
            {/* Code cell. overflow-x-auto so a long line is
                scrollable while the gutter stays pinned. Empty
                lines render as `&nbsp;` so the row keeps its
                height. */}
            <pre className="m-0 flex-1 px-3 py-1 whitespace-pre overflow-x-auto">
              {line || '\u00a0'}
            </pre>
          </div>
        ))}
      </div>
      {/* Footer — language tag so the block looks like a labelled listing */}
      <div className="px-3 py-1.5 border-t border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400" />
        {block.language}
      </div>
    </div>
  );
}

/** Call /api/quiz-grade for a single short-answer question. */
async function gradeShortAnswerQuestion(
  q: QuizQuestion,
  userAnswer: string,
  language: string,
): Promise<QuestionResult> {
  const pts = q.points ?? 1;
  try {
    const modelConfig = getCurrentModelConfig();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-model': modelConfig.modelString,
      'x-api-key': modelConfig.apiKey,
    };
    if (modelConfig.baseUrl) headers['x-base-url'] = modelConfig.baseUrl;
    if (modelConfig.providerType) headers['x-provider-type'] = modelConfig.providerType;

    const res = await fetch('/api/quiz-grade', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: q.question,
        userAnswer,
        points: pts,
        commentPrompt: q.commentPrompt,
        language,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { score: number; comment: string };
    const earned = Math.max(0, Math.min(pts, data.score));
    return {
      questionId: q.id,
      correct: earned >= pts * 0.8,
      status: earned >= pts * 0.8 ? 'correct' : 'incorrect',
      earned,
      aiComment: data.comment,
    };
  } catch (err) {
    log.error('[quiz-view] AI grading failed for', q.id, err);
    // Fallback: give half credit
    return {
      questionId: q.id,
      correct: null,
      status: 'incorrect',
      earned: Math.round(pts * 0.5),
      aiComment:
        language === 'zh-CN'
          ? '评分服务暂时不可用，已给予基础分。'
          : 'Grading service unavailable. Base score given.',
    };
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function QuizCover({
  questionCount,
  totalPoints,
  kind,
  onStart,
}: {
  questionCount: number;
  totalPoints: number;
  /** High-level quiz type; defaults to "choice" if omitted. */
  kind?: QuizKind;
  onStart: () => void;
}) {
  const { t } = useI18n();

  // Visual treatment for the type chip. We keep all three
  // variants in the violet/indigo family so the cover stays
  // visually unified with the rest of the app, but the icon
  // and the border accent shift to telegraph the kind at a
  // glance. A code-completion scene gets a slightly stronger
  // halo (the "fill the blanks" interaction is the most
  // effort-demanding of the three).
  const kindMeta: Record<QuizKind, { label: string; Icon: typeof PieChart; ring: string; bg: string; text: string; halo: string }> = {
    choice: {
      label: '单项选择题',
      Icon: ListChecks,
      ring: 'ring-indigo-200/60',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      halo: 'shadow-indigo-200/40',
    },
    'code-reading': {
      label: '阅读程序题',
      Icon: Code2,
      ring: 'ring-sky-200/60',
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      halo: 'shadow-sky-200/40',
    },
    'code-completion': {
      label: '完善程序题',
      Icon: PencilLine,
      ring: 'ring-violet-300/60',
      bg: 'bg-violet-50',
      text: 'text-violet-700',
      halo: 'shadow-violet-200/60',
    },
  };
  const meta = kindMeta[kind ?? 'choice'];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
        <PieChart className="w-52 h-52 text-violet-500" />
      </div>
      <div className="absolute bottom-0 left-0 p-6 opacity-[0.02]">
        <BookOpenText className="w-40 h-40 text-violet-500 rotate-12" />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ring-1 bg-gradient-to-br',
          'from-violet-100 to-purple-50 ring-violet-200/50',
          meta.halo,
        )}
      >
        <meta.Icon className="w-8 h-8 text-violet-500" />
      </motion.div>

      {/* High-level type chip — the whole point of this UX
          ask. "接下来是 单项选择题 / 阅读程序题 / 完善程序题"
          so the student knows what to expect before pressing
          "开始答题". */}
      <motion.div
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1',
          meta.bg,
          meta.ring,
          meta.text,
        )}
      >
        <meta.Icon className="w-3.5 h-3.5" />
        {meta.label}
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center z-10"
      >
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('quiz.title')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('quiz.subtitle')}</p>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-5 text-sm z-10"
      >
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <BookOpenText className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <span>
            {questionCount} {t('quiz.questionsCount')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <PieChart className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <span>
            {t('quiz.totalPrefix')} {totalPoints} {t('quiz.pointsSuffix')}
          </span>
        </div>
      </motion.div>

      <motion.button
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart}
        className="mt-1 px-8 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-full font-medium shadow-lg shadow-violet-200/50 dark:shadow-violet-900/50 hover:shadow-violet-300/50 transition-shadow z-10 flex items-center gap-2"
      >
        {t('quiz.startQuiz')}
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </div>
  );
}

function SingleChoiceQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
  result,
}: {
  question: QuizQuestion;
  index: number;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  result?: QuestionResult;
}) {
  const isReview = !!result;

  return (
    <QuestionCard question={question} index={index} result={result}>
      <div className="grid gap-2">
        {question.options?.map((opt) => {
          const selected = value === opt.value;
          const isCorrectOpt = isReview && question.answer?.includes(opt.value);
          const isWrong = isReview && selected && result?.status === 'incorrect';

          return (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => !disabled && onChange(opt.value)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all text-sm',
                // Default state
                !isReview &&
                  !selected &&
                  'border-gray-200 dark:border-gray-600 hover:border-violet-200 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-900/30',
                !isReview &&
                  selected &&
                  'border-violet-400 bg-violet-50 dark:bg-violet-900/30 ring-1 ring-violet-200 dark:ring-violet-700',
                // Review states
                isReview &&
                  isCorrectOpt &&
                  'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
                isReview &&
                  isWrong &&
                  !isCorrectOpt &&
                  'border-red-300 bg-red-50 dark:bg-red-900/30',
                isReview &&
                  !isCorrectOpt &&
                  !selected &&
                  'border-gray-100 dark:border-gray-700 opacity-60',
                disabled && !isReview && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                  !isReview &&
                    !selected &&
                    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                  !isReview && selected && 'bg-violet-500 text-white',
                  isReview && isCorrectOpt && 'bg-emerald-500 text-white',
                  isReview && isWrong && !isCorrectOpt && 'bg-red-400 text-white',
                  isReview &&
                    !isCorrectOpt &&
                    !selected &&
                    'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                )}
              >
                {opt.value}
              </span>
              <span
                className={cn(
                  'flex-1',
                  isReview && !isCorrectOpt && !selected && 'text-gray-400 dark:text-gray-500',
                )}
              >
                {opt.label}
              </span>
              {isReview && isCorrectOpt && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              {isReview && isWrong && !isCorrectOpt && (
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </QuestionCard>
  );
}

function MultipleChoiceQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
  result,
}: {
  question: QuizQuestion;
  index: number;
  value?: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  result?: QuestionResult;
}) {
  const isReview = !!result;
  const selected = value ?? [];

  const toggle = (optValue: string) => {
    if (disabled) return;
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  };

  const { t } = useI18n();

  return (
    <QuestionCard question={question} index={index} result={result}>
      {!isReview && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          {t('quiz.multipleChoiceHint')}
        </p>
      )}
      <div className="grid gap-2">
        {question.options?.map((opt) => {
          const isSelected = selected.includes(opt.value);
          const isCorrectOpt = isReview && question.answer?.includes(opt.value);
          const isWrong = isReview && isSelected && !isCorrectOpt;

          return (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all text-sm',
                !isReview &&
                  !isSelected &&
                  'border-gray-200 dark:border-gray-600 hover:border-violet-200 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-900/30',
                !isReview &&
                  isSelected &&
                  'border-violet-400 bg-violet-50 dark:bg-violet-900/30 ring-1 ring-violet-200 dark:ring-violet-700',
                isReview &&
                  isCorrectOpt &&
                  'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
                isReview && isWrong && 'border-red-300 bg-red-50 dark:bg-red-900/30',
                isReview &&
                  !isCorrectOpt &&
                  !isSelected &&
                  'border-gray-100 dark:border-gray-700 opacity-60',
                disabled && !isReview && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                  !isReview &&
                    !isSelected &&
                    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                  !isReview && isSelected && 'bg-violet-500 text-white',
                  isReview && isCorrectOpt && 'bg-emerald-500 text-white',
                  isReview && isWrong && 'bg-red-400 text-white',
                  isReview &&
                    !isCorrectOpt &&
                    !isSelected &&
                    'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                )}
              >
                {!isReview && isSelected ? <Check className="w-3.5 h-3.5" /> : opt.value}
              </span>
              <span
                className={cn(
                  'flex-1',
                  isReview && !isCorrectOpt && !isSelected && 'text-gray-400 dark:text-gray-500',
                )}
              >
                {opt.label}
              </span>
              {isReview && isCorrectOpt && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              {isReview && isWrong && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
            </button>
          );
        })}
      </div>
    </QuestionCard>
  );
}

function ShortAnswerQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
  result,
}: {
  question: QuizQuestion;
  index: number;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  result?: QuestionResult;
}) {
  const isReview = !!result;
  const { t } = useI18n();
  // Ref to track latest value for voice transcription append
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  return (
    <QuestionCard question={question} index={index} result={result}>
      {!isReview ? (
        <div className="relative">
          <textarea
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={t('quiz.inputPlaceholder')}
            className="w-full min-h-[100px] p-3 pb-10 rounded-xl border border-gray-200 dark:border-gray-600 text-sm resize-none focus:outline-none focus:border-violet-300 dark:focus:border-violet-600 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/50 transition-all disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:bg-gray-800/50 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
          <SpeechButton
            size="sm"
            disabled={disabled}
            className="absolute bottom-3 left-3"
            onTranscription={(text) => {
              const cur = valueRef.current ?? '';
              onChange(cur + (cur ? ' ' : '') + text);
            }}
          />
          <span className="absolute bottom-3 right-3 text-xs text-gray-300 dark:text-gray-600">
            {(value ?? '').length} {t('quiz.charCount')}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('quiz.yourAnswer')}</p>
            {value || (
              <span className="text-gray-400 dark:text-gray-500 italic">
                {t('quiz.notAnswered')}
              </span>
            )}
          </div>
          {result.aiComment && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800">
              <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-0.5">
                  {t('quiz.aiComment')}
                </p>
                <p className="text-xs text-violet-600/80 dark:text-violet-400/80">
                  {result.aiComment}
                </p>
              </div>
              <span className="ml-auto text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">
                {result.earned}/{question.points ?? 1}
                {t('quiz.pointsSuffix')}
              </span>
            </div>
          )}
        </div>
      )}
    </QuestionCard>
  );
}

function QuestionCard({
  question,
  index,
  result,
  children,
}: {
  question: QuizQuestion;
  index: number;
  result?: QuestionResult;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const isReview = !!result;
  const pts = question.points ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-2xl border p-5 relative overflow-hidden',
        !isReview && 'border-gray-150 dark:border-gray-700 shadow-sm',
        isReview &&
          result.status === 'correct' &&
          'border-emerald-200 dark:border-emerald-800 shadow-sm shadow-emerald-50 dark:shadow-emerald-900/20',
        isReview &&
          result.status === 'incorrect' &&
          'border-red-200 dark:border-red-800 shadow-sm shadow-red-50 dark:shadow-red-900/20',
      )}
    >
      {/* Left accent */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl',
          !isReview && 'bg-violet-400',
          isReview && result.status === 'correct' && 'bg-emerald-400',
          isReview && result.status === 'incorrect' && 'bg-red-400',
        )}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
              !isReview &&
                'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400',
              isReview &&
                result.status === 'correct' &&
                'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
              isReview &&
                result.status === 'incorrect' &&
                'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
            )}
          >
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
              {question.question}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {question.type === 'single'
                ? t('quiz.singleChoice')
                : question.type === 'multiple'
                  ? t('quiz.multipleChoice')
                  : t('quiz.shortAnswer')}
              {' · '}
              {pts} {t('quiz.pointsSuffix')}
            </p>
          </div>
        </div>
        {isReview && (
          <div className="shrink-0 ml-2">
            {result.status === 'correct' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            {result.status === 'incorrect' && <XCircle className="w-6 h-6 text-red-400" />}
          </div>
        )}
      </div>

      {/* Body */}
      {children}

      {/* Analysis (review only) */}
      {isReview && question.analysis && (
        <div className="mt-3 p-3 rounded-lg bg-blue-50/70 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <span className="font-medium">{t('quiz.analysis')}</span>
          {question.analysis}
        </div>
      )}
    </motion.div>
  );
}

function ScoreBanner({
  score,
  total,
  results,
}: {
  score: number;
  total: number;
  results: QuestionResult[];
}) {
  const { t } = useI18n();
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const correctCount = results.filter((r) => r.status === 'correct').length;
  const incorrectCount = results.filter((r) => r.status === 'incorrect').length;

  const color = pct >= 80 ? 'emerald' : pct >= 60 ? 'amber' : 'red';
  const colorMap = {
    emerald: {
      bg: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-200/50 dark:shadow-emerald-900/50',
      ring: 'bg-emerald-400/30',
      text: t('quiz.excellent'),
    },
    amber: {
      bg: 'from-amber-500 to-yellow-500',
      shadow: 'shadow-amber-200/50 dark:shadow-amber-900/50',
      ring: 'bg-amber-400/30',
      text: t('quiz.keepGoing'),
    },
    red: {
      bg: 'from-red-500 to-rose-500',
      shadow: 'shadow-red-200/50 dark:shadow-red-900/50',
      ring: 'bg-red-400/30',
      text: t('quiz.needsReview'),
    },
  };
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-2xl p-6 bg-gradient-to-r text-white shadow-lg', c.bg, c.shadow)}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{c.text}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-black">{score}</span>
            <span className="text-white/60 text-lg">/ {total}</span>
          </div>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {correctCount} {t('quiz.correct')}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> {incorrectCount} {t('quiz.incorrect')}
            </span>
          </div>
        </div>

        {/* Percentage ring */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="6"
            />
            <motion.circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - pct / 100) }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black">{pct}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function QuizView({ questions, sceneId, classroomId, codeBlock, kind }: QuizViewProps) {
  const { t, locale } = useI18n();
  const cspProgress = useCspProgress();

  // Rehydrate submitted state from localStorage on first mount. Runs once.
  const [initialSubmitted] = useState<SubmittedState>(() => readSubmittedState(sceneId));

  const [phase, setPhase] = useState<Phase>(() => {
    if (initialSubmitted?.kind === 'reviewing') return 'reviewing';
    if (initialSubmitted?.kind === 'answering') return 'answering';
    return 'not_started';
  });
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    () => initialSubmitted?.answers ?? {},
  );
  const [results, setResults] = useState<QuestionResult[]>(() =>
    initialSubmitted?.kind === 'reviewing' ? initialSubmitted.results : [],
  );

  // Draft cache for quiz answers, keyed by sceneId to isolate across classrooms
  const {
    cachedValue: cachedAnswers,
    updateCache: updateAnswersCache,
    clearCache: clearAnswersCache,
  } = useDraftCache<Record<string, string | string[]>>({
    key: draftKey(sceneId),
  });

  // Restore cached draft answers (only when there is no submitted state).
  const [prevCachedAnswers, setPrevCachedAnswers] = useState(cachedAnswers);
  if (cachedAnswers !== prevCachedAnswers) {
    setPrevCachedAnswers(cachedAnswers);
    if (
      !initialSubmitted &&
      cachedAnswers &&
      Object.keys(cachedAnswers).length > 0 &&
      phase === 'not_started'
    ) {
      setAnswers(cachedAnswers);
      setPhase('answering');
    }
  }

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points ?? 1), 0),
    [questions],
  );

  const allAnswered = useMemo(() => {
    return questions.every((q) => {
      const a = answers[q.id];
      if (!a) return false;
      if (Array.isArray(a)) return a.length > 0;
      return (a as string).trim().length > 0;
    });
  }, [questions, answers]);

  const handleSetAnswer = useCallback(
    (questionId: string, value: string | string[]) => {
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: value };
        updateAnswersCache(next);
        return next;
      });
    },
    [updateAnswersCache],
  );

  // Per-scene "submit-sent" dedup set. The post-grading useEffect
  // below writes the per-question results to the server exactly
  // once per (sceneId, grading cycle) pair; handleSubmit deletes
  // the current sceneId from the set so a re-submit in full-paper
  // mode goes through. Keying on sceneId (rather than a single
  // boolean) means switching between scenes never accidentally
  // latches a sibling scene's submit state — which was the
  // root cause of "随堂练习 answers never make it into
  // csp_quiz_submissions, so 错题本 only shows 真题卷 mistakes".
  // Declared up here (before handleSubmit references it) so the
  // useCallback closure below resolves at call time, not at hook
  // declaration time.
  const submitSentForScene = useRef<Set<string>>(new Set());

  const handleSubmit = useCallback(() => {
    setPhase('grading');
    // Reset the "submitted to server" guard so the post-grading
    // effect below can fire on this cycle. Without this, full-paper
    // scenes (which stay in `answering` instead of transitioning
    // to `reviewing`) would silently skip the server push and the
    // student's answers would never make it to csp_quiz_submissions.
    //
    // Note: the dedup gate is now a `Set<sceneId>` rather than a
    // single boolean, so we need to delete THIS sceneId from the
    // set so a re-submit (or a re-grade in full-paper mode where
    // grading runs in-place) goes through. Other scenes' sent
    // state is preserved, so a student who already submitted scene
    // A will not re-submit scene A if handleSubmit is somehow
    // called twice for that scene.
    submitSentForScene.current.delete(sceneId);
    clearAnswersCache();
    writeSubmittedAnswers(sceneId, answers);
  }, [clearAnswersCache, answers, sceneId]);

  // When entering grading phase, grade choice questions locally + call API for short-answer
  useEffect(() => {
    if (phase !== 'grading') return;
    let cancelled = false;

    (async () => {
      // 1. Grade choice questions locally (instant)
      const choiceResults = gradeChoiceQuestions(questions, answers);

      // 2. Grade short-answer questions via AI API (parallel)
      const shortAnswerQs = questions.filter(isShortAnswer);
      const aiResults = await Promise.all(
        shortAnswerQs.map((q) =>
          gradeShortAnswerQuestion(q, (answers[q.id] as string) ?? '', locale),
        ),
      );

      if (cancelled) return;

      // 3. Merge results in original question order
      const allResultsMap = new Map<string, QuestionResult>();
      for (const r of [...choiceResults, ...aiResults]) {
        allResultsMap.set(r.questionId, r);
      }
      const ordered = questions.map((q) => allResultsMap.get(q.id)!).filter(Boolean);

      setResults(ordered);
      // Single-scene quizzes: auto-enter reviewing. CSP final
      // paper (full paper): stay in answering until the
      // student clicks "交卷".
      if (isFullPaper) {
        setPhase('answering');
      } else {
        setPhase('reviewing');
      }
      writeSubmittedResults(sceneId, ordered);
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, questions, answers, locale, sceneId]);

  // CSP progress: when the quiz finishes grading and we have
  // authoritative results, push them to the server. We do this
  // here (and not in handleSubmit) because we need the per-
  // question `correct` flags from the AI grading pass. The
  // server trusts the client-side `correct` boolean (see
  // /api/csp-quiz/submit/route.ts), so the worst case for a
  // lying client is inflated personal stats — not other students'
  // coverage. Idempotency comes from the UNIQUE
  // (userId, classroomId, sceneId) constraint; the same user
  // re-submitting the same scene overwrites the previous row.
  //
  // We also fire `reportSceneComplete` so the quiz is credited
  // as a "viewed" scene on the teacher dashboard even though
  // the engine's onSceneChange path doesn't fire for quiz
  // scenes (the student answers directly in the UI, the
  // engine's speech never gets a chance to "complete" the
  // scene via the natural TTS-end path).
  //
  // Trigger condition is `results.length > 0` rather than
  // `phase === 'reviewing'` because full-paper scenes
  // (isFullPaper: cm_imp_cspj2024j_v1) intentionally stay in
  // `answering` after grading to avoid spoiling the per-scene
  // answer correctness before the student has finished the
  // whole paper. The previous phase-gated check meant
  // full-paper submissions never reached the server, so
  // the final "交卷" only saw the last scene's data and the
  // 6-scene aggregator in /api/csp-quiz/finalize returned
  // a partial (or empty) score.
  // (submitSentForScene is declared up near handleSubmit so the
  // closure resolves before this useEffect runs.)
  useEffect(() => {
    if (results.length === 0) return;
    if (submitSentForScene.current.has(sceneId)) return;
    submitSentForScene.current.add(sceneId);
    // Build a lookup of questionId → points so the submit payload
    // can carry per-question point values. The CSP paper has
    // questions worth 1.5 / 2 / etc. points (not always 1), and
    // the finalize endpoint sums these to give a real "总分 / 满分"
    // rather than "答对题数 / 总题数".
    const pointsByQuestionId = new Map<string, number>(
      questions.map((q) => [q.id, q.points ?? 1]),
    );
    const payload: ReportQuizPayload = {
      sceneId,
      totalQuestions: questions.length,
      answers: results.map((r) => ({
        // Use the original question's `id` from the question
        // bank (not the result's, which is identical but we
        // want to be explicit) and the user's chosen value
        // from `answers`. If the user didn't answer a
        // question (shouldn't happen — handleSubmit is
        // disabled until allAnswered) we still send an
        // empty string so the row is created.
        questionId: r.questionId,
        choice: pickChoice(answers[r.questionId]),
        correct: r.status === 'correct',
        ms: 0,
        points: pointsByQuestionId.get(r.questionId) ?? 1,
      })),
    };
    void cspProgress.reportQuizSubmit(payload);
    void cspProgress.reportSceneComplete(sceneId);
    // intentionally no deps on `cspProgress` — the hook
    // returns a stable object keyed on classroomId, and we
    // only want this to fire once per (sceneId, grading-cycle)
    // pair, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, results, sceneId, questions]);

  // ── Full-paper-only state (active when isFullPaper is true) ──
  // CSP 真题卷有多个 quiz scene，最后一题答完 → 不自动 reviewing，
  // 而是停 answering 直到学生主动"交卷"。详见
  // docs/superpowers/specs/2026-07-26-csp-final-paper-submit-design.md
  const [isConfirming, setIsConfirming] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [finalizedResult, setFinalizedResult] = useState<{
    totalEarned: number;
    totalPossible: number;
    totalMaxV3: number;
    totalEarnedV3: number;
    mode: 'standard' | 'legacy';
    breakdown: Array<{
      category: 'choice' | 'read' | 'perfect';
      label: string;
      earned: number;
      max: number;
      actualMax: number;
      sceneCount: number;
    }>;
    sceneResults: Array<{
      sceneId: string;
      title: string;
      order: number;
      totalQuestions: number;
      correctCount: number;
      points: number;
      earnedPoints: number;
    }>;
    // V4 score history — keyed by sceneId, oldest first. Each
    // entry is one submitted attempt; the first attempt of a
    // scene is rendered with a "首次" chip, subsequent ones
    // get "订正 N". The `paperHistory` is the per-attemptIndex
    // roll-up across every scene (only emitted when the
    // student has done every answered scene N times; partial
    // re-dos are tracked per scene but not at the paper level).
    historyByScene: Record<
      string,
      Array<{
        attemptIndex: number;
        score: number;
        points: number;
        maxPoints: number;
        correctCount: number;
        totalQuestions: number;
        submittedAt: string;
      }>
    >;
    paperHistory: Array<{
      attemptIndex: number;
      totalEarned: number;
      totalMax: number;
      score: number;
      submittedAt: string;
    }>;
  } | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // Full-paper mode: only true for the 2024 CSP-J 真题卷
  // (cm_imp_cspj2024j_v1). For v1 we hard-gate on classroomId;
  // subsequent 真题卷s (cm_imp_cspj2024s_v1 etc) will be added
  // by extending this set.
  const FULL_PAPER_CLASSROOM_IDS = new Set<string>(['cm_imp_cspj2024j_v1']);
  const isFullPaper = FULL_PAPER_CLASSROOM_IDS.has(classroomId);

  const handleRetry = useCallback(() => {
    setPhase('not_started');
    setAnswers({});
    setResults([]);
    clearAnswersCache();
    clearSubmitted(sceneId);
  }, [clearAnswersCache, sceneId]);

  // handleFinalize: triggered by the top "交卷" button. V2:
  // call /api/csp-quiz/finalize-classroom so the server can
  // aggregate every scene this user has submitted for this
  // classroom, not just the current scene. The v1 version
  // showed only the *last* scene's score (because the per-
  // scene grading useEffect had only just pushed the local
  // results to /api/csp-quiz/submit and there was no time to
  // pull all scenes back from the server). V2 is read-only
  // server-side: it just sums the existing csp_quiz_submissions
  // rows and returns one combined total.
  //
  // We do NOT block on the *current* scene having local
  // results — the cross-classroom aggregate is computed
  // server-side from the csp_quiz_submissions table, so a
  // student who skipped the first scene but answered scene 2-6
  // (or who is just opening the dialog on a fresh classroom
  // to see "you have 0 / 100 so far") should still be able to
  // hit 确认交卷 and get a sensible response. The server is
  // the source of truth for the score.
  const handleFinalize = useCallback(async () => {
    if (!isFullPaper) return;
    setIsFinalizing(true);
    setFinalizeError(null);
    try {
      // The local "this scene" totals are useful for the
      // optimistic view while the network round-trip runs, so
      // seed the result with them. The server response will
      // replace this with the cross-scene aggregate.
      const localPoints = questions.reduce((s, q) => s + (q.points ?? 1), 0);
      const localEarned = results.reduce((s, r) => s + r.earned, 0);
      const localCorrect = results.filter((r) => r.status === 'correct').length;

      const res = await fetch('/api/csp-quiz/finalize-classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || '交卷失败');
      }
      const data: {
        totalEarned: number;
        totalPossible: number;
        totalPoints: number;
        totalMaxPoints: number;
        totalScore: number;
        sceneCount: number;
        mode: 'standard' | 'legacy';
        totalEarnedV3: number;
        totalMaxV3: number;
        breakdown: Array<{
          category: 'choice' | 'read' | 'perfect';
          label: string;
          earned: number;
          max: number;
          actualMax: number;
          sceneCount: number;
        }>;
        sceneResults: {
          sceneId: string;
          category: 'choice' | 'read' | 'perfect' | null;
          correctCount: number;
          totalQuestions: number;
          points: number;
          maxPoints: number;
          score: number;
        }[];
      } = await res.json();
      setFinalizedResult({
        // Keep the count-based fields (correctCount / totalQuestions)
        // for the per-scene table, but the headline "总分 / 满分"
        // numbers now come from the point-weighted `points` /
        // `maxPoints` so they reflect actual CSP paper weighting
        // (1.5 / 2 / etc. per question).
        totalEarned: data.totalPoints,
        totalPossible: data.totalMaxPoints,
        mode: data.mode,
        totalEarnedV3: data.totalEarnedV3,
        totalMaxV3: data.totalMaxV3,
        breakdown: data.breakdown,
        sceneResults: data.sceneResults.map((s, idx) => {
          // Display order:
          //  1) the V3 category label when the scene JSON carries one
          //     ("单项选择题 1", "程序阅读题 1", "完善程序题 1")
          //  2) otherwise the actual scene title from the classroom
          //     JSON (e.g. "选择题", "阅读程序题", "完善程序题")
          //  3) otherwise the positional "第 N 部分" fallback
          const catLabel = s.category
            ? s.category === 'choice'
              ? '单项选择题'
              : s.category === 'read'
                ? '程序阅读题'
                : s.category === 'perfect'
                  ? '完善程序题'
                  : null
            : null;
          const serverTitle =
            typeof s.title === 'string' && s.title.trim().length > 0
              ? s.title.trim()
              : '';
          const title = catLabel
            ? `${catLabel} ${idx + 1}`
            : serverTitle || `第 ${idx + 1} 部分`;
          // order: the server-provided classroom order takes
          // priority; otherwise fall back to the response array
          // position so the per-scene list stays stable.
          const order =
            typeof s.order === 'number' && Number.isFinite(s.order)
              ? s.order
              : idx + 1;
          return {
            sceneId: s.sceneId,
            category: s.category,
            title,
            order,
            totalQuestions: s.totalQuestions,
            correctCount: s.correctCount,
            points: s.maxPoints,
            earnedPoints: s.points,
          };
        }),
        // V4 score history. Server returns empty objects / arrays
        // when there's no prior history (first-ever submit), so we
        // coerce them here to keep the FinalScorePage's array
        // access safe.
        historyByScene: data.historyByScene ?? {},
        paperHistory: data.paperHistory ?? [],
      });
      setPhase('finalized');
      setIsConfirming(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提交失败';
      setFinalizeError(msg);
    } finally {
      setIsFinalizing(false);
    }
  }, [isFullPaper, results, questions, sceneId, classroomId]);

  // handleReset: triggered by "重新答题" on the total score
  // page. Calls /api/csp-quiz/reset for THIS scene, clears
  // local state, transitions back to answering.
  const handleReset = useCallback(async () => {
    if (!isFullPaper || !classroomId) return;
    setIsResetting(true);
    setResetError(null);
    try {
      const res = await fetch('/api/csp-quiz/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classroomId, sceneId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFinalizedResult(null);
      setResults([]);
      setAnswers({});
      clearAnswersCache();
      clearSubmitted(sceneId);
      setPhase('not_started');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '重置失败';
      setResetError(msg);
    } finally {
      setIsResetting(false);
    }
  }, [isFullPaper, classroomId, sceneId, clearAnswersCache]);

  const earnedScore = useMemo(() => results.reduce((sum, r) => sum + r.earned, 0), [results]);

  const resultMap = useMemo(() => {
    const map: Record<string, QuestionResult> = {};
    results.forEach((r) => {
      map[r.questionId] = r;
    });
    return map;
  }, [results]);

  return (
    <div className="w-full h-full bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900 overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {phase === 'not_started' && (
          <motion.div
            key="cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1"
          >
            <QuizCover
              questionCount={questions.length}
              totalPoints={totalPoints}
              kind={kind}
              onStart={() => setPhase('answering')}
            />
          </motion.div>
        )}

        {phase === 'answering' && (
          <motion.div
            key="answering"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur shrink-0">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {t('quiz.answering')}
                </span>
                <span className="text-xs text-gray-400 ml-1">
                  {
                    Object.keys(answers).filter((k) => {
                      const a = answers[k];
                      if (Array.isArray(a)) return a.length > 0;
                      return typeof a === 'string' && a.trim().length > 0;
                    }).length
                  }{' '}
                  / {questions.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isFullPaper && (
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={() => setIsConfirming(true)}
                    disabled={isFinalizing}
                  >
                    {isFinalizing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      '交卷'
                    )}
                  </Button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-medium transition-all',
                    allAnswered
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm hover:shadow-md hover:shadow-violet-200/50 dark:hover:shadow-violet-900/50 active:scale-[0.97]'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed',
                  )}
                >
                  {t('quiz.submitAnswers')}
                </button>
              </div>
            </div>

            {/* Code block (paper-style) — sticky-style: scrolled with the list so the
                student can always scroll back up to refer to the program. Rendered
                above the questions, full width. */}
            {codeBlock && (
              <div className="px-6 pt-4">
                <CodeBlockView block={codeBlock} />
              </div>
            )}

            {/* Questions */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {questions.map((q, i) => {
                if (q.type === 'single') {
                  return (
                    <SingleChoiceQuestion
                      key={q.id}
                      question={q}
                      index={i}
                      value={answers[q.id] as string | undefined}
                      onChange={(v) => handleSetAnswer(q.id, v)}
                    />
                  );
                }
                if (q.type === 'multiple') {
                  return (
                    <MultipleChoiceQuestion
                      key={q.id}
                      question={q}
                      index={i}
                      value={answers[q.id] as string[] | undefined}
                      onChange={(v) => handleSetAnswer(q.id, v)}
                    />
                  );
                }
                return (
                  <ShortAnswerQuestion
                    key={q.id}
                    question={q}
                    index={i}
                    value={answers[q.id] as string | undefined}
                    onChange={(v) => handleSetAnswer(q.id, v)}
                  />
                );
              })}
            </div>
          </motion.div>
        )}

        {phase === 'grading' && (
          <motion.div
            key="grading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-5"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            >
              <Loader2 className="w-10 h-10 text-violet-500" />
            </motion.div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
                {t('quiz.aiGrading')}
              </p>
              <p className="text-sm text-gray-400 mt-1">{t('quiz.aiGradingWait')}</p>
            </div>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'reviewing' && (
          <motion.div
            key="reviewing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {t('quiz.quizReport')}
                </span>
              </div>
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('quiz.retry')}
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <ScoreBanner score={earnedScore} total={totalPoints} results={results} />

              {codeBlock && <CodeBlockView block={codeBlock} />}

              {questions.map((q, i) => {
                const r = resultMap[q.id];
                if (q.type === 'single') {
                  return (
                    <SingleChoiceQuestion
                      key={q.id}
                      question={q}
                      index={i}
                      value={answers[q.id] as string | undefined}
                      onChange={() => {}}
                      disabled
                      result={r}
                    />
                  );
                }
                if (q.type === 'multiple') {
                  return (
                    <MultipleChoiceQuestion
                      key={q.id}
                      question={q}
                      index={i}
                      value={answers[q.id] as string[] | undefined}
                      onChange={() => {}}
                      disabled
                      result={r}
                    />
                  );
                }
                return (
                  <ShortAnswerQuestion
                    key={q.id}
                    question={q}
                    index={i}
                    value={answers[q.id] as string | undefined}
                    onChange={() => {}}
                    disabled
                    result={r}
                  />
                );
              })}
            </div>
          </motion.div>
        )}

        {phase === 'submitting' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="flex items-center gap-3 text-violet-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">正在提交...</span>
            </div>
          </motion.div>
        )}

        {phase === 'finalized' && finalizedResult && (
          <motion.div
            key="finalized"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto"
          >
            <FinalScorePage
              result={finalizedResult}
              onReset={handleReset}
              isResetting={isResetting}
              resetError={resetError}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {isConfirming && (
        <ConfirmSubmitModal
          answeredCount={
            Object.keys(answers).filter((k) => {
              const a = answers[k];
              if (Array.isArray(a)) return a.length > 0;
              return typeof a === 'string' && a.trim().length > 0;
            }).length
          }
          totalCount={questions.length}
          onConfirm={handleFinalize}
          onCancel={() => setIsConfirming(false)}
        />
      )}

      {finalizeError && phase !== 'finalized' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300 shadow-lg">
          提交失败：{finalizeError}
        </div>
      )}
    </div>
  );
}

// ─── Full-paper-only sub-components ────────────────────────────────────────

type FinalScoreResult = {
  totalEarned: number;
  totalPossible: number;
  totalMaxV3: number;
  totalEarnedV3: number;
  mode: 'standard' | 'legacy';
  breakdown: Array<{
    category: 'choice' | 'read' | 'perfect';
    label: string;
    earned: number;
    max: number;
    actualMax: number;
    sceneCount: number;
  }>;
  sceneResults: Array<{
    sceneId: string;
    category: 'choice' | 'read' | 'perfect' | null;
    title: string;
    order: number;
    totalQuestions: number;
    correctCount: number;
    points: number;
    earnedPoints: number;
  }>;
  // V4 score history. See the matching field on the
  // `finalizedResult` state for the full design rationale.
  historyByScene: Record<
    string,
    Array<{
      attemptIndex: number;
      score: number;
      points: number;
      maxPoints: number;
      correctCount: number;
      totalQuestions: number;
      submittedAt: string;
    }>
  >;
  paperHistory: Array<{
    attemptIndex: number;
    totalEarned: number;
    totalMax: number;
    score: number;
    submittedAt: string;
  }>;
};

function FinalScorePage({
  result,
  onReset,
  isResetting,
  resetError,
}: {
  result: FinalScoreResult;
  onReset: () => void;
  isResetting: boolean;
  resetError: string | null;
}) {
  // V3 (standard or category-grouped): show the per-category
  // breakdown whenever *any* scene has a category. Standard mode
  // also uses the configured paper-standard 满分 as the
  // denominator; legacy-with-categories uses the per-question sum
  // for each category. V2 (no categories at all): use the
  // per-question points sum and the per-scene list as-is.
  const hasAnyCategory =
    Array.isArray(result.sceneResults) &&
    result.sceneResults.some((s) => !!s.category);
  const useV3 = result.mode === 'standard' || hasAnyCategory;
  const headlineEarned = useV3 ? result.totalEarnedV3 : result.totalEarned;
  const headlineMax = useV3 ? result.totalMaxV3 : result.totalPossible;
  const pct =
    headlineMax > 0
      ? Math.round((headlineEarned / headlineMax) * 100)
      : 0;
  const level = scoreToLevel(pct);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-2xl">
          📊
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">总分</h2>
        <div className="text-5xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
          {headlineEarned}{' '}
          <span className="text-2xl text-slate-400 dark:text-slate-500">
            / {headlineMax} 分
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-sm font-semibold">
          {levelLabel(level)}
        </div>
        {pct > 0 && (
          <div className="text-xs text-slate-400 tabular-nums">{pct}%</div>
        )}
      </div>

      {/* V4: Paper-level score history. Only shown when the
          student has actually made more than one attempt at the
          whole paper (i.e. the backend could roll up at least
          2 entries). The "首次" chip on the first attempt gives
          the student an anchor: "this is the original score
          you got"; the subsequent "订正 N" rows make the
          improvement immediately visible. We use a vertical
          timeline on the left, latest at the top, because the
          latest number is what the student came here to see. */}
      {result.paperHistory && result.paperHistory.length > 1 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800">
                得分历史
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {result.paperHistory.length} 次交卷
              </span>
            </div>
            <ol className="divide-y divide-slate-100">
              {[...result.paperHistory]
                .sort((a, b) => b.attemptIndex - a.attemptIndex)
                .map((h, idx) => {
                  const isFirst = h.attemptIndex === 1;
                  const isLatest = idx === 0;
                  // Delta vs the previous attempt (which is the
                  // row below in the timeline = lower
                  // attemptIndex, or undefined for the first).
                  const prev = result.paperHistory.find(
                    (x) => x.attemptIndex === h.attemptIndex - 1,
                  );
                  const delta = prev
                    ? Math.round((h.score - prev.score) * 100) / 100
                    : null;
                  return (
                    <li
                      key={h.attemptIndex}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        isLatest ? 'bg-violet-50/40' : ''
                      }`}
                    >
                      <div
                        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isFirst
                            ? 'bg-slate-100 text-slate-600'
                            : isLatest
                              ? 'bg-violet-600 text-white'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isFirst ? '首' : `订${h.attemptIndex - 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 tabular-nums">
                          {isFirst ? '首次交卷' : `第 ${h.attemptIndex} 次交卷（订正 ${h.attemptIndex - 1}）`}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {h.submittedAt
                            ? new Date(h.submittedAt).toLocaleString('zh-CN', {
                                hour12: false,
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '时间未知'}
                        </div>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <div
                          className={`text-base font-bold ${
                            h.score >= 80
                              ? 'text-emerald-600'
                              : h.score >= 60
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {h.totalEarned} / {h.totalMax} 分
                        </div>
                        {delta !== null && (
                          <div
                            className={`text-[10px] font-semibold ${
                              delta > 0
                                ? 'text-emerald-600'
                                : delta < 0
                                  ? 'text-red-600'
                                  : 'text-slate-400'
                            }`}
                          >
                            {delta > 0 ? '↑' : delta < 0 ? '↓' : '·'}{' '}
                            {Math.abs(delta)} 分
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* V3: 三类分项（单选题 / 程序阅读题 / 完善程序题） */}
      {useV3 && result.breakdown && result.breakdown.length > 0 && (
        <Card>
          <CardContent className="p-0 divide-y divide-slate-100">
            {result.breakdown.map((b) => {
              const catPct =
                b.max > 0 ? Math.round((b.earned / b.max) * 100) : 0;
              const ok = b.max > 0 && b.earned === b.max;
              return (
                <div
                  key={b.category}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">
                      {b.label}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {b.sceneCount} 个场景 · 得分占比 {catPct}%
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div
                      className={`text-base font-bold ${
                        ok
                          ? 'text-emerald-600'
                          : catPct >= 60
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}
                    >
                      {b.earned} / {b.max} 分
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 divide-y divide-slate-100">
          {result.sceneResults
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => {
              // Both the headline number on the right and the
              // sub-line below are now in POINTS (CSP 1.5 / 2 /
              // etc. per question), not question counts. We
              // separately keep `correctCount / totalQuestions`
              // as a smaller secondary line so the student can
              // still see "15题里对2题" at a glance.
              const scenePct =
                s.points > 0
                  ? Math.round((s.earnedPoints / s.points) * 100)
                  : 0;
              const ok = s.earnedPoints === s.points;
              // Strip the leading "一、"/"二、"/... and trailing
              // "（共 X 题…）" parenthetical from the server-side
              // classroom title so the per-scene row is more
              // scannable. The full title is still preserved in
              // the tooltip via the title attribute, so the
              // student can hover to see the exact paper weighting
              // (e.g. "共15题，每题2分，共计30分").
              const compactTitle = (s.title || '')
                .replace(/^[一二三四五六七八九十]+、\s*/, '')
                .replace(/\s*（[^）]*）\s*$/, '')
                .trim();
              const displayTitle =
                compactTitle || s.title || s.sceneId.slice(-8);
              // V4 per-scene history chips. If the student has
              // only answered this scene once we skip the chip
              // row entirely (UI stays uncluttered on the
              // common case); on redo we render a compact
              // "首 X / 订正 Y" line so the per-scene
              // improvement is visible without scrolling.
              const sceneHistory = result.historyByScene?.[s.sceneId] ?? [];
              return (
                <div
                  key={s.sceneId}
                  className="px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-medium text-slate-800"
                        title={s.title}
                      >
                        {displayTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        答对 {s.correctCount} / {s.totalQuestions} 题 · {scenePct}%
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div
                        className={`text-sm font-bold ${
                          ok
                            ? 'text-emerald-600'
                            : scenePct >= 60
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {s.earnedPoints} / {s.points} 分
                      </div>
                    </div>
                    <div className="shrink-0">
                      {ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                  {/* V4 per-scene history. Only render when there
                      are 2+ attempts, to keep the first-time
                      view quiet. Sorted oldest -> newest so
                      reading left-to-right matches the natural
                      narrative "I got X, then I redid and got
                      Y". */}
                  {sceneHistory.length > 1 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                      <span className="text-slate-400 mr-0.5">历次:</span>
                      {sceneHistory.map((h) => {
                        const isFirst = h.attemptIndex === 1;
                        return (
                          <span
                            key={h.attemptIndex}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                              isFirst
                                ? 'border-slate-200 bg-slate-50 text-slate-600'
                                : h.score >= sceneHistory[sceneHistory.length - 2].score
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                            }`}
                            title={
                              h.submittedAt
                                ? new Date(h.submittedAt).toLocaleString('zh-CN', {
                                    hour12: false,
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''
                            }
                          >
                            <span className="font-semibold">
                              {isFirst ? '首次' : `订正 ${h.attemptIndex - 1}`}
                            </span>
                            <span>
                              {h.correctCount}/{h.totalQuestions}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </CardContent>
      </Card>

      {resetError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          重置失败：{resetError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={onReset} disabled={isResetting}>
          {isResetting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              重置中...
            </>
          ) : (
            '重新答题'
          )}
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = '/csp-lecture')}>
          返回课件列表
        </Button>
      </div>

      <p className="text-center text-xs text-slate-400">
        交卷后全 6 scene 成绩已汇总写入排行榜。重新答题只重置当前 scene。
      </p>
    </div>
  );
}

function ConfirmSubmitModal({
  answeredCount,
  totalCount,
  onConfirm,
  onCancel,
}: {
  answeredCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const allDone = answeredCount === totalCount;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">确认交卷？</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {allDone
            ? `本次共 ${totalCount} 道题，提交后不可修改。`
            : `还有 ${totalCount - answeredCount} 道题未答，未答的题按 0 分计算。确认交卷？`}
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            再检查一下
          </Button>
          <Button
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={onConfirm}
          >
            确认交卷
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
