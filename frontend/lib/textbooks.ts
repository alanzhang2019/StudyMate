// 自动生成：python 脚本扫描 E:/教材 生成，请勿手工排序/改名。
// slug 即 nginx /textbooks/ 直出的文件名（不含扩展名），全 ASCII，
// 与 .workbuddy/textbook-upload-map.tsv 的映射保持一致。

export type SubjectKey =
  | 'chinese'
  | 'math'
  | 'english'
  | 'science'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'geography'
  | 'ethics';

export type Semester = '上册' | '下册' | '全一册';

export interface Textbook {
  /** 文件 slug，URL 为 /textbooks/<slug>.pdf */
  slug: string;
  subject: SubjectKey;
  grade: number; // 1-9
  semester: Semester;
  publisher: string;
  /** 完整显示名，如「语文 · 一年级 · 上册」 */
  title: string;
  sizeBytes: number;
  /** 压缩轻量版（同一册的更小体积版本） */
  lite?: boolean;
}

export const SUBJECT_ORDER: SubjectKey[] = [
  'chinese', 'math', 'english', 'science', 'physics', 'chemistry', 'biology', 'history', 'geography', 'ethics',
];

export const SUBJECT_LABEL: Record<SubjectKey, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  science: '科学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  ethics: '道德与法治',
};

/** 每个科目的版本说明（深圳在用版本） */
export const SUBJECT_NOTE: Record<SubjectKey, string> = {
  chinese: '部编版 · 全国统一',
  math: '北师大版 · 深圳在用',
  english: '沪教牛津版 · 深圳在用',
  science: '教科版 · 深圳在用',
  physics: '人教版 · 深圳在用',
  chemistry: '人教版 · 深圳在用',
  biology: '人教版 · 深圳在用',
  history: '人教版 · 深圳在用',
  geography: '湘教版 · 深圳在用',
  ethics: '人教版 · 深圳在用',
};

export const GRADE_CN: Record<number, string> = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九',
};

