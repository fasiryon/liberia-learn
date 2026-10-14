import { sealContentBundle } from "@/lib/content-bundle/v1/seal";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentBundleAllocation, ContentBundleRecord, PrismaClient } from "@prisma/client";
import { createSyntheticResolverAuthority } from "@/lib/content-bundle/v1/fixtures/resolverAuthorityFixture";
import {
  createContentBundleAllocationStore, createContentBundleRepository, createNationalContentBundleStore,
  schoolBundleNamespace, withPersistentComposition, type BundleDatabase,
} from "@/lib/content-bundle/persistence/repository";
import { resolveContentBundle } from "@/lib/content-bundle/v1/resolver";
import { classifyScheduledWork, createGovernedScheduledWork, readScheduledWorkDelivery, type GovernedScheduledWorkRef } from "@/lib/content-bundle/persistence/scheduledWork";
import { analyzeScheduledWorkBackfill, applySafeBackfill, type BackfillMatch, type BackfillRow } from "@/lib/content-bundle/persistence/backfill";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import { deterministicReleaseIdentity, type CurriculumContentBinding } from "@/lib/learning-authority/governedGrade4Math";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { hashActivityDefinition } from "@/lib/activity-definition/v1/hash";
import { activityBundleMember, type ActivityDefinitionV1 } from "@/lib/activity-definition/v1/types";
import type { ActivityAuthorityReader } from "@/lib/activity-definition/v1/resolver";
afterEach(() => vi.unstubAllEnvs());

/** In-memory stand-in enforcing the same identity/ownership/allocation rules as the migration. */
function fakeDatabase() {
  const rows: ContentBundleRecord[] = [];
  const allocations: ContentBundleAllocation[] = [];
  const matches = <T extends object>(row: T, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
  const db = {
    contentBundleRecord: {
      create: vi.fn(async ({ data }: { data: Omit<ContentBundleRecord, "id" | "createdAt"> }) => {
        if (rows.some(row => row.bundleId === data.bundleId && row.bundleVersion === data.bundleVersion)) throw new Error("UNIQUE_IDENTITY");
        const namespace = data.ownerSchoolId ? schoolBundleNamespace(data.ownerSchoolId) : "";
        const ownerOk = data.ownerScope === "NATIONAL" ? data.ownerSchoolId === null && !data.bundleId.startsWith("school.")
          : data.ownerScope === "SCHOOL" && !!data.ownerSchoolId && data.bundleId.startsWith(namespace) && data.bundleId.length > namespace.length;
        if (!ownerOk) throw new Error("OWNER_SCOPE_CHECK");
        const row = structuredClone({ ...data, id: `record-${rows.length}`, createdAt: new Date() }); rows.push(row); return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { bundleId_bundleVersion: { bundleId: string; bundleVersion: string } } }) =>
        rows.find(row => row.bundleId === where.bundleId_bundleVersion.bundleId && row.bundleVersion === where.bundleId_bundleVersion.bundleVersion) ?? null),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter(row => matches(row, where))),
    },
    contentBundleAllocation: {
      create: vi.fn(async ({ data }: { data: Pick<ContentBundleAllocation, "bundleRecordId" | "schoolId" | "governanceRef" | "grantedById"> }) => {
        if (rows.find(row => row.id === data.bundleRecordId)?.ownerScope !== "NATIONAL") throw new Error("NATIONAL_ONLY");
        if (allocations.some(a => a.status === "ACTIVE" && a.schoolId === data.schoolId && a.bundleRecordId === data.bundleRecordId)) throw new Error("ONE_ACTIVE");
        const allocation = { ...data, id: `allocation-${allocations.length}`, status: "ACTIVE", grantedAt: new Date(), revokedById: null, revokedAt: null, revocationRef: null };
        allocations.push(allocation); return allocation;
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => allocations.find(a => matches(a, where)) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<ContentBundleAllocation> }) => {
        const hit = allocations.filter(a => matches(a, where)); hit.forEach(a => Object.assign(a, data)); return { count: hit.length };
      }),
    },
  };
  return { db: db as unknown as BundleDatabase, mock: db, rows, allocations };
}

