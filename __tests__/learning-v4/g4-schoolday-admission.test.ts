/**
 * G4-E2E admission (CoS ruling A, COS-G4-E2E-ADMISSION-RULING-20261028.md): RED before GREEN.
 * 1. Exactly 8 registered Grade 4 school-day selections with their exact accepted packageHashes; no wildcard.
 * 2. A sealed loader with byte and hash verification; a tampered package is refused.
 * 3. Inert by default: nothing is admitted without the preview PolicyConfig row (and the flag gates the routes).
 *    PILOT_ONLY, canonicalRecordWrites false, the exact timetable binding and the MASTERY_CHECK replacement are kept.
 * Synthetic fixtures only; no database.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as preview from "@/lib/curriculum/v4/learningPreview";
import { resolvePilotDay } from "@/lib/curriculum/v4/pilotDay";

const G4 = {
  "factory@4.0.0-schoolday-primary-math.2-draft.1@g4-math-three-digit-products": "df24c30a680e745006ef124f671a26cccb1bdf64a8ec9f79b3273e8ba4d98eb2",
  "factory@4.0.0-schoolday-primary-science.2-draft.1@g4-science-food-path-and-absorption": "6c9bb35aa616f76c316159159dcc2b96c22618e1a628f6e14a66b294ab2c607a",
  "factory@4.0.0-schoolday-primary-english.2-draft.1@g4-english-predict-question-summarize": "39c9cafb634914512bd4cf396cdb454b2770a9057e5bd93734a6787e8757f0e6",
  "factory@4.0.0-schoolday-primary-social-studies.2-draft.1@g4-social-studies-coast-inland-evidence": "924e57dcc56e65c20eaedb5133c70d84a433f935c898349ac053df22b584cd04",
  "factory@4.0.0-schoolday-primary-computing.2-draft.1@g4-computing-keep-score-with-variables": "be00b57563b01f490e99768e2787fd46271e446bf97d8a6d8c790a7f4deaba43",
  "factory@4.0.0-schoolday-primary-engineering.2-draft.1@g4-engineering-compare-flashlight-switches": "202106a8bffa0afb8c05aa9338db458b5b913483f70a222c2bc1b8a579b7a7a1",
  "factory@4.0.0-schoolday-grade4-support.2-draft.1@g4-support-retrieve-reteach-retry": "936016a5f43b7f8beb9d70696b0422f25c73862d8435c335ba5f221d0d79dd25",
  "factory@4.0.0-schoolday-grade4-eod.1-draft.1@g4-eod-evidence-connections": "f99247e183ee0653787d97354202974d1d3ad26e92e09bf5a5898230e2ef7791",
} as const;
const SELECTIONS = Object.keys(G4) as Array<keyof typeof G4>;
const SUBJECTS = ["MATH", "SCIENCE", "ENGLISH", "SOCIAL_STUDIES", "COMPUTER_SCIENCE", "ENGINEERING", "SUPPORT", "END_OF_DAY"];
const schoolId = "g4e2e-school", classId = "g4e2e-class", studentId = "g4e2e-student";
const user = { id: "g4e2e-student-user", role: "STUDENT", schoolId };
const now = Date.parse("2026-10-28T09:00:00Z");
const refs = { content: "SYNTHETIC-E2E-ONLY", rights: "SYNTHETIC-E2E-ONLY", access: "SYNTHETIC-E2E-ONLY", accessibility: "SYNTHETIC-E2E-ONLY",
  safety: "SYNTHETIC-E2E-ONLY", runtime: "SYNTHETIC-E2E-ONLY", releaseAuthorization: "SYNTHETIC-E2E-ONLY" };
const rawPolicy = (overrides: Record<string, unknown> = {}) => ({
  version: "learning-preview/1.0.0", status: "PILOT_ONLY", enabled: true, revokedAt: null,
  startsAt: "2026-10-28T00:00:00Z", endsAt: "2026-10-29T00:00:00Z", schoolId, studentUserIds: [user.id], classIds: [classId],
  canonicalRecordWrites: false, offlineDelivery: false,
  lessons: SELECTIONS.map((selection, i) => ({ selection, packageHash: G4[selection], revokedAt: null, approvalRecordId: `g4e2e-approval-${i}`,
    timetable: [{ classId, timetableId: `g4e2e-tt-${i}`, subject: SUBJECTS[i] }], reviews: refs })),
  ...overrides,
});

/** A synthetic in-memory store with the policy, the per-lesson approval and its audit row. */
function fakeDb(options: { policy?: boolean } = {}) {
  // Raw config, exactly as stored: the loader under test parses it (no parse here, so guards never fail early).
  const policy = rawPolicy() as any;
  const approvals = new Map<string, any>(), audits = new Map<string, any>();
  policy.lessons.forEach((lesson: any, i: number) => {
    const bindingSha256 = preview.pilotApprovalBinding(policy, lesson.selection, lesson.packageHash);
    approvals.set(lesson.approvalRecordId, { id: lesson.approvalRecordId, policyKey: preview.PILOT_RELEASE_APPROVAL_KEY, scope: "SCHOOL", schoolId, isActive: true,
      config: { status: "AUTHORIZED_PILOT_RELEASE", bindingSha256, auditLogId: `g4e2e-audit-${i}` }, createdById: "g4e2e-authority", createdBy: { role: "ADMIN", isPlatformAdmin: true } });
    audits.set(`g4e2e-audit-${i}`, { userId: "g4e2e-authority", action: "V4_PILOT_RELEASE_AUTHORIZED", resourceId: lesson.approvalRecordId,
      resourceType: "PolicyConfig", schoolId, details: { bindingSha256, syntheticTestOnly: true } });
  });
  return {
    user: { findUnique: async () => ({ id: user.id, role: "STUDENT", schoolId, school: { status: "ACTIVE" },
      student: { deletedAt: null, enrollments: [{ Class: { id: classId, schoolId } }], academicEnrollments: [] } }) },
    policyConfig: {
      findMany: async () => (options.policy === false ? [] : [{ config: policy }]),
      findUnique: async ({ where }: any) => approvals.get(where.id) ?? null,
    },
    auditLog: { findUnique: async ({ where }: any) => audits.get(where.id) ?? null },
    timetable: { findMany: async () => SELECTIONS.map((_, i) => ({ id: `g4e2e-tt-${i}`, schoolId, classId, subject: SUBJECTS[i], periodLabel: `P${i + 1}`,
      startTime: `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`, endTime: null })) },
  } as never;
}

