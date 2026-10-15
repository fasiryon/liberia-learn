/** Synthetic integration evidence only, run by the disposable migration verifier. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createSyntheticResolverAuthority } from "../lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import {
  createContentBundleAllocationStore, createContentBundleRepository, createNationalContentBundleStore,
  schoolBundleNamespace, withPersistentComposition,
} from "../lib/content-bundle/persistence/repository";
import { createGovernedScheduledWork, readScheduledWorkDelivery } from "../lib/content-bundle/persistence/scheduledWork";
import { analyzeScheduledWorkBackfill, applySafeBackfill, type BackfillMatch } from "../lib/content-bundle/persistence/backfill";
import { createCurriculumContent } from "../lib/curriculum/mutations/repository";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const rejectsWith = async (promise: Promise<unknown>, pattern: RegExp) => {
  try { await promise; } catch (error) { assert.match(String((error as Error)?.message ?? error), pattern); return; }
  assert.fail(`expected rejection matching ${pattern}`);
};

async function main() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); } catch { throw new Error("DISPOSABLE_DATABASE_REQUIRED"); }
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/content_persistence_local" ||
      url.password !== "local_disposable_only" || process.env.DIRECT_URL !== process.env.DATABASE_URL) throw new Error("DISPOSABLE_DATABASE_REQUIRED");
  const db = new PrismaClient();
  try {
    const schoolA = "content-test-school"; const schoolB = "content-test-school-b"; const schoolC = "content-test-school-c";
    await db.school.createMany({ data: [{ id: schoolB, name: "Disposable school B" }, { id: schoolC, name: "Disposable school C" }] });
    const fixture = createSyntheticResolverAuthority();
    const national = createNationalContentBundleStore(db);
    const allocations = createContentBundleAllocationStore(db);
    const repoA = createContentBundleRepository(db, schoolA);
    const repoB = createContentBundleRepository(db, schoolB);
    const repoC = createContentBundleRepository(db, schoolC);

    // --- Existing-row compatibility: the pre-migration legacy row keeps NULL pins and its content link.
    const existing = await db.scheduledWork.findUniqueOrThrow({ where: { id: "content-test-work" } });
    assert.equal(existing.contentId, "content-test-lesson");
    assert.deepEqual([existing.bundleId, existing.bundleVersion, existing.bundleContentHash, existing.itemId, existing.itemVersion, existing.itemKind], [null, null, null, null, null, null]);

    // --- National registry: stored once, reusable by two allocated schools, invisible without allocation.
    const stored = await national.storeNationalContentBundle({ manifest: fixture.bundle, revisions: fixture.pins }, "content-test-actor");
    const identity = { bundleId: stored.bundleId, bundleVersion: stored.bundleVersion };
    assert.equal(await repoA.getContentBundle(identity.bundleId, identity.bundleVersion), null, "national record must not be available before allocation");
    const grantA = await allocations.grant({ ...identity, schoolId: schoolA, governanceRef: "synthetic.decision.a", grantedById: "content-test-governance" });
    await allocations.grant({ ...identity, schoolId: schoolB, governanceRef: "synthetic.decision.b", grantedById: "content-test-governance" });
    assert.equal((await repoA.getContentBundle(identity.bundleId, identity.bundleVersion))?.manifest.identity.contentHash, stored.contentHash);
    assert.equal((await repoB.getContentBundle(identity.bundleId, identity.bundleVersion))?.manifest.identity.contentHash, stored.contentHash);
    assert.equal(await db.contentBundleRecord.count({ where: { bundleId: identity.bundleId } }), 1, "national payload is stored once");
    assert.equal(await repoC.getContentBundle(identity.bundleId, identity.bundleVersion), null, "missing allocation denies");
    assert.deepEqual(await repoC.getContentBundleByHash(stored.contentHash), []);
    await rejectsWith(allocations.grant({ ...identity, schoolId: schoolA, governanceRef: "duplicate", grantedById: "x" }), /Unique constraint/);
    await rejectsWith(national.storeNationalContentBundle({ manifest: fixture.bundle, revisions: fixture.pins }, "content-test-actor"), /Unique constraint/);
    await rejectsWith(repoA.getContentBundle(identity.bundleId, "latest"), /EXACT_BUNDLE_IDENTITY_REQUIRED/);

    // Exact version: a later national version is a separate record that needs its own allocation.
    const v2 = { ...structuredClone(fixture.bundle), identity: { ...fixture.bundle.identity, version: "2.0.0", contentHash: null } };
    await national.storeNationalContentBundle({ manifest: v2, revisions: fixture.pins }, "content-test-actor");
    assert.equal(await repoA.getContentBundle(identity.bundleId, "2.0.0"), null, "allocation of one version never grants another");

    // --- School-owned content: private to its owner, never allocatable, namespace enforced in PostgreSQL too.
    const owned = { ...structuredClone(fixture.bundle), identity: { ...fixture.bundle.identity, bundleId: `${schoolBundleNamespace(schoolA)}fractions`, contentHash: null } };
    const ownedRow = await repoA.storeSchoolContentBundle({ manifest: owned, revisions: fixture.pins }, "content-test-actor");
    assert.notEqual(await repoA.getContentBundle(ownedRow.bundleId, ownedRow.bundleVersion), null);
    assert.equal(await repoB.getContentBundle(ownedRow.bundleId, ownedRow.bundleVersion), null, "cross-school read denied");
    await rejectsWith(allocations.grant({ bundleId: ownedRow.bundleId, bundleVersion: ownedRow.bundleVersion, schoolId: schoolB, governanceRef: "x", grantedById: "x" }), /NATIONAL_BUNDLE_REQUIRED/);
    await rejectsWith(db.contentBundleAllocation.create({ data: { bundleRecordId: ownedRow.id, schoolId: schoolB, governanceRef: "raw", grantedById: "raw" } }), /NATIONAL ContentBundleRecord/);
    const rawRecord = (bundleId: string, scope: string, owner: string | null) => db.contentBundleRecord.create({ data: { ...stored, id: undefined, createdAt: undefined, bundleId, bundleVersion: "9.9.9", ownerScope: scope, ownerSchoolId: owner, sealedComposition: stored.sealedComposition as object } as never });
    await rejectsWith(rawRecord(`${schoolBundleNamespace(schoolB)}x`, "SCHOOL", schoolA), /owner_scope_check/);
    await rejectsWith(rawRecord(identity.bundleId, "SCHOOL", schoolA), /owner_scope_check/);
    await rejectsWith(rawRecord(`${schoolBundleNamespace(schoolA)}x`, "NATIONAL", null), /owner_scope_check/);

    // --- Governed scheduling uses the allocated national record; revocation fails closed.
    await db.user.create({ data: { id: "content-test-actor", email: "content-test@example.invalid", role: "TEACHER", schoolId: schoolA } });
    await db.class.update({ where: { id: "content-test-class" }, data: { teacherId: "content-test-actor" } });
    const lesson = fixture.bundle.lessons[0].identity;
    // Seeded through the approved curriculum writer as non-authoritative draft content.
    await createCurriculumContent({ contentId: lesson.itemId, grade: fixture.bundle.identity.gradeLevel, subject: fixture.bundle.identity.subject, contentType: "LESSON", status: "draft", version: lesson.itemVersion, payload: {} },
      { revisionKind: "HUMAN_CREATE", originKind: "HUMAN_AUTHORED", actorUserId: "content-test-actor", authorUserId: "content-test-actor", auditAction: "content_persistence.synthetic_fixture", idempotencyKey: "content-persistence-runtime-fixture" });
    const ref = { ...identity, bundleContentHash: stored.contentHash, ...lesson };
    const scheduleInput = { schoolId: schoolA, actorId: "content-test-actor", classId: "content-test-class", contentId: ref.itemId, scheduledDate: new Date("2026-10-13T12:00:00Z"), governedContentRef: ref };
    const work = await createGovernedScheduledWork(db, scheduleInput, () => fixture.reader);
    assert.equal(work.bundleContentHash, stored.contentHash);
    assert.equal(await db.auditLog.count({ where: { resourceId: work.id, action: "scheduled_work.governed_created" } }), 1);
    const readerA = withPersistentComposition(fixture.reader, repoA);
    assert.equal((await readScheduledWorkDelivery(ref, readerA, async () => null)).status, "RESOLVED");

    // --- Backfill: dry run, refused stale proposal under concurrent modification, idempotent CAS.
    for (const id of ["content-test-legacy-match", "content-test-race-edit", "content-test-race-pin"]) {
      await db.scheduledWork.create({ data: { id, contentId: ref.itemId, classId: "content-test-class", createdById: "content-test-actor", scheduledDate: new Date("2026-10-13T12:00:00Z") } });
    }
    const rows = await db.scheduledWork.findMany({ include: { class: { select: { schoolId: true, gradeLevel: true, subject: true } } } });
    const matches: BackfillMatch[] = ["content-test-legacy-match", "content-test-race-edit", "content-test-race-pin"].map(id => ({ scheduledWorkId: id, schoolId: schoolA, contentId: ref.itemId, ref }));
    const analysis = await analyzeScheduledWorkBackfill(rows.map(row => ({ ...row, ...row.class })), matches, () => readerA);
    const status = (id: string) => analysis.find(row => row.id === id)?.status;
    assert.equal(status("content-test-legacy-match"), "SAFE_TO_PIN");
    assert.equal(status("content-test-race-edit"), "SAFE_TO_PIN");
    assert.equal(status("content-test-work"), "NO_GOVERNED_MATCH");
    assert.equal(status(work.id), "ALREADY_PINNED");
    const writer: Parameters<typeof applySafeBackfill>[1] = async request => (await db.scheduledWork.updateMany(request)).count;
    assert.deepEqual(await applySafeBackfill(analysis, writer), { mode: "DRY_RUN", written: 0 });

    // A teacher edit holds the row lock and changes contentId while the backfill application is in flight;
    // a concurrent writer pins another row first. Both stale proposals must be refused.
    await db.scheduledWork.update({ where: { id: "content-test-race-pin" }, data: { bundleId: ref.bundleId, bundleVersion: ref.bundleVersion, bundleContentHash: ref.bundleContentHash, itemId: ref.itemId, itemVersion: ref.itemVersion, itemKind: ref.itemKind } });
    let editCommitted = false;
    const edit = db.$transaction(async tx => {
      await tx.scheduledWork.update({ where: { id: "content-test-race-edit" }, data: { contentId: "content-test-lesson" } });
      await sleep(1500);
      editCommitted = true;
    }, { timeout: 10_000 });
    await sleep(300);
    const applied = await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" });
    await edit;
    assert.equal(editCommitted, true);
    assert.deepEqual(applied, { mode: "LOCAL_TEST_WRITE", written: 1, refused: ["content-test-race-edit", "content-test-race-pin"] });
    const raced = await db.scheduledWork.findUniqueOrThrow({ where: { id: "content-test-race-edit" } });
    assert.equal(raced.contentId, "content-test-lesson");
    assert.equal(raced.bundleId, null, "stale proposal never pins a row whose content changed");
    assert.equal((await db.scheduledWork.findUniqueOrThrow({ where: { id: "content-test-legacy-match" } })).bundleContentHash, stored.contentHash);
    const rerun = await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" });
    assert.equal(rerun.written, 0, "re-application is idempotent");
    assert.equal((await db.scheduledWork.findUniqueOrThrow({ where: { id: "content-test-work" } })).bundleId, null);

    // --- Revocation is one-way, retained as history, and immediately denies resolution and scheduling.
    await allocations.revoke({ allocationId: grantA.id, revokedById: "content-test-governance", revocationRef: "synthetic.revocation" });
    assert.equal(await repoA.getContentBundle(identity.bundleId, identity.bundleVersion), null);
    assert.equal((await readScheduledWorkDelivery(ref, readerA, async () => null)).status, "UNAVAILABLE");
    await rejectsWith(createGovernedScheduledWork(db, scheduleInput, () => fixture.reader), /STORED_BUNDLE_MISSING/);
    assert.notEqual(await repoB.getContentBundle(identity.bundleId, identity.bundleVersion), null, "other school's allocation is independent");
    await rejectsWith(db.contentBundleAllocation.update({ where: { id: grantA.id }, data: { status: "ACTIVE", revokedById: null, revokedAt: null, revocationRef: null } }), /only ACTIVE -> REVOKED/);
    await rejectsWith(db.contentBundleAllocation.delete({ where: { id: grantA.id } }), /retained history/);
    await rejectsWith(db.$executeRawUnsafe(`TRUNCATE "ContentBundleAllocation"`), /retained history/);
    await rejectsWith(db.contentBundleAllocation.create({ data: { bundleRecordId: stored.id, schoolId: schoolC, status: "REVOKED", governanceRef: "x", grantedById: "x", revokedById: "x", revokedAt: new Date(), revocationRef: "x" } }), /must be created ACTIVE/);
    // A fresh decision may re-grant; the revoked row stays as history.
    await allocations.grant({ ...identity, schoolId: schoolA, governanceRef: "synthetic.decision.a2", grantedById: "content-test-governance" });
    assert.equal(await db.contentBundleAllocation.count({ where: { schoolId: schoolA, bundleRecordId: stored.id } }), 2);
    assert.notEqual(await repoA.getContentBundle(identity.bundleId, identity.bundleVersion), null);

    console.log("CONTENT PERSISTENCE LOCAL RUNTIME: PASS (national reuse, school isolation, allocation/revocation, exact version, atomic schedule/audit, dry run, concurrent-edit CAS refusal, idempotent backfill)");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
