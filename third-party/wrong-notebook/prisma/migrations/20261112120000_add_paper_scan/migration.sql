-- 2026-11-12 批次 WNPAPER：「拍整张卷子」收错题
-- 目标：一张卷子 = 一条 PaperScan + 1..6 条 PaperPage（整页图一页只存一份），
--       错题条目通过 paperScanId / paperPageNo 指回原卷，详情页可回看原页。
--
-- ★ 为什么 ErrorItem 只加两个可空列、不建外键关系：
--   SQLite 加外键要「建新表 → 拷数据 → 删旧表 → 改名」，而 ErrorItem 是全库最核心的表
--   （线上有真学生的错题）。这里只需要"指回原卷"，级联删除由 /api/paper-scans 手工维护，
--   代价换的是「老数据一个字节都不动」。
-- ★ 全部列可空/有默认值 ⇒ 存量行的行为与本次改动前完全一致。

-- CreateTable: 卷子
CREATE TABLE "PaperScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "title" TEXT,
    "gradeSemester" TEXT,
    "paperLevel" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: 整页原图
CREATE TABLE "PaperPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "pageNo" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperPage_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "PaperScan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PaperScan_userId_idx" ON "PaperScan"("userId");
CREATE INDEX "PaperPage_scanId_idx" ON "PaperPage"("scanId");
CREATE UNIQUE INDEX "PaperPage_scanId_pageNo_key" ON "PaperPage"("scanId", "pageNo");

-- AlterTable
ALTER TABLE "ErrorItem" ADD COLUMN "paperScanId" TEXT;
ALTER TABLE "ErrorItem" ADD COLUMN "paperPageNo" INTEGER;

-- CreateIndex
CREATE INDEX "ErrorItem_paperScanId_idx" ON "ErrorItem"("paperScanId");
