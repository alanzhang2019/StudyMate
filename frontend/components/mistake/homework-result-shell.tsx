'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/hooks/use-i18n';
import { getHomeworkResultShellLayout } from '@/lib/mistake/ui/homework-result-layout';
import type { ExplanationSummary } from '@/lib/mistake/ui/types';
import { useExportPPTX } from '@/lib/export/use-export-pptx';
import { Download, Loader2 } from 'lucide-react';
import { AddToMistakeBookButton } from '@/components/mistake-book/add-to-mistake-book-button';

type HomeworkResultShellProps = {
  summary: ExplanationSummary;
  mistakeSessionId: string;
  summaryVisible: boolean;
  children: ReactNode;
  /**
   * The original problem text. When provided together with the
   * optional fields below, the summary panel renders an
   * "加入错题本" button that lets the visitor add the current
   * question to their personal mistake book. All fields are
   * optional except `problemText` — passing it enables the button.
   */
  mistakeBookEntry?: {
    problemText: string;
    userAnswer?: string;
    correctAnswer?: string;
    imageUrl?: string;
    classroomId?: string;
    sessionId?: string;
    subject?: string;
    grade?: string;
  };
};

export function HomeworkResultShell({
  summary,
  mistakeSessionId,
  summaryVisible,
  children,
  mistakeBookEntry,
}: HomeworkResultShellProps) {
  const { t } = useI18n();
  const [showSimple, setShowSimple] = useState(false);
  const layout = getHomeworkResultShellLayout(showSimple);
  const { exporting, exportPPTX } = useExportPPTX();

  const blocks = [
    { title: t('homeworkResult.block1Title'), content: summary.stuckPoint },
    { title: t('homeworkResult.block2Title'), content: summary.whyStuck },
    { title: t('homeworkResult.block3Title'), content: summary.howToThink },
    { title: t('homeworkResult.block4Title'), content: summary.nextTimeTip },
  ];

  return (
    <div className={layout.rootClassName}>
      <div className={layout.stageHostClassName}>{children}</div>

      {!summaryVisible ? null : (
        <div className={layout.summaryPanelClassName}>
          <div className={layout.summaryCardClassName}>
            <div className="grid gap-3 p-4">
              <div className="grid gap-1">
                <h1 className="text-lg font-semibold tracking-tight">{t('homeworkResult.title')}</h1>
                <p className="text-xs leading-5 text-muted-foreground">{t('homeworkResult.desc')}</p>
              </div>

              {showSimple && summary.simplifiedExplanation ? (
                <Card className="grid gap-2 p-3">
                  <h3 className="text-sm font-semibold">{summary.simplifiedExplanation.title}</h3>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {summary.simplifiedExplanation.desc1}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {summary.simplifiedExplanation.desc2}
                  </p>
                </Card>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <Link href={`/quiz/${mistakeSessionId}`}>{t('homeworkResult.ctaPrimary')}</Link>
                </Button>
                {summary.simplifiedExplanation ? (
                  <Button
                    onClick={() => setShowSimple((value) => !value)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t('homeworkResult.ctaSecondary')}
                  </Button>
                ) : null}
                <Button asChild size="sm" type="button" variant="ghost">
                  <Link href={`/parent/${mistakeSessionId}`}>{t('homeworkParent.title')}</Link>
                </Button>
                {mistakeBookEntry?.problemText ? (
                  <AddToMistakeBookButton
                    data={{
                      problemText: mistakeBookEntry.problemText,
                      userAnswer: mistakeBookEntry.userAnswer,
                      correctAnswer: mistakeBookEntry.correctAnswer,
                      imageUrl: mistakeBookEntry.imageUrl,
                      classroomId:
                        mistakeBookEntry.classroomId ?? mistakeSessionId,
                      sessionId: mistakeBookEntry.sessionId,
                      subject: mistakeBookEntry.subject,
                      grade: mistakeBookEntry.grade,
                    }}
                  />
                ) : null}
                <Button
                  onClick={exportPPTX}
                  disabled={exporting}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {exporting ? t('export.exporting') : t('export.pptx')}
                </Button>
              </div>

              <p className="text-xs leading-5 text-muted-foreground">{t('homeworkResult.footerTip')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
