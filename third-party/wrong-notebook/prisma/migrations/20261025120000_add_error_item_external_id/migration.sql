-- 批次210-D：外部系统（hl-platform）推送错题的幂等键
--
-- 为什么加这一列：
--   交卷判完后 hl-platform 会把错题/半对题推进来。同一道题学生可能重考多次，
--   网络重试也可能重复提交 —— 没有幂等键，错题本里会堆出一堆一模一样的题。
--   externalId 由调用方生成（mapKey|pointKey|题目 id），(userId, externalId) 唯一。
--
-- 为什么是 ALTER TABLE 而不是重建表：
--   这一列可空、无默认值，SQLite 的 ADD COLUMN 是 O(1) 的元数据操作，
--   不碰已有 11 条数据；本应用自己建的错题 externalId 保持 NULL，
--   而 SQLite 的唯一索引允许多个 NULL ⇒ 老数据不会互相冲突。

-- AlterTable
ALTER TABLE "ErrorItem" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ErrorItem_userId_externalId_key" ON "ErrorItem"("userId", "externalId");
