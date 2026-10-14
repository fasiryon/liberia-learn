import { sealContentBundle } from "@/lib/content-bundle/v1/seal";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentBundleRecord, PrismaClient } from "@prisma/client";
import { createSyntheticResolverAuthority } from "@/lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import { createContentBundleRepository, withPersistentComposition, type BundleDatabase } from "@/lib/content-bundle/persistence/repository";
import { resolveContentBundle } from "@/lib/content-bundle/v1/resolver";
import { classifyScheduledWork, createGovernedScheduledWork, readScheduledWorkDelivery, type GovernedScheduledWorkRef } from "@/lib/content-bundle/persistence/scheduledWork";
import { analyzeScheduledWorkBackfill, applySafeBackfill, type BackfillMatch, type BackfillRow } from "@/lib/content-bundle/persistence/backfill";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
afterEach(() => vi.unstubAllEnvs());

function setup() {
  const fixture = createSyntheticResolverAuthority();
  const rows: ContentBundleRecord[] = [];
  const db = { contentBundleRecord: {
    create: vi.fn(async ({ data }: { data: Omit<ContentBundleRecord, "id" | "createdAt"> }) => {
      if (rows.some(row => row.bundleId === data.bundleId && row.bundleVersion === data.bundleVersion)) throw new Error("UNIQUE_IDENTITY");
      const row = structuredClone({ ...data, id: `record-${rows.length}`, createdAt: new Date() }); rows.push(row); return row;
    }),
    findFirst: vi.fn(async ({ where }: { where: Partial<ContentBundleRecord> }) => rows.find(row => Object.entries(where).every(([key, value]) => row[key as keyof ContentBundleRecord] === value)) ?? null),
    findMany: vi.fn(async ({ where }: { where: Partial<ContentBundleRecord> }) => rows.filter(row => Object.entries(where).every(([key, value]) => row[key as keyof ContentBundleRecord] === value))),
  } } as unknown as BundleDatabase;
  const repository = createContentBundleRepository(db, "school-a");
  const sealed = sealContentBundle(fixture.bundle);
  if (!sealed.ok) throw new Error("invalid fixture");
  const composition = { manifest: sealed.sealed.bundle, revisions: fixture.pins };
  const member = fixture.bundle.lessons[0].identity;
  const ref: GovernedScheduledWorkRef = { bundleId: fixture.bundle.identity.bundleId, bundleVersion: fixture.bundle.identity.version,
    bundleContentHash: composition.manifest.identity.contentHash!, ...member };
  const reader = withPersistentComposition(fixture.reader, repository);
  return { fixture, db, rows, repository, composition, ref, reader };
}

