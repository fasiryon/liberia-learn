// Curriculum V2: native scene provenance identity (Codex P1-5), exact-revision human review (P1-7) and
// executable accessibility/offline deliverability (P1-8).
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCurriculumContentSnapshot, buildCurriculumContentSnapshotV1, CURRICULUM_SNAPSHOT_SCHEMA_VERSION, CURRICULUM_SNAPSHOT_SCHEMA_VERSION_NATIVE } from "@/lib/curriculum/provenance/snapshot";
import { hashCurriculumSnapshot } from "@/lib/curriculum/provenance/hash";
import { assertNativeApprovedRevisionUnchanged } from "@/lib/curriculum/mutations/repository";
import { assertNativeCurriculumV2Approval } from "@/lib/curriculum/v2/governance";
import { isNativeCurriculumV2Payload } from "@/lib/curriculum/v2/contract";
import { sceneDeliverability, RUNTIME_SCENARIOS } from "@/lib/curriculum/v2/deliverability";
import { runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import type { CandidateScene, CurriculumLessonV2 } from "@/lib/curriculum/v2/contract";

function fractionsLesson(): CurriculumLessonV2 {
  const outcome = runG4Proof("equivalent-fractions.json", "moe-math-g4-s1-p3-number-theory-and-fraction-obj5");
  if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
  return JSON.parse(JSON.stringify(outcome.lesson));
}
function solidsLesson(): CurriculumLessonV2 {
  const outcome = runG4Proof("solid-figures.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj5");
  if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
  return JSON.parse(JSON.stringify(outcome.lesson));
}
const row = (payload: unknown) => ({ title: "Equivalent fractions", grade: 4, subject: "MATH", contentType: "lesson", payload });
const hashOf = (payload: unknown) => { const { schemaVersion, snapshot } = buildCurriculumContentSnapshot(row(payload)); return hashCurriculumSnapshot(schemaVersion, snapshot); };

describe("native scene structure enters revision identity (P1-5)", () => {
  it("legacy rows keep schema v1 and their existing hash", () => {
    const legacy = row({ title: "Old", body: "A long body of text." });
    const built = buildCurriculumContentSnapshot(legacy);
    expect(built.schemaVersion).toBe(CURRICULUM_SNAPSHOT_SCHEMA_VERSION);
    expect(hashCurriculumSnapshot(built.schemaVersion, built.snapshot)).toBe(hashCurriculumSnapshot(1, buildCurriculumContentSnapshotV1(legacy)));
  });

  it("native payloads use schema v2, which v1 could not see", () => {
    const lesson = fractionsLesson();
    expect(buildCurriculumContentSnapshot(row({ curriculumV2: lesson })).schemaVersion).toBe(CURRICULUM_SNAPSHOT_SCHEMA_VERSION_NATIVE);
    const changed = fractionsLesson(); (changed.scenes[4].content as any).body = "Different instruction entirely.";
    // The v1 snapshot is blind to scenes: this is the defect P1-5 closes.
    expect(hashCurriculumSnapshot(1, buildCurriculumContentSnapshotV1(row({ curriculumV2: lesson })))).toBe(hashCurriculumSnapshot(1, buildCurriculumContentSnapshotV1(row({ curriculumV2: changed }))));
    expect(hashOf({ curriculumV2: lesson })).not.toBe(hashOf({ curriculumV2: changed }));
  });

  const mutations: Array<[string, (lesson: any) => void]> = [
    ["scene order", (l) => { [l.scenes[5], l.scenes[6]] = [l.scenes[6], l.scenes[5]]; }],
    ["scene type", (l) => { l.scenes[4].type = "GUIDED_EXAMPLE"; }],
    ["objective mapping", (l) => { l.scenes[4].objectiveIds = []; }],
    ["body", (l) => { l.scenes[4].content.body += " More."; }],
    ["interaction", (l) => { l.scenes[5].interaction.items[0].formativeKey.expectedOptionId = "a"; }],
    ["tool permissions", (l) => { l.scenes[2].tools.requested = []; }],
    ["lab link", (l) => { l.labLinks = [{ proposalId: "x", rationale: "x", eligibility: { studentEligible: false, reasons: [] }, link: { linkId: "x" } }]; }],
    ["media reference", (l) => { l.scenes[3].media = [{ id: "m", kind: "DIAGRAM", requirement: "MEDIA_OPTIONAL", description: "d", altText: "a" }]; }],
    ["accessibility adaptation", (l) => { l.scenes[4].accessibility.textAlternative += " Also."; }],
    ["offline fallback", (l) => { l.scenes[8].fallback.content += " Also."; }],
    ["assessment reference", (l) => { l.assessmentHandoffs[0].governedItems = []; }],
    ["evidence metadata", (l) => { l.scenes[6].evidence.responses[0].scaffoldLevel = "FULL"; }],
  ];
  it.each(mutations)("changing %s alone produces a new revision identity", (_name, mutate) => {
    const before = fractionsLesson();
    const after = fractionsLesson(); mutate(after);
    expect(hashOf({ curriculumV2: after })).not.toBe(hashOf({ curriculumV2: before }));
  });

  it("approved native instruction is immutable; an approval never covers modified scenes", () => {
    const lesson = fractionsLesson();
    const { schemaVersion, snapshot } = buildCurriculumContentSnapshot(row({ curriculumV2: lesson }));
    const currentRevision = { contentHash: hashCurriculumSnapshot(schemaVersion, snapshot), snapshotSchemaVersion: schemaVersion };
    const changed = fractionsLesson(); (changed.scenes[4].content as any).body = "Edited after approval.";
    const content = (payload: unknown) => ({ ...row(payload), payload } as any);
    expect(() => assertNativeApprovedRevisionUnchanged({ lifecycleState: "APPROVED" }, currentRevision, { payload: { curriculumV2: lesson } as any }, content({ curriculumV2: changed }))).toThrow("NATIVE_CURRICULUM_V2_APPROVED_REVISION_IMMUTABLE");
    expect(() => assertNativeApprovedRevisionUnchanged({ lifecycleState: "APPROVED" }, currentRevision, { payload: { curriculumV2: lesson } as any }, content({ curriculumV2: lesson }))).not.toThrow();
    expect(() => assertNativeApprovedRevisionUnchanged({ lifecycleState: "APPROVED" }, { ...currentRevision, snapshotSchemaVersion: 1 }, { payload: { curriculumV2: lesson } as any }, content({ curriculumV2: lesson }))).toThrow("IMMUTABLE");
    // Drafts and reviews may change; each change is a new revision that must be reviewed itself.
    expect(() => assertNativeApprovedRevisionUnchanged({ lifecycleState: "PENDING_REVIEW" }, currentRevision, { payload: { curriculumV2: lesson } as any }, content({ curriculumV2: changed }))).not.toThrow();
    // Legacy content keeps its existing behaviour.
    expect(() => assertNativeApprovedRevisionUnchanged({ lifecycleState: "APPROVED" }, currentRevision, { payload: { body: "a" } }, content({ body: "b" }))).not.toThrow();
  });

  it("native detection fails closed for relabelled or malformed native payloads", () => {
    expect(isNativeCurriculumV2Payload({ curriculumV2: { contractVersion: "something-else" } })).toBe(true);
    expect(isNativeCurriculumV2Payload({ curriculumV2: null })).toBe(true);
    expect(isNativeCurriculumV2Payload({ lessonExperience: {} })).toBe(true);
    expect(isNativeCurriculumV2Payload({ body: "legacy" })).toBe(false);
  });
});

describe("native Curriculum V2 requires exact-revision human review (P1-7)", () => {
  const qualified = { actorType: "USER", actorUserId: "reviewer-1", reviewAuthority: "PLATFORM", hasQualification: true, nativeSnapshotSchemaVersion: 2, revisionSnapshotSchemaVersion: 2 };
  const bases = ["HUMAN_REVIEW", "AUTOMATED_RISK_POLICY", "ROLE_POLICY", "SCHOOL_POLICY", "AI_PLATFORM_REVIEW", null];
  const events = ["APPROVED", "REAPPROVED", "REINSTATED"];

  for (const writersEnabled of [true, false]) {
    for (const eventType of events) {
      for (const approvalBasis of bases) {
        const allowed = writersEnabled && approvalBasis === "HUMAN_REVIEW";
        it(`writers ${writersEnabled ? "on" : "off"}, ${eventType} by ${approvalBasis ?? "no basis"}: ${allowed ? "allowed" : "refused"}`, () => {
          const call = () => assertNativeCurriculumV2Approval({ ...qualified, native: true, writersEnabled, eventType, approvalBasis, actorType: approvalBasis === "AI_PLATFORM_REVIEW" ? "AI" : "USER" });
          if (allowed) expect(call).not.toThrow(); else expect(call).toThrow(/NATIVE_CURRICULUM_V2/);
        });
      }
    }
  }

  it("refuses unqualified, system and stale-snapshot human approvals", () => {
    const base = { ...qualified, native: true, writersEnabled: true, eventType: "APPROVED", approvalBasis: "HUMAN_REVIEW" };
    expect(() => assertNativeCurriculumV2Approval({ ...base, hasQualification: false })).toThrow("QUALIFIED_HUMAN");
    expect(() => assertNativeCurriculumV2Approval({ ...base, reviewAuthority: "SYSTEM" })).toThrow("QUALIFIED_HUMAN");
    expect(() => assertNativeCurriculumV2Approval({ ...base, actorType: "SYSTEM" })).toThrow("QUALIFIED_HUMAN");
    expect(() => assertNativeCurriculumV2Approval({ ...base, revisionSnapshotSchemaVersion: 1 })).toThrow("SNAPSHOT_STALE");
  });

  it("leaves legacy content and non-approval events to the existing rules", () => {
    expect(() => assertNativeCurriculumV2Approval({ ...qualified, native: false, writersEnabled: true, eventType: "APPROVED", approvalBasis: "AUTOMATED_RISK_POLICY" })).not.toThrow();
    expect(() => assertNativeCurriculumV2Approval({ ...qualified, native: true, writersEnabled: true, eventType: "SUBMITTED", approvalBasis: null })).not.toThrow();
  });

  it("generation code has no path to approval: Curriculum V2 modules never import writers, the database or governance mutation", () => {
    const dir = "lib/curriculum/v2";
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, file).not.toMatch(/mutations\/|@\/lib\/db|governanceWriter|appendCurriculumGovernanceEvent|prisma/);
    }
    expect(readFileSync("scripts/build-curriculum-v2-g4-proof.ts", "utf8")).not.toMatch(/mutations\/|@\/lib\/db|prisma/);
  });
});