describe("1. exactly the 8 registered Grade 4 selections, exact hashes, no wildcard", () => {
  it("RED: the policy accepts each of the 8 with its exact hash", () => {
    expect(preview.previewPolicySchema.safeParse(rawPolicy()).success).toBe(true);
  });
  it("RED: a registered selection with another hash is refused", () => {
    const lessons = rawPolicy().lessons.map((l, i) => (i === 5 ? { ...l, packageHash: "0".repeat(64) } : l));
    expect(preview.previewPolicySchema.safeParse(rawPolicy({ lessons })).success).toBe(false);
  });
  it.each([
    "factory@4.0.0-schoolday-primary-engineering.1-draft.1@g4-engineering-compare-flashlight-switches",
    "factory@4.0.0-schoolday-primary-math.2-draft.2@g4-math-three-digit-products",
    "factory@4.0.0-schoolday-primary-math.2-draft.1@g4-math-other-lesson",
  ])("guard: an unregistered school-day selection %s is refused by the policy and the URL boundary", (selection) => {
    const lessons = [{ ...rawPolicy().lessons[0], selection }];
    expect(preview.previewPolicySchema.safeParse(rawPolicy({ lessons })).success).toBe(false);
    expect(preview.parsePreviewSelection(selection)).toBeNull();
  });
  it("RED: the URL boundary accepts exactly the 8 registered selections", () => {
    for (const selection of SELECTIONS) expect(preview.parsePreviewSelection(selection)).toBe(selection);
    expect(preview.parsePreviewSelection(encodeURIComponent(SELECTIONS[0]))).toBe(SELECTIONS[0]);
  });
});

describe("2-3. sealed loading, inert without the policy row, pilot-only experience", () => {
  it.each(SELECTIONS)("RED: %s is admitted with the policy, approval and audit rows: PILOT_ONLY, no record writes, no mastery check", async (selection) => {
    const i = SELECTIONS.indexOf(selection);
    const loaded = await preview.loadStudentLearningPreview(fakeDb(), user, selection, now, { timetableId: `g4e2e-tt-${i}`, classId, subject: SUBJECTS[i] });
    expect(loaded?.status).toBe("PILOT_ONLY");
    expect(loaded?.canonicalRecordWrites).toBe(false);
    expect(loaded?.identity.packageHash).toBe(G4[selection]);
    expect(loaded?.identity.selection).toBe(selection);
    expect(loaded?.experience.scenes.some((s) => s.type === "MASTERY_CHECK" || s.interaction.kind === "ASSESSMENT_HANDOFF")).toBe(false);
  });
  it("guard: nothing is admitted without the preview policy row", async () => {
    for (const selection of SELECTIONS) expect(await preview.loadStudentLearningPreview(fakeDb({ policy: false }), user, selection, now)).toBeNull();
  });
  it("RED: an untampered package loads through the sealed loader", () => {
    const { loader, selection, root } = sealedCopy();
    expect(() => loader(selection, root)).not.toThrow();
  });
  it("guard: the school day resolver is inert while the flag is off", async () => {
    expect(await resolvePilotDay(fakeDb(), user, new Date(now), now, { V4_LEARNING_PREVIEW_ENABLED: undefined })).toBeNull();
  });
  it("RED: with the flag on and the policy row, the day admits all 8 periods with their exact hashes", async () => {
    const day = await resolvePilotDay(fakeDb(), user, new Date(now), now, { V4_LEARNING_PREVIEW_ENABLED: "1" });
    expect(day?.canonicalRecordWrites).toBe(false);
    expect(day?.periods.map((p) => (p.status === "ADMITTED" ? p.packageHash : p.status))).toEqual(SELECTIONS.map((s) => G4[s]));
  });
});