describe("immutable sealed persistence", () => {
  it("persists exact sealed composition and indexed identities", async () => {
    const s = setup(); const row = await s.repository.storeSealedContentBundle(s.composition, "actor");
    expect(row.contentHash).toBe(s.ref.bundleContentHash);
    expect(await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).toEqual(s.composition);
    expect(await s.repository.getContentBundleByHash(row.contentHash)).toHaveLength(1);
  });
  it("rejects duplicate identities and immutable overwrite", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    await expect(s.repository.storeSealedContentBundle(s.composition, "actor")).rejects.toThrow("UNIQUE_IDENTITY");
    expect(Object.keys(s.repository)).not.toContain("update");
    expect(s.rows).toHaveLength(1);
    const changed = { ...s.fixture.bundle, identity: { ...s.fixture.bundle.identity, title: "Corrected title", contentHash: null } };
    await expect(s.repository.storeSealedContentBundle({ ...s.composition, manifest: changed }, "actor")).rejects.toThrow("UNIQUE_IDENTITY");
    expect((await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion))?.manifest.identity.title).toBe(s.fixture.bundle.identity.title);
  });
  it("permits a correction under a new exact version", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    const manifest = structuredClone(s.fixture.bundle);
    const updated = { ...manifest, identity: { ...manifest.identity, version: "2.0.0", contentHash: null } };
    await s.repository.storeSealedContentBundle({ ...s.composition, manifest: updated }, "actor");
    expect(s.rows).toHaveLength(2);
  });
  it.each(["contentHash", "compositionHash", "bundleVersion", "releaseIdentity"] as const)("rejects corrupt stored %s", async key => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    s.rows[0][key] = "corrupt";
    if (key === "bundleVersion") expect(await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).toBeNull();
    else await expect(s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).rejects.toThrow();
  });
  it("rejects excluded metadata or revision-pin corruption too", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    (s.rows[0].sealedComposition as any).revisions[s.ref.itemId].revisionId = "changed";
    await expect(s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).rejects.toThrow("STORED_COMPOSITION_HASH_MISMATCH");
  });
  it.each([{ bad: true }, { ...createSyntheticResolverAuthority().bundle, studentId: "child" }])("rejects invalid/student-state manifests before insertion", async manifest => {
    const s = setup(); await expect(s.repository.storeSealedContentBundle({ ...s.composition, manifest }, "actor")).rejects.toThrow();
    expect(s.db.contentBundleRecord.create).not.toHaveBeenCalled();
  });
  it("rejects caller supplied stale hash", async () => {
    const s = setup(); const manifest = { ...s.fixture.bundle, identity: { ...s.fixture.bundle.identity, contentHash: "f".repeat(64) } };
    await expect(s.repository.storeSealedContentBundle({ ...s.composition, manifest }, "actor")).rejects.toThrow();
  });
  it("scopes reads to the school and resolves through persisted composition", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    expect(await createContentBundleRepository(s.db, "school-b").getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).toBeNull();
    expect((await resolveContentBundle(s.fixture.input, s.reader)).status).toBe("RESOLVED");
  });
  it("teacher preview resolves scoped stored compositions with existing authority dependencies", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    const preview = getContentBundlePreviewResolver({ NODE_ENV: "test" }, {
      canPreviewBundle: async scope => scope.schoolId === "school-a", createReader: () => s.reader,
      source: { kind: "FIXTURE", authoritative: false, label: "Synthetic storage test" },
    });
    const result = await preview.resolveForTeacherPreview({ ...s.fixture.input, viewer: { userId: "actor", role: "TEACHER", schoolId: "school-a" } });
    expect(result.status).toBe("RESOLVED");
  });
  it("preview does not claim a valid persisted composition is missing when authority is incomplete", async () => {
    const s = setup(); s.fixture.bundle.identity.bundleId = "g4-math-fractions";
    await s.repository.storeSealedContentBundle({ manifest: s.fixture.bundle, revisions: s.fixture.pins }, "actor");
    const preview = getContentBundlePreviewResolver({ NODE_ENV: "test" }, {
      canPreviewBundle: async () => true, createReader: () => ({ ...s.reader, readRevision: async () => null }),
    });
    const result = await preview.resolveForTeacherPreview({ bundleId: "g4-math-fractions", bundleVersion: s.fixture.bundle.identity.version, viewer: { userId: "actor", role: "TEACHER", schoolId: "school-a" } });
    expect(result.status).toBe("INCOMPATIBLE");
    expect(result.diagnostics.some(d => d.code === "COMPOSITION_MISSING")).toBe(false);
    expect(result.diagnostics.some(d => d.code === "ITEM_REVISION_MISSING")).toBe(true);
  });
});

