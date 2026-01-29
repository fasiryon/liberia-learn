/*
  Warnings:

  - A unique constraint covering the columns `[ewoId]` on the table `GovernedArtifact` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GovernedArtifact_ewoId_key" ON "GovernedArtifact"("ewoId");
