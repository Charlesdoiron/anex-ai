-- CreateEnum
CREATE TYPE "ExtractionJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- AlterTable
ALTER TABLE "extraction" ADD COLUMN     "pipelineId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "extraction_job" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "status" "ExtractionJobStatus" NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "message" TEXT,
    "partialResult" JSONB,
    "documentId" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "extraction_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_job_userId_idx" ON "extraction_job"("userId");

-- CreateIndex
CREATE INDEX "extraction_job_status_idx" ON "extraction_job"("status");

-- CreateIndex
CREATE INDEX "extraction_job_createdAt_idx" ON "extraction_job"("createdAt");
