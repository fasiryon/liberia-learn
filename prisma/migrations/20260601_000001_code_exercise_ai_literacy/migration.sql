-- NR-14D Phase 1: CodeExercise + AILiteracyExercise tables
-- Gradeable Python coding exercises + AI literacy critical-thinking exercises

CREATE TABLE "CodeExercise" (
  "id"                TEXT NOT NULL,
  "lessonId"          TEXT NOT NULL,
  "promptId"          TEXT NOT NULL,
  "title"             TEXT NOT NULL,
  "description"       TEXT NOT NULL,
  "starterCode"       TEXT NOT NULL,
  "referenceSolution" TEXT NOT NULL,
  "languageId"        INTEGER NOT NULL DEFAULT 71,
  "testCases"         JSONB NOT NULL,
  "difficulty"        TEXT NOT NULL DEFAULT 'intro',
  "validatedAt"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CodeExercise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CodeExercise_promptId_key" ON "CodeExercise"("promptId");
CREATE INDEX "CodeExercise_lessonId_idx" ON "CodeExercise"("lessonId");

CREATE TABLE "AILiteracyExercise" (
  "id"                       TEXT NOT NULL,
  "lessonId"                 TEXT NOT NULL,
  "promptId"                 TEXT NOT NULL,
  "title"                    TEXT NOT NULL,
  "type"                     TEXT NOT NULL,
  "scenario"                 TEXT NOT NULL,
  "studentPromptInstruction" TEXT,
  "rubric"                   JSONB NOT NULL,
  "gradedBy"                 TEXT NOT NULL DEFAULT 'llm',
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AILiteracyExercise_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AILiteracyExercise_promptId_key" ON "AILiteracyExercise"("promptId");
CREATE INDEX "AILiteracyExercise_lessonId_idx" ON "AILiteracyExercise"("lessonId");
