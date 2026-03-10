-- AlterTable
ALTER TABLE "LaborCase" ADD COLUMN     "analysisCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chatCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "evidenceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "insightCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAnalyzedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AnalysisVersion" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "data" JSONB NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseInsight" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'user_memo',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTimeline" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "version" INTEGER,
    "trigger" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisVersion_caseId_idx" ON "AnalysisVersion"("caseId");

-- CreateIndex
CREATE INDEX "AnalysisVersion_caseId_stepName_idx" ON "AnalysisVersion"("caseId", "stepName");

-- CreateIndex
CREATE INDEX "CaseInsight_caseId_idx" ON "CaseInsight"("caseId");

-- CreateIndex
CREATE INDEX "CaseTimeline_caseId_idx" ON "CaseTimeline"("caseId");

-- CreateIndex
CREATE INDEX "CaseTimeline_caseId_createdAt_idx" ON "CaseTimeline"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "AnalysisVersion" ADD CONSTRAINT "AnalysisVersion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LaborCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseInsight" ADD CONSTRAINT "CaseInsight_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LaborCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTimeline" ADD CONSTRAINT "CaseTimeline_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LaborCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
