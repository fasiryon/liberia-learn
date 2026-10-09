// Codex final merge gate P1-A: compatibility-mode (provenance writers off) governance must decide on
// the row as it is after the lock, against real PostgreSQL row locks.
//
// Runs only against a disposable database: set CURRICULUM_RACE_DATABASE_URL to an empty PostgreSQL 17 +
// pgvector database with the application schema applied (see CURRICULUM_V2.md section 4d). Without it
// the suite is skipped, so CI and ordinary runs never need a database.
//
// Interleaving (deterministic): T2 locks the row, turns it native and adds a DRAFT provenance, and holds
// its transaction open. T1 then runs compatibility governance: its unlocked lookup still sees the legacy
// row, and its lock waits on T2. The test waits until PostgreSQL reports T1 blocked on the lock, lets T2
// commit, and checks that T1 decides on the native row it finally locks.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const RACE_URL = process.env.CURRICULUM_RACE_DATABASE_URL;

vi.mock("@/lib/db", async () => {
  if (!process.env.CURRICULUM_RACE_DATABASE_URL) return { prisma: {} };
  const { PrismaClient } = await import("@prisma/client");
  return { prisma: new PrismaClient({ datasources: { db: { url: process.env.CURRICULUM_RACE_DATABASE_URL } } }) };
});

import { prisma } from "@/lib/db";
import { appendCurriculumGovernanceEvent } from "@/lib/curriculum/mutations/governanceWriter";
import { updateCurriculumContent } from "@/lib/curriculum/mutations/repository";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import type { Prisma } from "@prisma/client";

const db = prisma as unknown as import("@prisma/client").PrismaClient;
const ROW_ID = "race-row";
const CONTENT_ID = "race-content";
const USER_ID = "race-reviewer";
const LEGACY_PAYLOAD = { title: "Fractions", body: "Halves and quarters." };

function nativePayload(): Prisma.InputJsonValue {
  const outcome = runG4Proof("equivalent-fractions.json", "moe-math-g4-s1-p3-number-theory-and-fraction-obj5");
  if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
  return JSON.parse(JSON.stringify({ title: "Fractions", curriculumV2: outcome.lesson }));
}

/** A qualified human approval as legacy compatibility callers send it. */
function approval(extra: Record<string, unknown> = {}) {
  return {
    contentId: CONTENT_ID, eventType: "APPROVED", actorType: "USER", actorUserId: USER_ID,
    approvalBasis: "HUMAN_REVIEW", reviewAuthority: "SCHOOL",
    reviewerQualificationRef: "p2b-decision:race", reviewerQualificationSnapshot: { role: "TEACHER" },
    ...extra,
  } as Parameters<typeof appendCurriculumGovernanceEvent>[0];
}

async function snapshot() {
  const row = await db.curriculumContent.findUniqueOrThrow({ where: { id: ROW_ID } });
  const provenance = await db.curriculumProvenance.findUnique({ where: { curriculumContentId: ROW_ID } });
  const revisions = await db.curriculumContentRevision.count({ where: { provenance: { curriculumContentId: ROW_ID } } });
  return {
    payload: row.payload, status: row.status, publishedAt: row.publishedAt, editReviewStatus: row.editReviewStatus, hash: row.hash,
    lifecycle: provenance?.lifecycleState ?? null, currentRevisionId: provenance?.currentRevisionId ?? null, revisions,
  };
}

async function waitForLockWaiter(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const [{ waiting }] = await db.$queryRaw<Array<{ waiting: bigint }>>`
      SELECT count(*)::bigint AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if (waiting > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("T1 never blocked on the row lock: the interleaving did not happen");
}

/** T2 commits `change` while T1 (`attempt`) has already read the old row and is waiting for the lock. */
async function raceAgainst(change: (tx: Prisma.TransactionClient) => Promise<void>, attempt: () => Promise<unknown>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let ready!: () => void;
  const changed = new Promise<void>((resolve) => { ready = resolve; });
  const t2 = db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "CurriculumContent" WHERE "id" = ${ROW_ID} FOR UPDATE`;
    await change(tx);
    ready();
    await gate;
  }, { timeout: 30_000 });
  await changed;
  const t1 = attempt().then(() => ({ ok: true as const }), (error: Error) => ({ ok: false as const, error }));
  await waitForLockWaiter();
  release();
  await t2;
  return t1;
}

/** T2's change: the row becomes native Curriculum V2 with a DRAFT provenance and a new hash. */
async function becomeNative(tx: Prisma.TransactionClient) {
  await tx.curriculumContent.update({ where: { id: ROW_ID }, data: { payload: nativePayload(), hash: "h-native", status: "DRAFT" } });
  await tx.curriculumProvenance.create({ data: { curriculumContentId: ROW_ID, lifecycleState: "DRAFT" } });
}