function setup({ allocate = true }: { allocate?: boolean } = {}) {
  const fixture = createSyntheticResolverAuthority();
  const { db, mock, rows, allocations } = fakeDatabase();
  const national = createNationalContentBundleStore(db);
  const allocationStore = createContentBundleAllocationStore(db);
  const repository = createContentBundleRepository(db, "school-a");
  const sealed = sealContentBundle(fixture.bundle);
  if (!sealed.ok) throw new Error("invalid fixture");
  const composition = { manifest: sealed.sealed.bundle, revisions: fixture.pins };
  const member = fixture.bundle.lessons[0].identity;
  const ref: GovernedScheduledWorkRef = { bundleId: fixture.bundle.identity.bundleId, bundleVersion: fixture.bundle.identity.version,
    bundleContentHash: composition.manifest.identity.contentHash!, ...member };
  const reader = withPersistentComposition(fixture.reader, repository);
  /** National store plus an explicit allocation to school-a (the default reader scope). */
  async function store() {
    const row = await national.storeNationalContentBundle(composition, "national-actor");
    if (allocate) await allocationStore.grant({ bundleId: row.bundleId, bundleVersion: row.bundleVersion, schoolId: "school-a", governanceRef: "decision.test", grantedById: "governance-actor" });
    return row;
  }
  return { fixture, db, mock, rows, allocations, national, allocationStore, repository, composition, ref, reader, store };
}

function schoolOwned(s: ReturnType<typeof setup>, school = "school-a") {
  const manifest = structuredClone(s.fixture.bundle) as typeof s.fixture.bundle & { identity: { bundleId: string; contentHash: string | null } };
  manifest.identity = { ...manifest.identity, bundleId: `${schoolBundleNamespace(school)}fractions`, contentHash: null };
  return { manifest, revisions: s.fixture.pins };
}

