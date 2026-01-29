-- CreateTable
CREATE TABLE "GovernedArtifact" (
    "id" TEXT NOT NULL,
    "ewoId" TEXT NOT NULL,
    "schemaId" TEXT,
    "subject" TEXT,
    "grade" INTEGER,
    "contentType" TEXT,
    "scale" TEXT,
    "language" TEXT,
    "governanceDecision" TEXT NOT NULL,
    "governanceReason" TEXT,
    "artifactJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernedArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "FactoryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovernedArtifact_ewoId_idx" ON "GovernedArtifact"("ewoId");

-- CreateIndex
CREATE INDEX "GovernedArtifact_schemaId_idx" ON "GovernedArtifact"("schemaId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryRun_runId_key" ON "FactoryRun"("runId");