describe("ScheduledWork exact pins", () => {
  it("classifies legacy and preserves its callback result", async () => {
    const s = setup(); const legacy = vi.fn(async () => ({ payload: "unchanged" }));
    expect(classifyScheduledWork({})).toBe("LEGACY_UNPINNED");
    expect(await readScheduledWorkDelivery({}, s.reader, legacy)).toMatchObject({ status: "LEGACY", legacy: { payload: "unchanged" } });
    expect(legacy).toHaveBeenCalledOnce();
  });
  it("resolves complete pins and never invokes legacy", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    const legacy = vi.fn(async () => null);
    expect(classifyScheduledWork(s.ref)).toBe("GOVERNED_PINNED");
    expect((await readScheduledWorkDelivery(s.ref, s.reader, legacy)).status).toBe("RESOLVED");
    expect(legacy).not.toHaveBeenCalled();
  });
  it.each(["bundleId", "bundleVersion", "bundleContentHash", "itemId", "itemVersion", "itemKind"] as const)("fails closed when %s is absent", async key => {
    const s = setup(); const row = { ...s.ref, [key]: null }; const legacy = vi.fn(async () => null);
    expect(classifyScheduledWork(row)).toBe("INVALID_PARTIAL_PIN");
    expect((await readScheduledWorkDelivery(row, s.reader, legacy)).status).toBe("INCOMPATIBLE");
    expect(legacy).not.toHaveBeenCalled();
  });
  it.each([
    { bundleVersion: "missing" }, { bundleVersion: "latest" }, { bundleId: "missing" },
    { bundleContentHash: "f".repeat(64) }, { itemVersion: "missing" }, { itemKind: "HOMEWORK" }, { itemKind: "UNKNOWN" },
  ])("requires exact stored identity/hash/member/kind: %j", async changes => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    const legacy = vi.fn(async () => null);
    expect((await readScheduledWorkDelivery({ ...s.ref, ...changes }, s.reader, legacy)).status).not.toBe("RESOLVED");
    expect(legacy).not.toHaveBeenCalled();
  });
  it("fails closed on revoked existing authority", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    const reader = { ...s.reader, readRevision: async () => null };
    expect((await readScheduledWorkDelivery(s.ref, reader, async () => null)).status).toBe("INCOMPATIBLE");
  });
  function scheduleDb(s: ReturnType<typeof setup>, school = "school-a") {
    const tx = { ...s.db,
      class: { findUnique: vi.fn(async () => ({ schoolId: school, teacherId: "actor", gradeLevel: s.fixture.bundle.identity.gradeLevel, subject: s.fixture.bundle.identity.subject })) },
      user: { findUnique: vi.fn(async () => ({ schoolId: "school-a", role: "TEACHER" })) },
      curriculumContent: { findUnique: vi.fn(async () => ({ schoolId: null, grade: s.fixture.bundle.identity.gradeLevel, subject: s.fixture.bundle.identity.subject })) },
      scheduledWork: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "governed-work", ...data })) },
      auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
    };
    return { tx, db: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) } as unknown as PrismaClient };
  }
  it("creates all six pins in one transactional insert", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor"); const { db, tx } = scheduleDb(s);
    const result = await createGovernedScheduledWork(db, { schoolId: "school-a", actorId: "actor", classId: "class", contentId: s.ref.itemId, scheduledDate: new Date(), governedContentRef: s.ref }, () => s.fixture.reader);
    expect(result).toMatchObject(s.ref); expect(tx.scheduledWork.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it("blocks cross-school pinning before insertion", async () => {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor"); const { db, tx } = scheduleDb(s, "school-b");
    await expect(createGovernedScheduledWork(db, { schoolId: "school-a", actorId: "actor", classId: "class", contentId: s.ref.itemId, scheduledDate: new Date(), governedContentRef: s.ref }, () => s.fixture.reader)).rejects.toThrow("SCHEDULE_SCOPE_FORBIDDEN");
    expect(tx.scheduledWork.create).not.toHaveBeenCalled();
  });
});

