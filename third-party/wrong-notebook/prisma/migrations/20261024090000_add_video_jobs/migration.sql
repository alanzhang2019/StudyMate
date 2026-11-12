-- CreateTable
CREATE TABLE "VideoJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "errorItemId" TEXT NOT NULL,
    "vtProblemId" INTEGER NOT NULL,
    "vtJobId" INTEGER NOT NULL,
    "vtVideoId" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'created',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoJob_errorItemId_fkey" FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoJob_userId_errorItemId_key" ON "VideoJob"("userId", "errorItemId");

-- CreateIndex
CREATE INDEX "VideoJob_errorItemId_idx" ON "VideoJob"("errorItemId");