describe("governance writer enforces the native rule in both flag modes", () => {
  const updateProjection = vi.hoisted(() => vi.fn());
  const ensure = vi.hoisted(() => vi.fn());
  vi.mock("@/lib/curriculum/mutations/repository", async (original) => {
    const actual = await original<typeof import("@/lib/curriculum/mutations/repository")>();
    return { ...actual, updateCurriculumGovernanceProjection: updateProjection, lockCurriculumContent: vi.fn(), ensureCurriculumProvenance: ensure };
  });
  vi.mock("@/lib/audit", async (original) => ({ ...(await original<typeof import("@/lib/audit")>()), logAuditRequired: vi.fn(), logAuditRequiredWithId: vi.fn() }));
  const nativePayload = { curriculumV2: { contractVersion: "curriculum-lesson-v2/1.0.0" } };
  const approval = (approvalBasis: string, actor: Record<string, unknown> = { actorType: "USER", actorUserId: "reviewer-1", reviewAuthority: "PLATFORM", reviewerQualificationRef: "p2b:1", reviewerQualificationSnapshot: { role: "REVIEWER" } }) =>
    ({ contentId: "c-1", eventType: "APPROVED", approvalBasis, ...actor });

  beforeEach(() => { updateProjection.mockReset(); ensure.mockReset(); });
  afterEach(() => { delete process.env.P2A_PROVENANCE_WRITERS_DISABLED; });

  it("default configuration (writer flag unset) is compatibility mode and refuses native approval", async () => {
    delete process.env.P2A_PROVENANCE_WRITERS_DISABLED;
    const { appendCurriculumGovernanceEventInTransaction } = await import("@/lib/curriculum/mutations/governanceWriter");
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]), curriculumContent: { findUnique: vi.fn().mockResolvedValue({ id: "row-1", contentId: "c-1", payload: nativePayload }) }, curriculumProvenance: { findUnique: vi.fn() } };
    await expect(appendCurriculumGovernanceEventInTransaction(tx as any, approval("HUMAN_REVIEW") as any)).rejects.toThrow("NATIVE_CURRICULUM_V2_REQUIRES_EXACT_REVISION");
  });

  it("compatibility mode (writers off) refuses even a qualified human approval of native content, before any projection", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "true";
    const { appendCurriculumGovernanceEventInTransaction } = await import("@/lib/curriculum/mutations/governanceWriter");
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]), curriculumContent: { findUnique: vi.fn().mockResolvedValue({ id: "row-1", contentId: "c-1", payload: nativePayload }) }, curriculumProvenance: { findUnique: vi.fn() } };
    await expect(appendCurriculumGovernanceEventInTransaction(tx as any, approval("HUMAN_REVIEW") as any)).rejects.toThrow("NATIVE_CURRICULUM_V2_REQUIRES_EXACT_REVISION");
    expect(updateProjection).not.toHaveBeenCalled();
  });

  it("canonical mode refuses AUTOMATED_RISK_POLICY for native content even with VERIFIED provenance", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "false";
    const { appendCurriculumGovernanceEventInTransaction } = await import("@/lib/curriculum/mutations/governanceWriter");
    ensure.mockResolvedValue({ provenance: { id: "p-1" } });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      curriculumContent: { findUnique: vi.fn().mockResolvedValue({ id: "row-1", payload: nativePayload }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "row-1", payload: nativePayload }) },
      curriculumProvenance: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "p-1", currentRevisionId: "r-1", provenanceCompleteness: "VERIFIED" }) },
      curriculumContentRevision: { findFirst: vi.fn().mockResolvedValue({ id: "r-1", snapshotSchemaVersion: 2 }) },
      curriculumGovernanceEvent: { findUnique: vi.fn(), findFirst: vi.fn(() => { throw new Error("REACHED_EVENT_WRITE"); }), create: vi.fn(() => { throw new Error("REACHED_EVENT_WRITE"); }) },
    };
    await expect(appendCurriculumGovernanceEventInTransaction(tx as any, approval("AUTOMATED_RISK_POLICY", { actorType: "SYSTEM", actorLabel: "risk-policy", reviewAuthority: "SYSTEM" }) as any)).rejects.toThrow("NATIVE_CURRICULUM_V2_REQUIRES_HUMAN_REVIEW");
    await expect(appendCurriculumGovernanceEventInTransaction(tx as any, approval("HUMAN_REVIEW") as any)).rejects.toThrow("REACHED_EVENT_WRITE");
  });
});