describe("immutable sealed persistence", () => {
  it("persists exact sealed composition and indexed identities", async () => {
    const s = setup(); const row = await s.store();
    expect(row).toMatchObject({ ownerScope: "NATIONAL", ownerSchoolId: null, contentHash: s.ref.bundleContentHash });
    expect(await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).toEqual(s.composition);
    expect(await s.repository.getContentBundleByHash(row.contentHash)).toHaveLength(1);
  });
  it("rejects duplicate identities and immutable overwrite", async () => {
    const s = setup(); await s.store();
    await expect(s.national.storeNationalContentBundle(s.composition, "actor")).rejects.toThrow("UNIQUE_IDENTITY");
    expect(Object.keys(s.repository)).not.toContain("update");
    expect(s.rows).toHaveLength(1);
    const changed = { ...s.fixture.bundle, identity: { ...s.fixture.bundle.identity, title: "Corrected title", contentHash: null } };
    await expect(s.national.storeNationalContentBundle({ ...s.composition, manifest: changed }, "actor")).rejects.toThrow("UNIQUE_IDENTITY");
    expect((await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion))?.manifest.identity.title).toBe(s.fixture.bundle.identity.title);
  });
  it("permits a correction under a new exact version", async () => {
    const s = setup(); await s.store();
    const manifest = structuredClone(s.fixture.bundle);
    const updated = { ...manifest, identity: { ...manifest.identity, version: "2.0.0", contentHash: null } };
    await s.national.storeNationalContentBundle({ ...s.composition, manifest: updated }, "actor");
    expect(s.rows).toHaveLength(2);
  });
  it.each(["contentHash", "compositionHash", "bundleVersion", "releaseIdentity", "ownerScope"] as const)("rejects corrupt stored %s", async key => {
    const s = setup(); await s.store();
    s.rows[0][key] = "corrupt";
    if (key === "bundleVersion") expect(await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).toBeNull();
    else if (key === "ownerScope") expect(await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).toBeNull();
    else await expect(s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).rejects.toThrow();
  });
  it("rejects excluded metadata or revision-pin corruption too", async () => {
    const s = setup(); await s.store();
    (s.rows[0].sealedComposition as any).revisions[s.ref.itemId].revisionId = "changed";
    await expect(s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).rejects.toThrow("STORED_COMPOSITION_HASH_MISMATCH");
  });
  it.each([{ bad: true }, { ...createSyntheticResolverAuthority().bundle, studentId: "child" }])("rejects invalid/student-state manifests before insertion", async manifest => {
    const s = setup(); await expect(s.national.storeNationalContentBundle({ ...s.composition, manifest }, "actor")).rejects.toThrow();
    expect(s.mock.contentBundleRecord.create).not.toHaveBeenCalled();
  });
  it("rejects caller supplied stale hash", async () => {
    const s = setup(); const manifest = { ...s.fixture.bundle, identity: { ...s.fixture.bundle.identity, contentHash: "f".repeat(64) } };
    await expect(s.national.storeNationalContentBundle({ ...s.composition, manifest }, "actor")).rejects.toThrow();
  });
  it("teacher preview resolves allocated stored compositions with existing authority dependencies", async () => {
    const s = setup(); await s.store();
    const preview = getContentBundlePreviewResolver({ NODE_ENV: "test" }, {
      canPreviewBundle: async scope => scope.schoolId === "school-a", createReader: () => s.reader,
      source: { kind: "FIXTURE", authoritative: false, label: "Synthetic storage test" },
    });
    const result = await preview.resolveForTeacherPreview({ ...s.fixture.input, viewer: { userId: "actor", role: "TEACHER", schoolId: "school-a" } });
    expect(result.status).toBe("RESOLVED");
  });
  it("preview does not claim a valid persisted composition is missing when authority is incomplete", async () => {
    const s = setup(); s.fixture.bundle.identity.bundleId = "g4-math-fractions";
    await s.national.storeNationalContentBundle({ manifest: s.fixture.bundle, revisions: s.fixture.pins }, "actor");
    await s.allocationStore.grant({ bundleId: "g4-math-fractions", bundleVersion: s.fixture.bundle.identity.version, schoolId: "school-a", governanceRef: "decision.test", grantedById: "governance-actor" });
    const preview = getContentBundlePreviewResolver({ NODE_ENV: "test" }, {
      canPreviewBundle: async () => true, createReader: () => ({ ...s.reader, readRevision: async () => null }),
    });
    const result = await preview.resolveForTeacherPreview({ bundleId: "g4-math-fractions", bundleVersion: s.fixture.bundle.identity.version, viewer: { userId: "actor", role: "TEACHER", schoolId: "school-a" } });
    expect(result.status).toBe("INCOMPATIBLE");
    expect(result.diagnostics.some(d => d.code === "COMPOSITION_MISSING")).toBe(false);
    expect(result.diagnostics.some(d => d.code === "ITEM_REVISION_MISSING")).toBe(true);
  });
});

