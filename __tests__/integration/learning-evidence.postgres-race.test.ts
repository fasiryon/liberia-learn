import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Local-only integration gate. Point LEARNING_EVIDENCE_POSTGRES_URL at a
 * disposable database after applying the canonical migration; CI has no
 * Postgres service and therefore skips this file.
 */
const url = process.env.LEARNING_EVIDENCE_POSTGRES_URL;
const enabled = Boolean(url);
const prisma = enabled ? new PrismaClient({ datasources: { db: { url: url! } } }) : null;
const schema = `learning_evidence_race_${process.pid}_${Date.now()}`;

describe.skipIf(!enabled)("learning evidence integrity on real PostgreSQL", () => {
  beforeAll(async () => {
    await prisma!.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await prisma!.$executeRawUnsafe(`
      CREATE TABLE "${schema}"."progress" (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        student_id text NOT NULL,
        lesson_id text NOT NULL,
        completed_at timestamptz,
        UNIQUE (student_id, lesson_id)
      )
    `);
    await prisma!.$executeRawUnsafe(`
      CREATE TABLE "${schema}"."placement_session" (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        student_id text NOT NULL,
        status text NOT NULL
      )
    `);
    await prisma!.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "one_active_session" ON "${schema}"."placement_session" (student_id) WHERE status = 'ACTIVE'`,
    );
  });

  afterAll(async () => {
    await prisma!.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await prisma!.$disconnect();
  });

  it("allows exactly one simultaneous completion claimant", async () => {
    await prisma!.$executeRawUnsafe(
      `INSERT INTO "${schema}"."progress" (student_id, lesson_id) VALUES ('student-1', 'lesson-1')`,
    );
    await Promise.all([
      prisma!.$queryRawUnsafe(`UPDATE "${schema}"."progress" SET completed_at = now() WHERE student_id = 'student-1' AND lesson_id = 'lesson-1' AND completed_at IS NULL RETURNING id`),
      prisma!.$queryRawUnsafe(`UPDATE "${schema}"."progress" SET completed_at = now() WHERE student_id = 'student-1' AND lesson_id = 'lesson-1' AND completed_at IS NULL RETURNING id`),
    ]);
    const rows = await prisma!.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) FROM "${schema}"."progress" WHERE completed_at IS NOT NULL`,
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it("allows exactly one simultaneous ACTIVE session", async () => {
    const results = await Promise.all([
      prisma!.$queryRawUnsafe(`INSERT INTO "${schema}"."placement_session" (student_id, status) VALUES ('student-2', 'ACTIVE') ON CONFLICT DO NOTHING RETURNING id`),
      prisma!.$queryRawUnsafe(`INSERT INTO "${schema}"."placement_session" (student_id, status) VALUES ('student-2', 'ACTIVE') ON CONFLICT DO NOTHING RETURNING id`),
    ]);
    expect(results.flat()).toHaveLength(1);
  });
});
