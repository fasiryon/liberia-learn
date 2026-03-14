ALTER TABLE "School"
ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "School_code_key" ON "School"("code");
