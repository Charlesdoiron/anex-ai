-- AlterTable
ALTER TABLE "insee_rental_reference_index" ADD COLUMN "indexType" TEXT NOT NULL DEFAULT 'ILAT';

-- CreateIndex
CREATE INDEX "insee_rental_reference_index_indexType_idx" ON "insee_rental_reference_index"("indexType");

-- CreateIndex (unique constraint)
CREATE UNIQUE INDEX "insee_rental_reference_index_indexType_year_quarter_key" ON "insee_rental_reference_index"("indexType", "year", "quarter");

