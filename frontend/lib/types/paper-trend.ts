// frontend/lib/types/paper-trend.ts
//
// 与 GET /api/csp-quiz/paper-trend 响应里 papers[] 的单条结构对应。
// 这里独立定义而不是 import route.ts 的 type，是因为前端组件不应该
// 反向依赖 server 路由文件。
export type PaperTrendItem = {
  classroomId: string;
  title: string;
  year: number;
  group: 'J' | 'S';
  choice: { earned: number; max: number };
  read: { earned: number; max: number };
  perfect: { earned: number; max: number };
  total: { earned: number; max: number; score: number };
  submittedAt: string;
  sceneCount: number;
  mode: 'standard' | 'legacy';
};