describe("DEC-011 national registry, school ownership and allocation", () => {
  it("reuses one national record across two allocated schools without duplicating its payload", async () => {
    const s = setup(); const row = await s.store();
    await s.allocationStore.grant({ bundleId: row.bundleId, bundleVersion: row.bundleVersion, schoolId: "school-b", governanceRef: "decision.test", grantedById: "governance-actor" });
    const b = createContentBundleRepository(s.db, "school-b");
    expect(await s.repository.getContentBundle(row.bundleId, row.bundleVersion)).toEqual(s.composition);
    expect(await b.getContentBundle(row.bundleId, row.bundleVersion)).toEqual(s.composition);
    expect(s.rows).toHaveLength(1);
    expect(s.allocations.map(a => a.bundleRecordId)).toEqual([row.id, row.id]);
  });
  it("a national record is unavailable to a school with no allocation", async () => {
    const s = setup({ allocate: false }); const row = await s.store();
    expect(await s.repository.getContentBundle(row.bundleId, row.bundleVersion)).toBeNull();
    expect(await s.repository.getContentBundleByHash(row.contentHash)).toEqual([]);
    expect((await resolveContentBundle(s.fixture.input, s.reader)).status).toBe("UNAVAILABLE");
  });
  it("revocation removes access immediately and is one-way", async () => {
    const s = setup(); const row = await s.store();
    await s.allocationStore.revoke({ allocationId: s.allocations[0].id, revokedById: "governance-actor", revocationRef: "decision.revoke" });
    expect(await s.repository.getContentBundle(row.bundleId, row.bundleVersion)).toBeNull();
    expect((await readScheduledWorkDelivery(s.ref, s.reader, async () => { throw new Error("LEGACY"); })).status).toBe("UNAVAILABLE");
    await expect(s.allocationStore.revoke({ allocationId: s.allocations[0].id, revokedById: "governance-actor", revocationRef: "again" })).rejects.toThrow("ACTIVE_ALLOCATION_REQUIRED");
  });
  it("allocation is exact-version: allocating 1.0 never grants 2.0", async () => {
    const s = setup(); await s.store();
    const v2 = { ...structuredClone(s.fixture.bundle), identity: { ...s.fixture.bundle.identity, version: "2.0.0", contentHash: null } };
    await s.national.storeNationalContentBundle({ manifest: v2, revisions: s.fixture.pins }, "national-actor");
    expect(await s.repository.getContentBundle(s.ref.bundleId, "2.0.0")).toBeNull();
    expect(await s.repository.getContentBundle(s.ref.bundleId, s.ref.bundleVersion)).not.toBeNull();
    await expect(s.repository.getContentBundle(s.ref.bundleId, "latest")).rejects.toThrow("EXACT_BUNDLE_IDENTITY_REQUIRED");
  });
  it("school-owned content stays private to its owner and needs no allocation", async () => {
    const s = setup(); const owned = schoolOwned(s);
    const row = await s.repository.storeSchoolContentBundle(owned, "teacher-a");
    expect(row).toMatchObject({ ownerScope: "SCHOOL", ownerSchoolId: "school-a" });
    expect(await s.repository.getContentBundle(row.bundleId, row.bundleVersion)).not.toBeNull();
    expect(await createContentBundleRepository(s.db, "school-b").getContentBundle(row.bundleId, row.bundleVersion)).toBeNull();
    expect(await createContentBundleRepository(s.db, "school-b").getContentBundleByHash(row.contentHash)).toEqual([]);
  });
  it("school-owned content cannot be allocated, i.e. never becomes national by allocation", async () => {
    const s = setup(); const row = await s.repository.storeSchoolContentBundle(schoolOwned(s), "teacher-a");
    await expect(s.allocationStore.grant({ bundleId: row.bundleId, bundleVersion: row.bundleVersion, schoolId: "school-b", governanceRef: "decision.test", grantedById: "x" })).rejects.toThrow("NATIONAL_BUNDLE_REQUIRED");
  });
  it("cross-school denial: a school cannot claim a national or another school's identity", async () => {
    const s = setup();
    await expect(s.repository.storeSchoolContentBundle(s.composition, "teacher-a")).rejects.toThrow("SCHOOL_NAMESPACE_REQUIRED");
    await expect(s.repository.storeSchoolContentBundle(schoolOwned(s, "school-b"), "teacher-a")).rejects.toThrow("SCHOOL_NAMESPACE_REQUIRED");
    await expect(s.national.storeNationalContentBundle(schoolOwned(s, "school-a"), "national-actor")).rejects.toThrow("NATIONAL_NAMESPACE_INVALID");
    expect(s.mock.contentBundleRecord.create).not.toHaveBeenCalled();
  });
  it("governed scheduling refuses a national bundle the class's school is not allocated", async () => {
    const s = setup({ allocate: false }); await s.store(); const { db, tx } = scheduleDb(s);
    await expect(createGovernedScheduledWork(db, { schoolId: "school-a", actorId: "actor", classId: "class", contentId: s.ref.itemId, scheduledDate: new Date(), governedContentRef: s.ref }, () => s.fixture.reader)).rejects.toThrow("STORED_BUNDLE_MISSING");
    expect(tx.scheduledWork.create).not.toHaveBeenCalled();
  });
});

