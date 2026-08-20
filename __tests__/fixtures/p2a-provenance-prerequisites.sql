-- Minimal pre-P2-A tables for disposable PostgreSQL migration integration tests.
CREATE TABLE "CurriculumContent" (
  "id" TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE "AIInteraction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "CurriculumContent" ("id") VALUES
  ('p2a-local-content-1'),
  ('p2a-local-content-2');
