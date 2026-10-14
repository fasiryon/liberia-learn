/** Synthetic integration evidence only, run by the disposable migration verifier. */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { createSyntheticResolverAuthority } from "../lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import { createContentBundleRepository, withPersistentComposition } from "../lib/content-bundle/persistence/repository";
import { createGovernedScheduledWork, readScheduledWorkDelivery } from "../lib/content-bundle/persistence/scheduledWork";
import { analyzeScheduledWorkBackfill, applySafeBackfill } from "../lib/content-bundle/persistence/backfill";

async function main() {
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); } catch { throw new Error("DISPOSABLE_DATABASE_REQUIRED"); }
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/content_persistence_local" ||
      url.password !== "local_disposable_only" || process.env.DIRECT_URL !== process.env.DATABASE_URL) throw new Error("DISPOSABLE_DATABASE_REQUIRED");
  const db = new PrismaClient();
  try {
    const schoolId = "content-test-school";
    const fixture = createSyntheticResolverAuthority();
    const repository = createContentBundleRepository(db, schoolId);
    const stored = await repository.storeSealedContentBundle({ manifest: fixture.bundle, revisions: fixture.pins }, "content-test-actor");
    const composition = await repository.getContentBundle(stored.bundleId, stored.bundleVersion);
    assert.equal(composition?.manifest.identity.contentHash, stored.contentHash);
    assert.equal((await repository.getContentBundleByHash(stored.contentHash)).length, 1);
    await assert.rejects(repository.storeSealedContentBundle({ manifest: fixture.bundle, revisions: fixture.pins }, "content-test-actor"));
    await assert.rejects(repository.getContentBundle("synthetic.db.guard", "1"));
    const reader = withPersistentComposition(fixture.reader, repository);
    const ref = { bundleId: stored.bundleId, bundleVersion: stored.bundleVersion, bundleContentHash: stored.contentHash, ...fixture.bundle.lessons[0].identity };
    assert.equal((await readScheduledWorkDelivery(ref, reader, async () => null)).status, "RESOLVED");
    await db.user.create({ data: { id: "content-test-actor", email: "content-test@example.invalid", role: "TEACHER", schoolId } });
    await db.class.update({ where: { id: "content-test-class" }, data: { teacherId: "content-test-actor" } });
    await db.curriculumContent.create({ data: { contentId: ref.itemId, grade: fixture.bundle.identity.gradeLevel, subject: fixture.bundle.identity.subject, contentType: "LESSON", status: "APPROVED", version: ref.itemVersion, payload: {} } });
    const work = await createGovernedScheduledWork(db, {
      schoolId, actorId: "content-test-actor", classId: "content-test-class", contentId: ref.itemId,
      scheduledDate: new Date("2026-10-13T12:00:00Z"), governedContentRef: ref,
    }, () => fixture.reader);
    assert.equal(work.bundleContentHash, stored.contentHash);
    assert.equal(await db.auditLog.count({ where: { resourceId: work.id, action: "scheduled_work.governed_created" } }), 1);
    await db.scheduledWork.create({ data: { id: "content-test-legacy-match", contentId: ref.itemId, classId: "content-test-class", createdById: "content-test-actor", scheduledDate: new Date("2026-10-13T12:00:00Z") } });
    const rows = await db.scheduledWork.findMany({ include: { class: { select: { schoolId: true, gradeLevel: true, subject: true } } } });
    const analysis = await analyzeScheduledWorkBackfill(rows.map(row => ({ ...row, ...row.class })), [
      { scheduledWorkId: "content-test-legacy-match", schoolId, contentId: ref.itemId, ref },
    ], () => reader);
    assert.equal(analysis.find(row => row.id === "content-test-legacy-match")?.status, "SAFE_TO_PIN");
    assert.equal(analysis.find(row => row.id === "content-test-work")?.status, "NO_GOVERNED_MATCH");
    assert.equal(analysis.find(row => row.id === work.id)?.status, "ALREADY_PINNED");
    let writes = 0;
    const writer: Parameters<typeof applySafeBackfill>[1] = async request => { writes++; return (await db.scheduledWork.updateMany(request)).count; };
    assert.equal((await applySafeBackfill(analysis, writer)).written, 0);
    assert.equal(writes, 0);
    assert.equal((await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).written, 1);
    assert.equal((await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).written, 0);
    assert.equal((await db.scheduledWork.findUniqueOrThrow({ where: { id: "content-test-work" } })).contentId, "content-test-lesson");
    assert.equal((await db.scheduledWork.findUniqueOrThrow({ where: { id: "content-test-work" } })).bundleId, null);
    console.log("CONTENT PERSISTENCE LOCAL RUNTIME: PASS (Prisma storage, resolver, atomic schedule/audit, dry run, idempotent compare-and-set)");
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
