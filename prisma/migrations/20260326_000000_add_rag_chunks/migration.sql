CREATE TABLE "RagChunk" (
  "id" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "subject" TEXT,
  "grade" INTEGER,
  "schoolId" TEXT,
  "scope" TEXT NOT NULL,
  "sourceLabel" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "embeddedAt" TIMESTAMP(3),
  "embedding" vector(1536),

  CONSTRAINT "RagChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RagChunk_sourceType_sourceId_chunkIndex_key"
  ON "RagChunk"("sourceType", "sourceId", "chunkIndex");

CREATE INDEX "RagChunk_schoolId_scope_idx"
  ON "RagChunk"("schoolId", "scope");

CREATE INDEX "RagChunk_sourceType_sourceId_idx"
  ON "RagChunk"("sourceType", "sourceId");

CREATE INDEX "RagChunk_subject_grade_idx"
  ON "RagChunk"("subject", "grade");

CREATE INDEX "rag_chunk_embedding_idx"
  ON "RagChunk"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE "RagChunk"
  ADD CONSTRAINT "RagChunk_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