describe("executable accessibility and offline deliverability (P1-8)", () => {
  const scene = (patch: Partial<CandidateScene>): CandidateScene => ({ ...fractionsLesson().scenes[4], ...patch } as CandidateScene);
  const blocked = (report: ReturnType<typeof sceneDeliverability>) => RUNTIME_SCENARIOS.filter((scenario) => report.byScenario[scenario] === "NOT_DELIVERABLE");

  it("a text alternative alone does not make a required video deliverable", () => {
    const video = scene({ media: [{ id: "v", kind: "VIDEO", requirement: "MEDIA_REQUIRED", description: "d", altText: "a", transcript: "t" }] });
    expect(blocked(sceneDeliverability(video, null, true))).toContain("VIDEO_UNAVAILABLE");
    const withFallback = { ...video, fallback: { kind: "TEXT_WALKTHROUGH" as const, content: "Same idea in text.", objectivePreserved: true } };
    expect(blocked(sceneDeliverability(withFallback, null, true))).toEqual([]);
    const nonPreserving = { ...video, fallback: { kind: "TEXT_WALKTHROUGH" as const, content: "Unrelated.", objectivePreserved: false } };
    expect(blocked(sceneDeliverability(nonPreserving, null, true)).length).toBeGreaterThan(0);
  });

  it("drag interactions need a non-pointer path for keyboard, screen reader and no-drag devices", () => {
    const drag = scene({ interaction: { kind: "DRAG_DROP", prompt: "Drag", elements: ["a"] }, fallback: undefined });
    expect(blocked(sceneDeliverability(drag, null, true))).toEqual(expect.arrayContaining(["DEFAULT", "KEYBOARD_ONLY", "POINTER_DRAG_UNAVAILABLE"]));
  });

  it("motion media needs a static equivalent under reduced motion", () => {
    const animation = scene({ media: [{ id: "a", kind: "ANIMATION", requirement: "MEDIA_REQUIRED", description: "d", altText: "a" }], accessibility: { textAlternative: "An animated diagram of equal parts.", keyboardPath: "Tab", reducedMotion: "NOT_APPLICABLE" } });
    expect(blocked(sceneDeliverability(animation, null, true))).toContain("REDUCED_MOTION");
  });

  it("online-only scenes and unreleased labs fall back or block; offline, WebGL and keyboard limits are checked against the lab", () => {
    expect(blocked(sceneDeliverability(scene({ offline: { mode: "ONLINE_ENHANCED", note: "n" } }), null, true))).toEqual(["OFFLINE"]);
    const labScene = solidsLesson().scenes.find((candidate) => candidate.id === "lab")!;
    const noFallback = { ...labScene, fallback: undefined };
    const lab = { lab: { labId: "g4-solid-figures" } as any, studentEligible: false, keyboard: true, reducedMotion: true, offline: true, hasFallback2D: true };
    expect(blocked(sceneDeliverability(noFallback, lab, true))).toContain("DEFAULT");
    expect(blocked(sceneDeliverability(labScene, lab, true))).toEqual([]);
    const eligible = { ...lab, studentEligible: true, offline: false, keyboard: false, reducedMotion: false, hasFallback2D: false };
    expect(blocked(sceneDeliverability(noFallback, eligible, true))).toEqual(expect.arrayContaining(["OFFLINE", "KEYBOARD_ONLY", "SCREEN_READER", "WEBGL_UNAVAILABLE", "REDUCED_MOTION", "POINTER_DRAG_UNAVAILABLE", "LOW_MEMORY"]));
    expect(blocked(sceneDeliverability(noFallback, eligible, true))).not.toContain("DEFAULT");
  });

  it("an assessment handoff with no governed items is not deliverable without a fallback", () => {
    const mastery = { ...fractionsLesson().scenes[8], fallback: undefined, offline: { mode: "FULL_OFFLINE" as const, note: "n" } };
    expect(blocked(sceneDeliverability(mastery, null, false))).toEqual([...RUNTIME_SCENARIOS]);
    expect(blocked(sceneDeliverability(mastery, null, true))).toEqual([]);
  });

  it("the proof lessons record exactly which gaps keep them out of student delivery", () => {
    const bar = runG4Proof("bar-graphs.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj6");
    if (bar.status === "REJECTED") throw new Error();
    expect(bar.status).toBe("REVIEW_BLOCKED");
    expect(bar.lesson.reviewGaps.filter((gap) => gap.severity === "BLOCKING").map((gap) => gap.code)).toEqual(expect.arrayContaining(["MEDIA_ASSET_REQUIRED", "ASSESSMENT_ITEMS_PENDING"]));
  });
});
