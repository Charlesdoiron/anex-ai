-- CreateTable
CREATE TABLE "export" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_userId_idx" ON "export"("userId");

-- CreateIndex
CREATE INDEX "export_createdAt_idx" ON "export"("createdAt");

-- AddForeignKey
ALTER TABLE "export" ADD CONSTRAINT "export_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
