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

INSERT INTO "CurriculumContent" ("id") VALUES ('p2a-local-content');
