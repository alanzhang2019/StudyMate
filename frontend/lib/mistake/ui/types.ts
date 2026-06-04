export type HomeworkHomeViewModel = {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  sceneHint: string;
  values: string[];
  uploadHint: string;
  uploadTip: string;
  parentHint: string;
  emptyTitle: string;
  emptyDesc: string;
};

export type ExplanationSummary = {
  stuckPoint: string;
  whyStuck: string;
  howToThink: string;
  nextTimeTip: string;
  simplifiedExplanation?: {
    title: string;
    desc1: string;
    desc2: string;
  };
};

export type HomeworkHistoryStatus = 'pending' | 'done';