const VERSION = "4.0.0-schoolday-primary-engineering.2-draft.1", KEY = "g4-engineering-compare-flashlight-switches";
/** A private copy of one sealed package in a temporary root; the repository copy is never modified. */
function sealedCopy() {
  const root = mkdtempSync(path.join(tmpdir(), "g4e2e-"));
  cpSync(path.join("curriculum/factory-v4/drafts", VERSION), path.join(root, "curriculum/factory-v4/drafts", VERSION), { recursive: true });
  const loader = (preview as any).loadSchooldayPackage as (selection: string, root?: string) => unknown;
  if (typeof loader !== "function") throw Error("loadSchooldayPackage_missing");
  const file = (name: string) => path.join(root, "curriculum/factory-v4/drafts", VERSION, KEY, name);
  return { root, loader, selection: `factory@${VERSION}@${KEY}`, file };
}
const editManifest = (file: (n: string) => string, edit: (m: any) => void) => {
  const m = JSON.parse(readFileSync(file("manifest.json"), "utf8")); edit(m); writeFileSync(file("manifest.json"), JSON.stringify(m, null, 2) + "\n");
};

describe("sealed school-day loader: every check fails closed (CoS addendum)", () => {
  it("RED: a tampered file is refused", () => {
    const { loader, selection, root, file } = sealedCopy();
    writeFileSync(file("learner-projection.json"), readFileSync(file("learner-projection.json"), "utf8").replace("flashlight", "Flashlight"));
    expect(() => loader(selection, root)).toThrow(/schoolday_package_file_hash/);
  });
  it("RED: a package hash that differs from the registered one is refused", () => {
    const { loader, selection, root, file } = sealedCopy();
    editManifest(file, (m) => { m.packageHash = "1".repeat(64); });
    expect(() => loader(selection, root)).toThrow(/schoolday_package_hash/);
  });
  it("RED: an extra file is refused", () => {
    const { loader, selection, root, file } = sealedCopy();
    writeFileSync(file("extra.txt"), "synthetic");
    expect(() => loader(selection, root)).toThrow(/schoolday_package_file_set/);
  });
  it("RED: a missing file is refused", () => {
    const { loader, selection, root, file } = sealedCopy();
    unlinkSync(file("teacher-guide.json"));
    expect(() => loader(selection, root)).toThrow(/schoolday_package_file_set/);
  });
  it("RED: a symlinked file is refused", (ctx) => {
    const { loader, selection, root, file } = sealedCopy();
    const target = file("paper-alternative.txt"), copy = `${target}.orig`;
    writeFileSync(copy, readFileSync(target)); rmSync(target);
    try { symlinkSync(copy, target, "file"); } catch (error) {
      if (["EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) { ctx.skip(); return; }
      throw error;
    } // symlinks need privileges on some Windows hosts
    unlinkSync(copy); unlinkSync(target); symlinkSync(path.join(root, "outside.txt"), target, "file");
    expect(() => loader(selection, root)).toThrow(/symlink|schoolday_package/);
  });
  it("a linked package root is refused, including Windows junctions", () => {
    const { loader, selection, root } = sealedCopy();
    const linkedRoot = path.join(root, "linked-root");
    symlinkSync(root, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    expect(() => loader(selection, linkedRoot)).toThrow(/factory_review_symlink/);
  });
  it.each(["approved", "published", "released", "learnerDeliverable"])("RED: a delivery flag %s set true is refused", (flag) => {
    const { loader, selection, root, file } = sealedCopy();
    editManifest(file, (m) => { m[flag] = true; });
    expect(() => loader(selection, root)).toThrow(/schoolday_package_delivery_flag/);
  });
  it("RED: an unregistered selection is refused before any read", () => {
    const { loader, root } = sealedCopy();
    expect(() => loader(`factory@${VERSION}@g4-other`, root)).toThrow(/schoolday_package_unregistered/);
    expect(() => loader("factory@4.0.0-draft.6@g7-math-area-perimeter", root)).toThrow(/schoolday_package_unregistered/);
  });
  it("guard: the loader never modifies a package (bytes unchanged after loading)", () => {
    const { loader, selection, root, file } = sealedCopy();
    const before = readFileSync(file("manifest.json"));
    try { loader(selection, root); } catch { /* RED before GREEN */ }
    expect(readFileSync(file("manifest.json")).equals(before)).toBe(true);
  });
});
