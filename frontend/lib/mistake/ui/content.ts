import type { HomeworkHomeViewModel } from './types';

export function getHomeworkHomeContent(t: (key: string) => string): HomeworkHomeViewModel {
  return {
    title: t('homeworkHome.title'),
    subtitle: t('homeworkHome.subtitle'),
    ctaPrimary: t('homeworkHome.ctaPrimary'),
    ctaSecondary: t('homeworkHome.ctaSecondary'),
    sceneHint: t('homeworkHome.sceneHint'),
    values: [t('homeworkHome.value1'), t('homeworkHome.value2'), t('homeworkHome.value3')],
    uploadHint: t('homeworkHome.uploadHint'),
    uploadTip: t('homeworkHome.uploadTip'),
    parentHint: t('homeworkHome.parentHint'),
    emptyTitle: t('homeworkHome.emptyTitle'),
    emptyDesc: t('homeworkHome.emptyDesc'),
  };
}