function scheduleDb(s: ReturnType<typeof setup>, school = "school-a") {
  const tx = { ...s.mock,
    class: { findUnique: vi.fn(async () => ({ schoolId: school, teacherId: "actor", gradeLevel: s.fixture.bundle.identity.gradeLevel, subject: s.fixture.bundle.identity.subject })) },
    user: { findUnique: vi.fn(async () => ({ schoolId: "school-a", role: "TEACHER" })) },
    curriculumContent: { findUnique: vi.fn(async () => ({ schoolId: null, grade: s.fixture.bundle.identity.gradeLevel, subject: s.fixture.bundle.identity.subject })) },
    scheduledWork: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "governed-work", ...data })) },
    auditLog: { create: vi.fn(async () => ({ id: "audit" })) },
  };
  return { tx, db: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) } as unknown as PrismaClient };
}

describe("ScheduledWork exact pins", () => {
  it("classifies legacy and preserves its callback result", async () => {
    const s = setup(); const legacy = vi.fn(async () => ({ payload: "unchanged" }));
    expect(classifyScheduledWork({})).toBe("LEGACY_UNPINNED");
    expect(await readScheduledWorkDelivery({}, s.reader, legacy)).toMatchObject({ status: "LEGACY", legacy: { payload: "unchanged" } });
    expect(legacy).toHaveBeenCalledOnce();
  });
  it("resolves complete pins and never invokes legacy", async () => {
    const s = setup(); await s.store();
    const legacy = vi.fn(async () => null);
    expect(classifyScheduledWork(s.ref)).toBe("GOVERNED_PINNED");
    expect((await readScheduledWorkDelivery(s.ref, s.reader, legacy)).status).toBe("RESOLVED");
    expect(legacy).not.toHaveBeenCalled();
  });
  it("every one of the 62 partial presence combinations is invalid, never legacy", () => {
    const s = setup(); const keys = ["bundleId", "bundleVersion", "bundleContentHash", "itemId", "itemVersion", "itemKind"] as const;
    for (let mask = 1; mask < 63; mask++) {
      const row = Object.fromEntries(keys.map((key, i) => [key, mask & (1 << i) ? s.ref[key] : null]));
      expect(classifyScheduledWork(row), `mask ${mask}`).toBe("INVALID_PARTIAL_PIN");
    }
  });
  it.each([" latest ", " 1.0.0", "1.0.0 ", "LATEST", ""])("padded or moving version %j is invalid, not governed", version => {
    const s = setup(); expect(classifyScheduledWork({ ...s.ref, itemVersion: version })).toBe("INVALID_PARTIAL_PIN");
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
    const s = setup(); await s.store();
    const legacy = vi.fn(async () => null);
    expect((await readScheduledWorkDelivery({ ...s.ref, ...changes }, s.reader, legacy)).status).not.toBe("RESOLVED");
    expect(legacy).not.toHaveBeenCalled();
  });
  it("fails closed on revoked existing authority", async () => {
    const s = setup(); await s.store();
    const reader = { ...s.reader, readRevision: async () => null };
    expect((await readScheduledWorkDelivery(s.ref, reader, async () => null)).status).toBe("INCOMPATIBLE");
  });
  it("creates all six pins in one transactional insert", async () => {
    const s = setup(); await s.store(); const { db, tx } = scheduleDb(s);
    const result = await createGovernedScheduledWork(db, { schoolId: "school-a", actorId: "actor", classId: "class", contentId: s.ref.itemId, scheduledDate: new Date(), governedContentRef: s.ref }, () => s.fixture.reader);
    expect(result).toMatchObject(s.ref); expect(tx.scheduledWork.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it("blocks cross-school pinning before insertion", async () => {
    const s = setup(); await s.store(); const { db, tx } = scheduleDb(s, "school-b");
    await expect(createGovernedScheduledWork(db, { schoolId: "school-a", actorId: "actor", classId: "class", contentId: s.ref.itemId, scheduledDate: new Date(), governedContentRef: s.ref }, () => s.fixture.reader)).rejects.toThrow("SCHEDULE_SCOPE_FORBIDDEN");
    expect(tx.scheduledWork.create).not.toHaveBeenCalled();
  });
});

describe("read-only backfill and guarded local application", () => {
  async function analyze() {
    const s = setup(); await s.store();
    const rows: BackfillRow[] = ["safe", "ambiguous", "none", "pinned", "partial"].map(id => ({ id, schoolId: "school-a", classId: "class-a", contentId: s.ref.itemId, gradeLevel: s.fixture.bundle.identity.gradeLevel, subject: s.fixture.bundle.identity.subject,
      ...(id === "pinned" ? s.ref : id === "partial" ? { bundleId: s.ref.bundleId } : {}) }));
    const matches: BackfillMatch[] = [
      { scheduledWorkId: "safe", schoolId: "school-a", contentId: s.ref.itemId, ref: s.ref },
      { scheduledWorkId: "ambiguous", schoolId: "school-a", contentId: s.ref.itemId, ref: s.ref },
      { scheduledWorkId: "ambiguous", schoolId: "school-a", contentId: s.ref.itemId, ref: { ...s.ref, itemVersion: "other" } },
    ];
    return { s, rows, matches, analysis: await analyzeScheduledWorkBackfill(rows, matches, () => s.reader) };
  }
  const local = () => { vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test"); vi.stubEnv("DIRECT_URL", "postgresql://test:test@127.0.0.1:5432/test"); };
  it("classifies all five states and outputs complete safe proposals with the observed source", async () => {
    const { analysis, s } = await analyze();
    expect(analysis.map(row => row.status)).toEqual(["SAFE_TO_PIN", "AMBIGUOUS", "NO_GOVERNED_MATCH", "ALREADY_PINNED", "INVALID_PARTIAL_PIN"]);
    expect(analysis[0].proposed).toEqual(s.ref);
    expect(analysis[0].observed).toEqual({ contentId: s.ref.itemId, classId: "class-a" });
  });
  it("ambiguity does not depend on correspondence order", async () => {
    const { rows, matches, s } = await analyze();
    const reversed = await analyzeScheduledWorkBackfill(rows, [...matches].reverse(), () => s.reader);
    expect(reversed[1].status).toBe("AMBIGUOUS");
  });
  it("an unallocated national bundle is never SAFE_TO_PIN", async () => {
    const s = setup({ allocate: false }); await s.store();
    const row: BackfillRow = { id: "w", schoolId: "school-a", classId: "class-a", contentId: s.ref.itemId, gradeLevel: s.fixture.bundle.identity.gradeLevel, subject: s.fixture.bundle.identity.subject };
    expect((await analyzeScheduledWorkBackfill([row], [{ scheduledWorkId: "w", schoolId: "school-a", contentId: s.ref.itemId, ref: s.ref }], () => s.reader))[0].status).toBe("NO_GOVERNED_MATCH");
  });
  it("dry run never calls writer", async () => {
    const { analysis } = await analyze(); const writer = vi.fn(async () => 1);
    expect(await applySafeBackfill(analysis, writer)).toEqual({ mode: "DRY_RUN", written: 0 }); expect(writer).not.toHaveBeenCalled();
  });
  it("conditional local application compares the observed source and is idempotent", async () => {
    local();
    const { analysis } = await analyze(); const writtenIds = new Set<string>();
    const writer = vi.fn(async (request: { where: { id?: unknown } }) => { const id = String(request.where.id); if (writtenIds.has(id)) return 0; writtenIds.add(id); return 1; });
    expect(await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).toMatchObject({ written: 1, refused: [] });
    expect(await applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).toMatchObject({ written: 0, refused: ["safe"] });
    expect([...writtenIds]).toEqual(["safe"]);
    expect(writer).toHaveBeenCalledWith({ where: { id: "safe", contentId: analysis[0].proposed!.itemId, classId: "class-a", class: { schoolId: "school-a" }, bundleId: null, bundleVersion: null, bundleContentHash: null, itemId: null, itemVersion: null, itemKind: null }, data: analysis[0].proposed });
    await expect(applySafeBackfill(analysis, writer, { write: true })).rejects.toThrow("HOSTED_BACKFILL_NOT_AUTHORIZED");
  });
  it("rejects hosted targets even when a caller labels them LOCAL_TEST", async () => {
    const { analysis } = await analyze(); const writer = vi.fn(async () => 1);
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@hosted.example.invalid/test");
    await expect(applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).rejects.toThrow("HOSTED_BACKFILL_NOT_AUTHORIZED");
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/test"); vi.stubEnv("DIRECT_URL", "postgresql://test:test@hosted.example.invalid/test");
    await expect(applySafeBackfill(analysis, writer, { write: true, target: "LOCAL_TEST" })).rejects.toThrow("HOSTED_BACKFILL_NOT_AUTHORIZED");
    expect(writer).not.toHaveBeenCalled();
  });
  it("never copies legacy fields from a correspondence into a proposal or write", async () => {
    const { analysis, rows, s } = await analyze();
    const ref = { ...s.ref, contentId: "unrelated", classId: "foreign-class" };
    const result = await analyzeScheduledWorkBackfill(rows, [{ scheduledWorkId: "safe", schoolId: "school-a", contentId: s.ref.itemId, ref }], () => s.reader);
    expect(result[0].proposed).toEqual(s.ref);
    local();
    const writer = vi.fn(async () => 1);
    await applySafeBackfill([{ ...analysis[0], proposed: ref }], writer, { write: true, target: "LOCAL_TEST" });
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({ data: s.ref }));
  });
  it.each([{ id: "" }, { observed: undefined }, { observed: { contentId: "", classId: "class-a" } }, { observed: { contentId: "x", classId: " " } }])("rejects missing scope or observed source %j instead of issuing a broad update", async change => {
    const { analysis } = await analyze(); const writer = vi.fn(async () => 1);
    local();
    await expect(applySafeBackfill([{ ...analysis[0], ...change }], writer, { write: true, target: "LOCAL_TEST" })).rejects.toThrow("BACKFILL_SCOPE_REQUIRED");
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

describe("Activity Wave pointer compatibility", () => {
  /** Converts the synthetic bundle's first activity into an exact governed ActivityDefinition pointer. */
  function governedActivity() {
    const s = setup();
    const base = s.fixture as unknown as { bundle: any; release: any; inventory: any; revisions: Record<string, any>; pins: Record<string, any>; reader: any };
    const { identity, extensions: _extensions, ...content } = base.bundle.activities[0];
    const definition = {
      schemaVersion: "activity-definition.v1", activityId: identity.itemId, version: identity.itemVersion, kind: identity.itemKind,
      contentHash: "0".repeat(64), content, resources: base.bundle.resources,
      lessonBindings: content.lessonItemIds.map((lessonId: string) => ({ lessonId, version: base.bundle.lessons.find((l: any) => l.identity.itemId === lessonId).identity.itemVersion })),
      release: { releaseId: base.release.id, releaseIdentity: "pending" }, governance: base.bundle.governance,
    } as { -readonly [K in keyof ActivityDefinitionV1]: any };
    definition.contentHash = hashActivityDefinition(definition);
    const bindings: CurriculumContentBinding[] = base.release.contentBindings.filter((b: CurriculumContentBinding) => b.contentType !== "ACTIVITY");
    for (const concept of base.inventory.concepts.filter((c: any) => definition.content.objectiveIds.includes(c.objectiveId))) bindings.push({ ...base.release.contentBindings[0], id: `synthetic.activity.${concept.conceptId}.${concept.objectiveId}`, conceptId: concept.conceptId, contentId: definition.activityId, contentVersion: definition.version, contentType: "ACTIVITY", contentSha256: definition.contentHash });
    base.release.contentBindings = bindings;
    const releaseIdentity = deterministicReleaseIdentity(base.release);
    base.inventory.releaseIdentity = releaseIdentity; base.bundle.curriculumAuthority.releaseIdentity = releaseIdentity; definition.release.releaseIdentity = releaseIdentity;
    const snapshot = { activityDefinition: structuredClone(definition) };
    const revision = { ...base.revisions[definition.activityId], member: activityBundleMember(definition), snapshot, contentHash: hashCurriculumSnapshot(1, snapshot) };
    base.revisions[definition.activityId] = revision;
    base.pins[definition.activityId] = { revisionId: revision.revisionId, provenanceId: revision.provenanceId, contentHash: revision.contentHash };
    const authority: ActivityAuthorityReader = {
      readActivity: async () => ({ definition, revision: base.pins[definition.activityId] }),
      readRevision: base.reader.readRevision, readRelease: base.reader.readRelease, readInventory: base.reader.readInventory,
      readCurriculumAuthority: base.reader.readCurriculumAuthority, readResource: base.reader.readResource, readRubric: async ref => ref,
    };
    base.bundle.activities = base.bundle.activities.filter((a: any) => a.identity.itemId !== definition.activityId);
    base.bundle.activityReferences = [{ activityId: definition.activityId, version: definition.version, kind: definition.kind }];
    base.reader.activityAuthority = authority;
    return { s, definition, composition: { manifest: base.bundle, revisions: base.pins } };
  }
  it("stores a pointer manifest and pins a governed activity by activityId/version/kind", async () => {
    const { s, definition, composition } = governedActivity();
    const row = await s.national.storeNationalContentBundle(composition, "national-actor");
    await s.allocationStore.grant({ bundleId: row.bundleId, bundleVersion: row.bundleVersion, schoolId: "school-a", governanceRef: "decision.test", grantedById: "governance-actor" });
    const ref = { bundleId: row.bundleId, bundleVersion: row.bundleVersion, bundleContentHash: row.contentHash, itemId: definition.activityId, itemVersion: definition.version, itemKind: definition.kind };
    expect(classifyScheduledWork(ref)).toBe("GOVERNED_PINNED");
    const reader = withPersistentComposition(s.fixture.reader, s.repository);
    expect((await readScheduledWorkDelivery(ref, reader, async () => { throw new Error("LEGACY"); })).status).toBe("RESOLVED");
    expect((await readScheduledWorkDelivery({ ...ref, itemVersion: "9.9.9" }, reader, async () => { throw new Error("LEGACY"); })).status).not.toBe("RESOLVED");
  });
  it("rejects a pointer manifest whose pointer has no exact revision pin", async () => {
    const { s, definition, composition } = governedActivity();
    const revisions = { ...composition.revisions }; delete revisions[definition.activityId];
    await expect(s.national.storeNationalContentBundle({ manifest: composition.manifest, revisions }, "national-actor")).rejects.toThrow("INVALID_REVISION_PINS");
  });
});
