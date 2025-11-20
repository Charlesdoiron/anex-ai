/*
  Warnings:

  - You are about to drop the `InseeRentalReferenceIndex` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "InseeRentalReferenceIndex";

-- CreateTable
CREATE TABLE "insee_rental_reference_index" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insee_rental_reference_index_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insee_rental_reference_index_year_idx" ON "insee_rental_reference_index"("year");

-- CreateIndex
CREATE INDEX "insee_rental_reference_index_quarter_idx" ON "insee_rental_reference_index"("quarter");

-- CreateIndex
CREATE INDEX "insee_rental_reference_index_value_idx" ON "insee_rental_reference_index"("value");

-- CreateIndex
CREATE INDEX "insee_rental_reference_index_createdAt_idx" ON "insee_rental_reference_index"("createdAt");
