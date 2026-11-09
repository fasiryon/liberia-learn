import { describe, expect, it } from "vitest";
import { loadDraft6Review } from "@/lib/curriculum/v4/draft6Review";
import { authorizeLearningPreview, previewPolicySchema, isLearningPreviewEnabled, pilotExperience, parsePreviewSelection, CONDITIONALLY_ACCEPTED, pilotApprovalBinding } from "@/lib/curriculum/v4/learningPreview";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

const selection = "factory@4.0.0-draft.6@g7-math-area-perimeter";
const packageHash = "86066251a231c08dc7a500cd02b72b32eeb5396fefed00c6c83cb459cf2fb254";
const now = Date.parse("2026-10-22T12:00:00Z");
const policy = {
  version: "learning-preview/1.0.0", status: "PILOT_ONLY", enabled: true, revokedAt: null,
  startsAt: "2026-10-22T11:00:00Z", endsAt: "2026-10-22T13:00:00Z", schoolId: "school-test",
  studentUserIds: ["student-test"], classIds: ["class-test"], canonicalRecordWrites: false, offlineDelivery: false,
  lessons: [{ selection, packageHash, revokedAt: null, approvalRecordId: "TEST-ONLY", reviews: { content: "TEST-ONLY", rights: "TEST-ONLY", access: "TEST-ONLY",
    accessibility: "TEST-ONLY", safety: "TEST-ONLY", runtime: "TEST-ONLY", releaseAuthorization: "TEST-ONLY" } }],
};
const user = { id: "student-test", role: "STUDENT", schoolId: "school-test" };

describe("controlled Learning Preview admission", () => {
  it("binds review references and approval record identity into the authorization", () => {
    const parsed = previewPolicySchema.parse(policy);
    const before = pilotApprovalBinding(parsed, selection, packageHash);
    expect(pilotApprovalBinding({ ...parsed, lessons: [{ ...parsed.lessons[0], approvalRecordId: "different" }] }, selection, packageHash)).not.toBe(before);
    expect(pilotApprovalBinding({ ...parsed, lessons: [{ ...parsed.lessons[0], reviews: { ...parsed.lessons[0].reviews, rights: "different" } }] }, selection, packageHash)).not.toBe(before);
  });
  it("decodes exactly one HTTP encoding layer and rejects double encoding or malformed selections", () => {
    expect(parsePreviewSelection(selection)).toBe(selection);
    expect(parsePreviewSelection(encodeURIComponent(selection))).toBe(selection);
    for (const bad of [encodeURIComponent(encodeURIComponent(selection)), selection + " ", "%xy", "factory@latest@x", "factory@4.0.0-draft.6@../x"])
      expect(parsePreviewSelection(bad)).toBeNull();
  });
  it("requires the literal server opt-in and permits Civics eligibility with its own exact entry", () => {
    for (const value of [undefined, "0", "true", "yes"]) expect(isLearningPreviewEnabled({ V4_LEARNING_PREVIEW_ENABLED: value })).toBe(false);
    expect(isLearningPreviewEnabled({ V4_LEARNING_PREVIEW_ENABLED: "1" })).toBe(true);
    const civics = "factory@4.0.0-draft.6@g7-civics-counties-capitals";
    expect(authorizeLearningPreview({ ...policy, lessons: [{ ...policy.lessons[0], selection: civics,
      packageHash: "2a388b30e577b0b11518f7b71772739a03c913fe2840fcd4b7a392eec9b8c5eb" }] }, user, civics, now)?.selection).toBe(civics);
    expect(authorizeLearningPreview({ ...policy, lessons: [{ ...policy.lessons[0], revokedAt: "2026-10-22T11:01:00Z" }] }, user, selection, now)).toBeNull();
    expect(authorizeLearningPreview({ ...policy, lessons: [{ ...policy.lessons[0], packageHash: "0".repeat(64) }] }, user, selection, now)).toBeNull();
  });
  it("holds all six pinned candidates while rejecting any unregistered version or hash",()=>{
    const lessons=Object.entries(CONDITIONALLY_ACCEPTED).map(([key,hash])=>({...policy.lessons[0],selection:`factory@4.0.0-draft.6@${key}`,packageHash:hash}));
    expect(previewPolicySchema.safeParse({...policy,lessons}).success).toBe(true);
    expect(previewPolicySchema.safeParse({...policy,lessons:[...lessons,{...lessons[0],selection:"factory@4.0.0-draft.6@unregistered"}]}).success).toBe(false);
    expect(previewPolicySchema.safeParse({...policy,lessons:[{...lessons[0],packageHash:"0".repeat(64)}]}).success).toBe(false);
  });
  it("requires per-lesson cohorts for multiple classes and binds offline/timetable changes to fresh authorization",()=>{
    expect(previewPolicySchema.safeParse({...policy,classIds:["class-test","class-other"]}).success).toBe(false);
    const parsed=previewPolicySchema.parse({...policy,classIds:["class-test","class-other"],lessons:[{...policy.lessons[0],classIds:["class-test"],timetable:[{classId:"class-test",timetableId:"period-test",subject:"MATH"}]}]});
    const before=pilotApprovalBinding(parsed,selection,packageHash);
    expect(pilotApprovalBinding({...parsed,offlineDelivery:true,offlineMaxAgeSeconds:60},selection,packageHash)).not.toBe(before);
    expect(pilotApprovalBinding({...parsed,lessons:[{...parsed.lessons[0],classIds:["class-other"]}]},selection,packageHash)).not.toBe(before);
    expect(previewPolicySchema.safeParse({...parsed,lessons:[{...parsed.lessons[0],timetable:[{classId:"outside-cohort",timetableId:"period-test",subject:"MATH"}]}]}).success).toBe(false);
  });
  it("requires an explicit exact package and current authenticated school cohort", () => {
    expect(authorizeLearningPreview(policy, user, selection, now)?.packageHash).toBe(packageHash);
    for (const changed of [null, { ...user, id: "other" }, { ...user, schoolId: "other" }, { ...user, role: "TEACHER" }])
      expect(authorizeLearningPreview(policy, changed, selection, now)).toBeNull();
    for (const bad of [selection + " ", selection.toUpperCase(), selection.replace("draft.6", "draft.5"), "../candidate"])
      expect(authorizeLearningPreview(policy, user, bad, now)).toBeNull();
  });
  it("denies disabled, revoked, expired, unbounded, write-enabled and incomplete policies", () => {
    for (const changed of [{ enabled: false }, { revokedAt: "2026-10-22T11:30:00Z" }, { lessons: [] },
      { endsAt: "2026-10-22T12:00:00Z" }, { startsAt: "2026-10-22T12:00:01Z" },
      { endsAt: "2027-01-01T00:00:00Z" }, { canonicalRecordWrites: true }, { offlineDelivery: true },
      { lessons: [{ selection, packageHash, reviews: {} }] }])
      expect(authorizeLearningPreview({ ...policy, ...changed }, user, selection, now)).toBeNull();
    expect(previewPolicySchema.safeParse({ ...policy, lessons: [...policy.lessons, ...policy.lessons] }).success).toBe(false);
  });
});

