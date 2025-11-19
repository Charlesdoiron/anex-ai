-- CreateTable
CREATE TABLE "extraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "pageCount" INTEGER,
    "pipelineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_userId_idx" ON "extraction"("userId");

-- CreateIndex
CREATE INDEX "extraction_createdAt_idx" ON "extraction"("createdAt");

-- AddForeignKey
ALTER TABLE "extraction" ADD CONSTRAINT "extraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