export const TEXTBOOKS: Textbook[] = [
  { slug: 'chinese-bj-g1a', subject: 'chinese', grade: 1, semester: '上册', publisher: '部编版', title: '语文 · 一年级 · 上册', sizeBytes: 10502884 },
  { slug: 'chinese-bj-g1b', subject: 'chinese', grade: 1, semester: '下册', publisher: '部编版', title: '语文 · 一年级 · 下册', sizeBytes: 11991869 },
  { slug: 'chinese-bj-g2a', subject: 'chinese', grade: 2, semester: '上册', publisher: '部编版', title: '语文 · 二年级 · 上册', sizeBytes: 12924031 },
  { slug: 'chinese-bj-g2b', subject: 'chinese', grade: 2, semester: '下册', publisher: '部编版', title: '语文 · 二年级 · 下册', sizeBytes: 12756238 },
  { slug: 'chinese-bj-g3a', subject: 'chinese', grade: 3, semester: '上册', publisher: '部编版', title: '语文 · 三年级 · 上册', sizeBytes: 12308429 },
  { slug: 'chinese-bj-g3b', subject: 'chinese', grade: 3, semester: '下册', publisher: '部编版', title: '语文 · 三年级 · 下册', sizeBytes: 12065669 },
  { slug: 'chinese-bj-g4a', subject: 'chinese', grade: 4, semester: '上册', publisher: '部编版', title: '语文 · 四年级 · 上册', sizeBytes: 44706943 },
  { slug: 'chinese-bj-g4b', subject: 'chinese', grade: 4, semester: '下册', publisher: '部编版', title: '语文 · 四年级 · 下册', sizeBytes: 15995974 },
  { slug: 'chinese-bj-g5a', subject: 'chinese', grade: 5, semester: '上册', publisher: '部编版', title: '语文 · 五年级 · 上册', sizeBytes: 28163237 },
  { slug: 'chinese-bj-g5b', subject: 'chinese', grade: 5, semester: '下册', publisher: '部编版', title: '语文 · 五年级 · 下册', sizeBytes: 14327145 },
  { slug: 'chinese-bj-g6a', subject: 'chinese', grade: 6, semester: '上册', publisher: '部编版', title: '语文 · 六年级 · 上册', sizeBytes: 14503311 },
  { slug: 'chinese-bj-g6b', subject: 'chinese', grade: 6, semester: '下册', publisher: '部编版', title: '语文 · 六年级 · 下册', sizeBytes: 14114299 },
  { slug: 'chinese-bj-g7a', subject: 'chinese', grade: 7, semester: '上册', publisher: '部编版', title: '语文 · 七年级 · 上册', sizeBytes: 16662910 },
  { slug: 'chinese-bj-g7b', subject: 'chinese', grade: 7, semester: '下册', publisher: '部编版', title: '语文 · 七年级 · 下册', sizeBytes: 18960615 },
  { slug: 'chinese-bj-g8a', subject: 'chinese', grade: 8, semester: '上册', publisher: '部编版', title: '语文 · 八年级 · 上册', sizeBytes: 18237456 },
  { slug: 'chinese-bj-g8b', subject: 'chinese', grade: 8, semester: '下册', publisher: '部编版', title: '语文 · 八年级 · 下册', sizeBytes: 17416419 },
  { slug: 'chinese-bj-g9a', subject: 'chinese', grade: 9, semester: '上册', publisher: '部编版', title: '语文 · 九年级 · 上册', sizeBytes: 17816200 },
  { slug: 'chinese-bj-g9b', subject: 'chinese', grade: 9, semester: '下册', publisher: '部编版', title: '语文 · 九年级 · 下册', sizeBytes: 17045839 },
  { slug: 'math-bnu-g1a', subject: 'math', grade: 1, semester: '上册', publisher: '北师大版', title: '数学 · 一年级 · 上册', sizeBytes: 9522844 },
  { slug: 'math-bnu-g1b', subject: 'math', grade: 1, semester: '下册', publisher: '北师大版', title: '数学 · 一年级 · 下册', sizeBytes: 9506422 },
  { slug: 'math-bnu-g2a', subject: 'math', grade: 2, semester: '上册', publisher: '北师大版', title: '数学 · 二年级 · 上册', sizeBytes: 11223192 },
  { slug: 'math-bnu-g2b', subject: 'math', grade: 2, semester: '下册', publisher: '北师大版', title: '数学 · 二年级 · 下册', sizeBytes: 10439625 },
  { slug: 'math-bnu-g3a', subject: 'math', grade: 3, semester: '上册', publisher: '北师大版', title: '数学 · 三年级 · 上册', sizeBytes: 11601719 },
  { slug: 'math-bnu-g3b', subject: 'math', grade: 3, semester: '下册', publisher: '北师大版', title: '数学 · 三年级 · 下册', sizeBytes: 10565452 },
  { slug: 'math-bnu-g4a', subject: 'math', grade: 4, semester: '上册', publisher: '北师大版', title: '数学 · 四年级 · 上册', sizeBytes: 22725541 },
  { slug: 'math-bnu-g4b', subject: 'math', grade: 4, semester: '下册', publisher: '北师大版', title: '数学 · 四年级 · 下册', sizeBytes: 11743675 },
  { slug: 'math-bnu-g5a', subject: 'math', grade: 5, semester: '上册', publisher: '北师大版', title: '数学 · 五年级 · 上册', sizeBytes: 26011289 },
  { slug: 'math-bnu-g5b', subject: 'math', grade: 5, semester: '下册', publisher: '北师大版', title: '数学 · 五年级 · 下册', sizeBytes: 10464222 },
  { slug: 'math-bnu-g6a', subject: 'math', grade: 6, semester: '上册', publisher: '北师大版', title: '数学 · 六年级 · 上册', sizeBytes: 12093627 },
  { slug: 'math-bnu-g6b', subject: 'math', grade: 6, semester: '下册', publisher: '北师大版', title: '数学 · 六年级 · 下册', sizeBytes: 12208264 },
  { slug: 'math-bnu-g7a', subject: 'math', grade: 7, semester: '上册', publisher: '北师大版', title: '数学 · 七年级 · 上册', sizeBytes: 17090687 },
  { slug: 'math-bnu-g7b', subject: 'math', grade: 7, semester: '下册', publisher: '北师大版', title: '数学 · 七年级 · 下册', sizeBytes: 15354561 },
  { slug: 'math-bnu-g8a', subject: 'math', grade: 8, semester: '上册', publisher: '北师大版', title: '数学 · 八年级 · 上册', sizeBytes: 18493092 },
  { slug: 'math-bnu-g8b', subject: 'math', grade: 8, semester: '下册', publisher: '北师大版', title: '数学 · 八年级 · 下册', sizeBytes: 15510469 },
  { slug: 'math-bnu-g9a', subject: 'math', grade: 9, semester: '上册', publisher: '北师大版', title: '数学 · 九年级 · 上册', sizeBytes: 15455781 },
  { slug: 'math-bnu-g9b', subject: 'math', grade: 9, semester: '下册', publisher: '北师大版', title: '数学 · 九年级 · 下册', sizeBytes: 10938397 },
  { slug: 'english-ox-g3a', subject: 'english', grade: 3, semester: '上册', publisher: '沪教牛津版', title: '英语 · 三年级 · 上册', sizeBytes: 10909543 },
  { slug: 'english-ox-g3b', subject: 'english', grade: 3, semester: '下册', publisher: '沪教牛津版', title: '英语 · 三年级 · 下册', sizeBytes: 10552916 },
  { slug: 'english-sh-g4a', subject: 'english', grade: 4, semester: '上册', publisher: '沪教版', title: '英语 · 四年级 · 上册', sizeBytes: 20996668 },
  { slug: 'english-ox-g4b', subject: 'english', grade: 4, semester: '下册', publisher: '沪教牛津版', title: '英语 · 四年级 · 下册', sizeBytes: 10211022 },
  { slug: 'english-sh-g5a', subject: 'english', grade: 5, semester: '上册', publisher: '沪教版', title: '英语 · 五年级 · 上册', sizeBytes: 23220801 },
  { slug: 'english-ox-g5b', subject: 'english', grade: 5, semester: '下册', publisher: '沪教牛津版', title: '英语 · 五年级 · 下册', sizeBytes: 11125476 },
  { slug: 'english-ox-g6a', subject: 'english', grade: 6, semester: '上册', publisher: '沪教牛津版', title: '英语 · 六年级 · 上册', sizeBytes: 10116794 },
  { slug: 'english-ox-g6b', subject: 'english', grade: 6, semester: '下册', publisher: '沪教牛津版', title: '英语 · 六年级 · 下册', sizeBytes: 11188094 },
  { slug: 'english-ox-g7a', subject: 'english', grade: 7, semester: '上册', publisher: '沪教牛津版', title: '英语 · 七年级 · 上册', sizeBytes: 17805348 },
  { slug: 'english-ox-g7b', subject: 'english', grade: 7, semester: '下册', publisher: '沪教牛津版', title: '英语 · 七年级 · 下册', sizeBytes: 18365702 },
  { slug: 'english-ox-g8a', subject: 'english', grade: 8, semester: '上册', publisher: '沪教牛津版', title: '英语 · 八年级 · 上册', sizeBytes: 17847834 },
  { slug: 'english-ox-g8b', subject: 'english', grade: 8, semester: '下册', publisher: '沪教牛津版', title: '英语 · 八年级 · 下册', sizeBytes: 18518905 },
  { slug: 'english-ox-g9a', subject: 'english', grade: 9, semester: '上册', publisher: '沪教牛津版', title: '英语 · 九年级 · 上册', sizeBytes: 17934005 },
  { slug: 'english-ox-g9b', subject: 'english', grade: 9, semester: '下册', publisher: '沪教牛津版', title: '英语 · 九年级 · 下册', sizeBytes: 14440648 },
  { slug: 'science-ed-g1a', subject: 'science', grade: 1, semester: '上册', publisher: '教科版', title: '科学 · 一年级 · 上册', sizeBytes: 7647891 },
  { slug: 'science-ed-g1b', subject: 'science', grade: 1, semester: '下册', publisher: '教科版', title: '科学 · 一年级 · 下册', sizeBytes: 6130757 },
  { slug: 'science-ed-g2a', subject: 'science', grade: 2, semester: '上册', publisher: '教科版', title: '科学 · 二年级 · 上册', sizeBytes: 6796703 },
  { slug: 'science-ed-g2b', subject: 'science', grade: 2, semester: '下册', publisher: '教科版', title: '科学 · 二年级 · 下册', sizeBytes: 6109679 },
  { slug: 'science-ed-g3a', subject: 'science', grade: 3, semester: '上册', publisher: '教科版', title: '科学 · 三年级 · 上册', sizeBytes: 10723411 },
  { slug: 'science-ed-g3b', subject: 'science', grade: 3, semester: '下册', publisher: '教科版', title: '科学 · 三年级 · 下册', sizeBytes: 10739330 },
  { slug: 'science-ed-g4a', subject: 'science', grade: 4, semester: '上册', publisher: '教科版', title: '科学 · 四年级 · 上册', sizeBytes: 242262069 },
  { slug: 'science-ed-g4a-lite', subject: 'science', grade: 4, semester: '上册', publisher: '教科版', title: '科学 · 四年级 · 上册（轻量版）', sizeBytes: 9725136, lite: true },
  { slug: 'science-ed-g4b', subject: 'science', grade: 4, semester: '下册', publisher: '教科版', title: '科学 · 四年级 · 下册', sizeBytes: 112230779 },
  { slug: 'science-ed-g4b-lite', subject: 'science', grade: 4, semester: '下册', publisher: '教科版', title: '科学 · 四年级 · 下册（轻量版）', sizeBytes: 9052695, lite: true },
  { slug: 'science-ed-g5a', subject: 'science', grade: 5, semester: '上册', publisher: '教科版', title: '科学 · 五年级 · 上册', sizeBytes: 55886978 },
  { slug: 'science-ed-g5b', subject: 'science', grade: 5, semester: '下册', publisher: '教科版', title: '科学 · 五年级 · 下册', sizeBytes: 10512001 },
  { slug: 'science-ed-g6a', subject: 'science', grade: 6, semester: '上册', publisher: '教科版', title: '科学 · 六年级 · 上册', sizeBytes: 14908643 },
  { slug: 'science-ed-g6b', subject: 'science', grade: 6, semester: '下册', publisher: '教科版', title: '科学 · 六年级 · 下册', sizeBytes: 12137901 },
  { slug: 'physics-pep-g8a', subject: 'physics', grade: 8, semester: '上册', publisher: '人教版', title: '物理 · 八年级 · 上册', sizeBytes: 16249861 },
  { slug: 'physics-pep-g8b', subject: 'physics', grade: 8, semester: '下册', publisher: '人教版', title: '物理 · 八年级 · 下册', sizeBytes: 12068348 },
  { slug: 'physics-pep-g9', subject: 'physics', grade: 9, semester: '全一册', publisher: '人教版', title: '物理 · 九年级 · 全一册', sizeBytes: 20678556 },
  { slug: 'chemistry-pep-g9a', subject: 'chemistry', grade: 9, semester: '上册', publisher: '人教版', title: '化学 · 九年级 · 上册', sizeBytes: 18310115 },
  { slug: 'chemistry-pep-g9b', subject: 'chemistry', grade: 9, semester: '下册', publisher: '人教版', title: '化学 · 九年级 · 下册', sizeBytes: 11856537 },
  { slug: 'biology-pep-g7a', subject: 'biology', grade: 7, semester: '上册', publisher: '人教版', title: '生物 · 七年级 · 上册', sizeBytes: 30990676 },
  { slug: 'biology-pep-g7b', subject: 'biology', grade: 7, semester: '下册', publisher: '人教版', title: '生物 · 七年级 · 下册', sizeBytes: 31360127 },
  { slug: 'biology-pep-g8a', subject: 'biology', grade: 8, semester: '上册', publisher: '人教版', title: '生物 · 八年级 · 上册', sizeBytes: 14031533 },
  { slug: 'biology-pep-g8b', subject: 'biology', grade: 8, semester: '下册', publisher: '人教版', title: '生物 · 八年级 · 下册', sizeBytes: 11417207 },
  { slug: 'history-pep-g7a', subject: 'history', grade: 7, semester: '上册', publisher: '人教版', title: '历史 · 七年级 · 上册', sizeBytes: 29158681 },
  { slug: 'history-pep-g7b', subject: 'history', grade: 7, semester: '下册', publisher: '人教版', title: '历史 · 七年级 · 下册', sizeBytes: 14778398 },
  { slug: 'history-pep-g8a', subject: 'history', grade: 8, semester: '上册', publisher: '人教版', title: '历史 · 八年级 · 上册', sizeBytes: 16303475 },
  { slug: 'history-pep-g8b', subject: 'history', grade: 8, semester: '下册', publisher: '人教版', title: '历史 · 八年级 · 下册', sizeBytes: 17934156 },
  { slug: 'history-pep-g9a', subject: 'history', grade: 9, semester: '上册', publisher: '人教版', title: '历史 · 九年级 · 上册', sizeBytes: 15179856 },
  { slug: 'history-pep-g9b', subject: 'history', grade: 9, semester: '下册', publisher: '人教版', title: '历史 · 九年级 · 下册', sizeBytes: 12493280 },
  { slug: 'geography-xj-g7a', subject: 'geography', grade: 7, semester: '上册', publisher: '湘教版', title: '地理 · 七年级 · 上册', sizeBytes: 25030249 },
  { slug: 'geography-xj-g7b', subject: 'geography', grade: 7, semester: '下册', publisher: '湘教版', title: '地理 · 七年级 · 下册', sizeBytes: 40917816 },
  { slug: 'geography-xj-g8a', subject: 'geography', grade: 8, semester: '上册', publisher: '湘教版', title: '地理 · 八年级 · 上册', sizeBytes: 15655818 },
  { slug: 'geography-xj-g8b', subject: 'geography', grade: 8, semester: '下册', publisher: '湘教版', title: '地理 · 八年级 · 下册', sizeBytes: 17202745 },
  { slug: 'ethics-pep-g7a', subject: 'ethics', grade: 7, semester: '上册', publisher: '人教版', title: '道德与法治 · 七年级 · 上册', sizeBytes: 9736802 },
  { slug: 'ethics-pep-g7b', subject: 'ethics', grade: 7, semester: '下册', publisher: '人教版', title: '道德与法治 · 七年级 · 下册', sizeBytes: 10382451 },
  { slug: 'ethics-pep-g8a', subject: 'ethics', grade: 8, semester: '上册', publisher: '人教版', title: '道德与法治 · 八年级 · 上册', sizeBytes: 11798266 },
  { slug: 'ethics-pep-g8b', subject: 'ethics', grade: 8, semester: '下册', publisher: '人教版', title: '道德与法治 · 八年级 · 下册', sizeBytes: 12359294 },
  { slug: 'ethics-pep-g9a', subject: 'ethics', grade: 9, semester: '上册', publisher: '人教版', title: '道德与法治 · 九年级 · 上册', sizeBytes: 11490679 },
  { slug: 'ethics-pep-g9b', subject: 'ethics', grade: 9, semester: '下册', publisher: '人教版', title: '道德与法治 · 九年级 · 下册', sizeBytes: 9520471 },
];

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  if (bytes >= 1024 * 1024) return Math.round(bytes / 1024 / 1024) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/** 按科目分组的教材，供下拉框用 optgroup 渲染（科目顺序 = SUBJECT_ORDER） */
export interface TextbookGroup {
  subject: SubjectKey;
  label: string;
  books: Textbook[];
}

export function groupTextbooksBySubject(): TextbookGroup[] {
  return SUBJECT_ORDER.map((subject) => ({
    subject,
    label: SUBJECT_LABEL[subject],
    books: TEXTBOOKS.filter((t) => t.subject === subject),
  })).filter((g) => g.books.length > 0);
}

/** 由 slug 反查显示名（用于作品墙/详情页展示）；非法或空返回 '' */
export function textbookTitle(slug: string | null | undefined): string {
  if (!slug) return '';
  const t = TEXTBOOKS.find((b) => b.slug === slug);
  return t ? t.title : '';
}
