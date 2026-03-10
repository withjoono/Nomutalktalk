-- CreateTable
CREATE TABLE "CaseUpdate" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseUpdate_caseId_idx" ON "CaseUpdate"("caseId");

-- CreateIndex
CREATE INDEX "CaseUpdate_caseId_type_idx" ON "CaseUpdate"("caseId", "type");

-- AddForeignKey
ALTER TABLE "CaseUpdate" ADD CONSTRAINT "CaseUpdate_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LaborCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