describe.skipIf(!RACE_URL)("P1-A real PostgreSQL: compatibility governance decides on the post-lock row", () => {
  beforeAll(async () => {
    await db.user.upsert({ where: { id: USER_ID }, update: {}, create: { id: USER_ID, email: "race-reviewer@example.test", role: "ADMIN" } });
  });
  beforeEach(async () => {
    delete process.env.P2A_PROVENANCE_WRITERS_DISABLED; // default: writers off (compatibility mode)
    await db.curriculumProvenance.deleteMany({ where: { curriculumContentId: ROW_ID } });
    await db.curriculumContent.deleteMany({ where: { id: ROW_ID } });
    await db.curriculumContent.create({ data: {
      id: ROW_ID, contentId: CONTENT_ID, grade: 4, subject: "MATH", contentType: "lesson", status: "pending_approval",
      version: "1", payload: LEGACY_PAYLOAD, hash: "h-legacy",
    } });
  });
  afterEach(() => { delete process.env.P2A_PROVENANCE_WRITERS_DISABLED; });
  afterAll(async () => {
    await db.curriculumProvenance.deleteMany({ where: { curriculumContentId: ROW_ID } });
    await db.curriculumContent.deleteMany({ where: { id: ROW_ID } });
    await db.$disconnect();
  });

  const NATIVE_UNCHANGED = { status: "DRAFT", publishedAt: null, hash: "h-native", lifecycle: "DRAFT", currentRevisionId: null, revisions: 0 };

  it("CASE 1: legacy -> native during compatibility approval is rejected; nothing is published", async () => {
    const result = await raceAgainst(becomeNative, () => appendCurriculumGovernanceEvent(approval()));
    expect(result.ok).toBe(false);
    expect(String((result as { error: Error }).error?.message)).toMatch(/NATIVE_CURRICULUM_V2/);
    const after = await snapshot();
    expect(after).toMatchObject(NATIVE_UNCHANGED);
    expect(after.payload).toEqual(nativePayload());
    expect(after.editReviewStatus).not.toBe("APPROVED");
  });

  it("CASE 2: legacy -> native during an approval with a compatibility payload replacement: no publish, no downgrade", async () => {
    const replacement = approval({ compatibility: { projection: { status: "published", publishedAt: new Date(), editReviewStatus: "APPROVED", payload: LEGACY_PAYLOAD } } });
    const result = await raceAgainst(becomeNative, () => appendCurriculumGovernanceEvent(replacement));
    expect(result.ok).toBe(false);
    const after = await snapshot();
    expect(after).toMatchObject(NATIVE_UNCHANGED);
    expect(after.payload).toEqual(nativePayload());
  });

  it("CASE 2b: legacy -> native during a non-approval event carrying a payload replacement is rejected", async () => {
    const replacement = { contentId: CONTENT_ID, eventType: "SUBMITTED", actorType: "USER", actorUserId: USER_ID,
      compatibility: { projection: { status: "pending_approval", editReviewStatus: "PENDING", payload: LEGACY_PAYLOAD } } } as Parameters<typeof appendCurriculumGovernanceEvent>[0];
    const result = await raceAgainst(becomeNative, () => appendCurriculumGovernanceEvent(replacement));
    expect(result.ok).toBe(false);
    expect(String((result as { error: Error }).error?.message)).toMatch(/NATIVE_CURRICULUM_V2_EXISTING_ROW_REQUIRES_PROVENANCE_WRITERS/);
    const after = await snapshot();
    expect(after).toMatchObject(NATIVE_UNCHANGED);
    expect(after.payload).toEqual(nativePayload());
  });

  it("CASE 3: an unchanged legacy row is still approved through compatibility mode", async () => {
    await expect(appendCurriculumGovernanceEvent(approval())).resolves.toBeNull();
    const after = await snapshot();
    expect(after).toMatchObject({ status: "published", editReviewStatus: "APPROVED", hash: "h-legacy", lifecycle: null, revisions: 0 });
    expect(after.publishedAt).toBeInstanceOf(Date);
    expect(after.payload).toEqual(LEGACY_PAYLOAD);
  });

  it("CASE 4: an already-native row cannot be approved or replaced through compatibility mode", async () => {
    await db.$transaction((tx) => becomeNative(tx));
    await expect(appendCurriculumGovernanceEvent(approval())).rejects.toThrow(/NATIVE_CURRICULUM_V2/);
    await expect(appendCurriculumGovernanceEvent(approval({ compatibility: { projection: { status: "published", payload: LEGACY_PAYLOAD } } }))).rejects.toThrow(/NATIVE_CURRICULUM_V2/);
    const after = await snapshot();
    expect(after).toMatchObject(NATIVE_UNCHANGED);
    expect(after.payload).toEqual(nativePayload());
  });

  it("CASE 5: the repository writers-off update makes the same post-lock decision", async () => {
    const result = await raceAgainst(becomeNative, () => updateCurriculumContent({ contentId: CONTENT_ID }, { payload: LEGACY_PAYLOAD }, { revisionKind: "EDIT", originKind: "HUMAN_AUTHORED" } as never));
    expect(result.ok).toBe(false);
    expect(String((result as { error: Error }).error?.message)).toMatch(/NATIVE_CURRICULUM_V2_EXISTING_ROW_REQUIRES_PROVENANCE_WRITERS/);
    expect(await snapshot()).toMatchObject(NATIVE_UNCHANGED);
  });
});