describe("read-only backfill and guarded local application", () => {
  async function analyze() {
    const s = setup(); await s.repository.storeSealedContentBundle(s.composition, "actor");
    const rows: BackfillRow[] = ["safe", "ambiguous", "none", "pinned", "partial"].map(id => ({ id, schoolId: "school-a", contentId: s.ref.itemId, gradeLevel: s.fixture.bundle.identity.gradeLevel, subject: s.fixture.bundle.identity.subject,
      ...(id === "pinned" ? s.ref : id === "partial" ? { bundleId: s.ref.bundleId } : {}) }));
    const matches: BackfillMatch[] = [
      { scheduledWorkId: "safe", schoolId: "school-a", contentId: s.ref.itemId, ref: s.ref },
      { scheduledWorkId: "ambiguous", schoolId: "school-a", contentId: s.ref.itemId, ref: s.ref },
      { scheduledWorkId: "ambiguous", schoolId: "school-a", contentId: s.ref.itemId, ref: { ...s.ref, itemVersion: "other" } },
    ];
    return { s, rows, matches, analysis: await analyzeScheduledWorkBackfill(rows, matches, () => s.reader) };
  }
  it("classifies all five states and outputs complete safe proposals", async () => {
    const { analysis, s } = await analyze();
    expect(analysis.map(row => row.status)).toEqual(["SAFE_TO_PIN", "AMBIGUOUS", "NO_GOVERNED_MATCH", "ALREADY_PINNED", "INVALID_PARTIAL_PIN"]);
    expect(analysis[0].proposed).toEqual(s.ref);
  });
  it("dry run never calls writer", async () => {
    const { analysis } = await analyze(); const writer = vi.fn(async () => 1);
    expect(await applySafeBackfill(analysis, writer)).toEqual({ mode: "DRY_RUN", written: 0 }); expect(writer).not.toHaveBeenCalled();
  });
  it("conditional local application is idempotent and never writes ambiguity", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test");
    vi.stubEnv("DIRECT_URL", "postgresql://test:test@127.0.0.1:5432/test");
    const { analysis } = await analyze(); const writtenIds = new Set<string>();
    const writer = vi.fn(async (request: { where: { id?: unknown } }) => { const id = String(request.where.id); if (writtenIds.has(id)) return 0; writtenIds.add(id); return 1; });
    expect((await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).written).toBe(1);
    expect((await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).written).toBe(0);
    expect([...writtenIds]).toEqual(["safe"]);
    expect(writer).toHaveBeenCalledWith({ where: { id: "safe", class: { schoolId: "school-a" }, bundleId: null, bundleVersion: null, bundleContentHash: null, itemId: null, itemVersion: null, itemKind: null }, data: analysis[0].proposed });
    await expect(applySafeBackfill(analysis, writer, { write: true })).rejects.toThrow("HOSTED_BACKFILL_NOT_AUTHORIZED");
  });
  it("rejects hosted targets even when a caller labels them LOCAL_TEST", async () => {
    const { analysis } = await analyze(); const writer = vi.fn(async () => 1);
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@hosted.example.invalid/test");
    await expect(applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).rejects.toThrow("HOSTED_BACKFILL_NOT_AUTHORIZED");
    expect(writer).not.toHaveBeenCalled();
  });
  it("never copies legacy fields from a correspondence into a proposal or write", async () => {
    const { analysis, rows, s } = await analyze();
    const ref = { ...s.ref, contentId: "unrelated", classId: "foreign-class" };
    const result = await analyzeScheduledWorkBackfill(rows, [{ scheduledWorkId: "safe", schoolId: "school-a", contentId: s.ref.itemId, ref }], () => s.reader);
    expect(result[0].proposed).toEqual(s.ref);
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test");
    vi.stubEnv("DIRECT_URL", "postgresql://test:test@127.0.0.1:5432/test");
    const writer = vi.fn(async () => 1);
    await applySafeBackfill([{ ...analysis[0], proposed: ref }], writer, { write: true, target: "LOCAL_TEST" });
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({ data: s.ref }));
  });
  it("rejects missing scope instead of issuing a broad conditional update", async () => {
    const { analysis } = await analyze(); const writer = vi.fn(async () => 1);
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test");
    vi.stubEnv("DIRECT_URL", "postgresql://test:test@127.0.0.1:5432/test");
    await expect(applySafeBackfill([{ ...analysis[0], id: "" }], writer, { write: true, target: "LOCAL_TEST" })).rejects.toThrow("BACKFILL_SCOPE_REQUIRED");
    expect(writer).not.toHaveBeenCalled();
  });
  it("rejects correspondence incompatible with class scope or the legacy content link", async () => {
    const { rows, matches, s } = await analyze();
    const wrongGrade = await analyzeScheduledWorkBackfill([{ ...rows[0], gradeLevel: 999 }], matches, () => s.reader);
    expect(wrongGrade[0].status).toBe("NO_GOVERNED_MATCH");
    const wrongLink = await analyzeScheduledWorkBackfill([{ ...rows[0], contentId: "unrelated" }], [{ ...matches[0], contentId: "unrelated" }], () => s.reader);
    expect(wrongLink[0].status).toBe("NO_GOVERNED_MATCH");
  });
});
