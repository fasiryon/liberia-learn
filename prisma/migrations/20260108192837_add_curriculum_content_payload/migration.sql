/*
  Warnings:

  - You are about to drop the column `jsonData` on the `CurriculumContent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hash]` on the table `CurriculumContent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `payload` to the `CurriculumContent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `artifact_json` to the `GovernedArtifact` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."CurriculumContent_grade_subject_contentType_idx";

-- DropIndex
DROP INDEX "public"."CurriculumContent_status_idx";

-- AlterTable
ALTER TABLE "CurriculumContent" DROP COLUMN "jsonData",
ADD COLUMN     "hash" TEXT,
ADD COLUMN     "payload" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "GovernedArtifact" ADD COLUMN     "artifact_json" JSONB NOT NULL,
ADD COLUMN     "content_type" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumContent_hash_key" ON "CurriculumContent"("hash");

-- CreateIndex
CREATE INDEX "CurriculumContent_grade_subject_idx" ON "CurriculumContent"("grade", "subject");

-- CreateIndex
CREATE INDEX "CurriculumContent_contentType_status_idx" ON "CurriculumContent"("contentType", "status");
