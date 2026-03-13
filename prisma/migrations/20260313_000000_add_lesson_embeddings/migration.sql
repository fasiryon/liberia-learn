CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "CurriculumContent"
ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS curriculum_content_embedding_idx
ON "CurriculumContent"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
