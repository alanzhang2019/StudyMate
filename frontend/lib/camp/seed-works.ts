/**
 * 前端静态「种子作品」的 slug。
 *
 * 这两个早期示范作品（炳炳 / 小高）不落库，详情页由
 * `app/camp/work/[slug]/page.tsx` 里的 SEED_WORKS 常量直接渲染，
 * 所以讨论区/评分接口按 id 查 camp_works 时会查不到。
 *
 * 这里导出一份 slug 清单供接口侧放行，让种子作品也能被评论和打分
 * （数据照常落库，只是外键指向一个不存在于 camp_works 的 id）。
 * 新增/下线种子作品时改这里。
 */
export const SEED_WORK_SLUGS: ReadonlySet<string> = new Set([
  'animal-maze-battle',
  'formation-editor',
]);

export function isSeedWorkSlug(id: string | undefined | null): boolean {
  return !!id && SEED_WORK_SLUGS.has(id);
}