describe("exact draft.6 loader", () => {
  it.each(Object.keys(CONDITIONALLY_ACCEPTED))("validates the derived pilot contract for %s", key => {
    const source = loadDraft6Review(`factory@4.0.0-draft.6@${key}`).experience;
    expect(source.scenes.some(scene => scene.interaction.kind === "LAB_LAUNCH")).toBe(false);
    expect(() => pilotExperience(source)).not.toThrow();
  });
  it("rejects tampered bytes without a fallback", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ll-draft6-tamper-"));
    try {
      const relative = "curriculum/factory-v4/drafts/4.0.0-draft.6";
      cpSync(relative, path.join(root, relative), { recursive: true });
      const candidate = path.join(root, relative, "g7-math-area-perimeter/candidate.json");
      writeFileSync(candidate, readFileSync(candidate, "utf8").replaceAll("\n", "\r\n"));
      expect(() => loadDraft6Review(selection, root)).toThrow("draft6_review_file_hash:candidate.json");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("replaces assessment with an explicit message and disables evidence, tools and offline packaging", () => {
    const loaded = loadDraft6Review(selection), source = JSON.stringify(loaded.experience);
    const pilot = pilotExperience(loaded.experience);
    expect(JSON.stringify(loaded.experience)).toBe(source);
    expect(pilot.offline.packageable).toBe(false);
    expect(pilot.scenes.every(scene => scene.evidence.kind === "NONE" && scene.interaction.kind !== "ASSESSMENT_HANDOFF")).toBe(true);
    expect(pilot.scenes.some(scene => scene.content.body.includes("No graded assessment is available"))).toBe(true);
    expect(pilot.scenes.every(scene => scene.tools.allowed.length === 0)).toBe(true);
  });
  it("loads all six sealed projections without returning reviewer material", () => {
    const keys = ["g7-math-area-perimeter", "g7-math-fractions", "math-multiplication-models",
      "g7-science-states-of-matter", "g7-civics-counties-capitals", "g7-english-reading-evidence"];
    for (const key of keys) {
      const loaded = loadDraft6Review(`factory@4.0.0-draft.6@${key}`);
      expect(loaded.experience.version).toBe("4.0.0-draft.6");
      expect(loaded.experience.authority.status).toBe("CURRICULUM_V2_DRAFT");
      expect(loaded).not.toHaveProperty("candidate");
      expect(loaded).not.toHaveProperty("academicReview");
    }
  });
  it.each([selection + " ", selection.replace("draft.6", "draft.7"), "factory@4.0.0-draft.6@../x"])("rejects %s", value => {
    expect(() => loadDraft6Review(value)).toThrow();
  });
});
