-- AlterTable
ALTER TABLE "extraction" ADD COLUMN     "toolType" TEXT NOT NULL DEFAULT 'extraction-lease';

-- AlterTable
ALTER TABLE "extraction_job" ADD COLUMN     "toolType" TEXT NOT NULL DEFAULT 'extraction-lease';

-- CreateIndex
CREATE INDEX "extraction_toolType_idx" ON "extraction"("toolType");

-- CreateIndex
CREATE INDEX "extraction_job_toolType_idx" ON "extraction_job"("toolType");
