/*
  Warnings:

  - You are about to drop the column `pipelineId` on the `extraction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[documentId]` on the table `extraction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `averageConfidence` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentId` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extractedFields` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extractionDate` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lowConfidenceFields` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `missingFields` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processingTimeMs` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `structuredData` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalFields` to the `extraction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `extraction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "extraction" DROP COLUMN "pipelineId",
ADD COLUMN     "averageConfidence" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "documentId" TEXT NOT NULL,
ADD COLUMN     "extractedFields" INTEGER NOT NULL,
ADD COLUMN     "extractionDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "lowConfidenceFields" INTEGER NOT NULL,
ADD COLUMN     "missingFields" INTEGER NOT NULL,
ADD COLUMN     "processingTimeMs" INTEGER NOT NULL,
ADD COLUMN     "retries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "structuredData" JSONB NOT NULL,
ADD COLUMN     "totalFields" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usedOcrEngine" TEXT;

-- CreateTable
CREATE TABLE "raw_text" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_text_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InseeRentalReferenceIndex" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InseeRentalReferenceIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raw_text_documentId_key" ON "raw_text"("documentId");

-- CreateIndex
CREATE INDEX "raw_text_documentId_idx" ON "raw_text"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_documentId_key" ON "extraction"("documentId");

-- CreateIndex
CREATE INDEX "extraction_documentId_idx" ON "extraction"("documentId");
