-- Phase 5A Surface: cached WAEC-style practice question bank. Additive.
CREATE TABLE IF NOT EXISTS "WaecPracticeItem" (
  "id"           TEXT NOT NULL,
  "subjectId"    TEXT NOT NULL,
  "topicId"      TEXT NOT NULL,
  "prompt"       TEXT NOT NULL,
  "options"      JSONB NOT NULL,
  "correctIndex" INTEGER NOT NULL,
  "explanation"  TEXT,
  "grade"        INTEGER NOT NULL DEFAULT 11,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WaecPracticeItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WaecPracticeItem_subjectId_topicId_idx" ON "WaecPracticeItem" ("subjectId", "topicId");
