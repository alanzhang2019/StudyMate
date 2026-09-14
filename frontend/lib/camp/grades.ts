/**
 * 少年 AI 创造营 — 年级选项
 * 从一年级覆盖到高三（十二年级），并保留「不便透露」作为默认/隐私选项。
 * 供客户端表单与服务器端校验共用，避免前后端选项漂移。
 */
export const GRADE_OPTIONS = [
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '七年级',
  '八年级',
  '九年级',
  '十年级',
  '十一年级',
  '十二年级',
  '不便透露',
] as const;

export type GradeOption = (typeof GRADE_OPTIONS)[number];
