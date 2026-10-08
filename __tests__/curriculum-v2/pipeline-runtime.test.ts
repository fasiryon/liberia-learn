// Curriculum V2: generation pipeline, Lesson Player V2 compatibility, migration provenance, tools,
// native learner secrecy and the committed G4 review package.
import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { getPrompt } from "@/lib/ai/promptRegistry";
import { curriculumV2LessonArchive, curriculumV2PromptHash } from "@/lib/ai/prompts/archive/curriculum.v2.lesson/1.0.0";
import { buildGenerationBrief, generateCurriculumLessonV2 } from "@/lib/curriculum/v2/pipeline";
import { G4_PROOF_SAMPLE, g4ProofContext, runG4Proof } from "@/lib/curriculum/v2/g4Proof";
import { buildG4ProofPackageFiles, G4_PROOF_PACKAGE_DIR, G4_MIGRATION_DEMO_CONTENT_ID } from "@/lib/curriculum/v2/g4ProofPackage";
import { toLessonExperience, lessonLinks } from "@/lib/curriculum/v2/compat";
import { migrateDraftLesson } from "@/lib/curriculum/v2/migrate";
import { canonicalToolIds, resolveToolAvailability } from "@/lib/curriculum/v2/tools";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";
import { KNOWN_TOOL_IDS, resolveLessonScenes, validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { validateExperienceLink } from "@/lib/learner-experience/links";
import { findLabExperience } from "@/lib/learner-experience/labExperience";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import type { CurriculumLessonV2 } from "@/lib/curriculum/v2/contract";

const FRACTIONS = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";
const fixture = (file: string) => readFileSync(`curriculum/v2/g4-math/candidates/${file}`, "utf8");
const lessonFor = (file: string, objectiveId: string): CurriculumLessonV2 => {
  const outcome = runG4Proof(file, objectiveId);
  if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
  return outcome.lesson;
};

describe("generation pipeline: AI proposes, the server validates and governs", () => {
  const complete = (content: string) => vi.fn().mockResolvedValue({ content, model: "test-model" });

  it("builds the request from the governed prompt registry and a trusted brief", async () => {
    const call = complete(fixture("equivalent-fractions.json"));
    const outcome = await generateCurriculumLessonV2({ context: g4ProofContext(FRACTIONS), complete: call, now: () => new Date("2026-10-08T00:00:00.000Z") });
    const options = call.mock.calls[0][0];
    expect(options.messages[0].content).toBe(getPrompt(curriculumV2LessonArchive.systemKey).template);
    expect(options.messages[1].content).toContain(FRACTIONS);
    expect(options.responseFormat).toBe("json");
    expect(options.aiUsage).toMatchObject({ feature: "curriculum", promptKey: "curriculum.v2.lesson", promptHash: curriculumV2PromptHash });
    expect(outcome.status).toBe("READY_FOR_HUMAN_REVIEW");
    if (outcome.status === "REJECTED") return;
    expect(outcome.lesson.provenance).toMatchObject({ origin: "AI_GENERATED", promptKey: "curriculum.v2.lesson", promptVersion: "1.0.0", promptHash: curriculumV2PromptHash, model: "test-model" });
    expect(outcome.lesson.governance).toEqual({ state: "DRAFT", humanReviewRequired: true, published: false, moeApprovalState: "NOT_CLAIMED", requiredApprovalBasis: "HUMAN_REVIEW" });
  });

  it.each([
    ["non-JSON output", "Here is your lesson!"],
    ["authority injection", JSON.stringify({ ...JSON.parse(fixture("equivalent-fractions.json")), approved: true, releaseId: "lr-moe-g4-math-fractions-2026.1" })],
    ["leaked answer key", JSON.stringify({ ...JSON.parse(fixture("equivalent-fractions.json")), answerKey: { q1: "b" } })],
    ["invented objective", fixture("equivalent-fractions.json").replaceAll(FRACTIONS, "moe-math-g4-s1-p3-number-theory-and-fraction-obj42")],
    ["objective from another grade", fixture("equivalent-fractions.json").replaceAll(FRACTIONS, "moe-math-g5-s1-p1-whole-numbers-obj1")],
  ])("rejects %s", async (_name, content) => {
    const outcome = await generateCurriculumLessonV2({ context: g4ProofContext(FRACTIONS), complete: complete(content) });
    expect(outcome.status).toBe("REJECTED");
  });

  it("the brief carries only governed facts: context objectives, grade tools and labs that claim the objective", () => {
    const brief = buildGenerationBrief(g4ProofContext("moe-math-g4-s2-p6-geometry-and-statistics-obj5")) as any;
    expect(brief.objectives.map((objective: any) => objective.id)).toEqual(["moe-math-g4-s2-p6-geometry-and-statistics-obj5"]);
    expect(brief.labs).toEqual([{ labId: "g4-solid-figures", objectiveIds: ["moe-math-g4-s2-p6-geometry-and-statistics-obj5"], released: false }]);
    expect(brief.labs.some((lab: any) => lab.labId === "mount-coffee-hydropower")).toBe(false);
    expect(brief.tools.every((tool: string) => canonicalToolIds().includes(tool))).toBe(true);
  });

  it("the generation pipeline has no persistence or approval dependency", () => {
    expect(readFileSync("lib/curriculum/v2/pipeline.ts", "utf8")).not.toMatch(/prisma|@\/lib\/db|governance|mutations/);
  });
});

describe("Lesson Player V2 compatibility", () => {
  it.each(G4_PROOF_SAMPLE.map((entry) => [entry.strand, entry.file, entry.objectiveId]))("%s artifact plays as a native Phase A experience", (_strand, file, objectiveId) => {
    const lesson = lessonFor(file as string, objectiveId as string);
    const experience = toLessonExperience(lesson);
    expect(() => validateLessonExperience(experience)).not.toThrow();
    expect(resolveLessonScenes({ title: experience.title, native: experience }).source).toBe("NATIVE_SCENES");
    expect(experience.authority.status).toBe("CURRICULUM_V2_DRAFT");
    expect(experience.authority.releaseIdentity).toBe(lesson.authoring.releaseIdentity);
    for (const link of lessonLinks(lesson)) expect(() => validateExperienceLink(link, experience, findLabExperience(link.experience.labId)!)).not.toThrow();
  });

  it("delivers unsupported interactions through their declared fallback, never as fake multiple choice", () => {
    const experience = toLessonExperience(lessonFor("area-perimeter.json", "moe-math-g4-s2-p5-measurement-obj9"));
    const calculate = experience.scenes.find((scene) => scene.id === "calculate")!;
    // NUMERIC has no renderer: learners get the declared FREE_RESPONSE fallback as a real input, not a fake choice.
    expect(calculate.interaction.kind).toBe("FREE_RESPONSE");
    expect(calculate.interaction.kind === "FREE_RESPONSE" && calculate.interaction.prompts[0].prompt).toContain("Write the perimeter and the area");
  });

  it("mastery scenes carry governed item refs with no key; unbound objectives carry none", () => {
    const fractions = toLessonExperience(lessonFor("equivalent-fractions.json", FRACTIONS));
    const mastery = fractions.scenes.find((scene) => scene.type === "MASTERY_CHECK")!;
    expect(mastery.interaction.kind === "ASSESSMENT_HANDOFF" && mastery.interaction.assessment.items.map((item) => item.itemId)).toEqual(["g4-frac-practice-equivalence"]);
    expect(JSON.stringify(mastery)).not.toMatch(/correctIndex|"answer"|answerKey/);
  });
});

describe("native learner payloads stay secret-free (P1-2 for Curriculum V2)", () => {
  it("projects only the Lesson Player V2 experience", () => {
    const lesson = lessonFor("solid-figures.json", "moe-math-g4-s2-p6-geometry-and-statistics-obj5");
    const projected = projectStudentLessonPayload({ title: lesson.identity.title, curriculumV2: lesson, teacherNotes: "SECRET", answerKey: "SECRET" });
    const json = JSON.stringify(projected);
    expect(projected.studentReady).toBe(true);
    for (const forbidden of ["SECRET", "expectedObservation", "misconception", "provenance", "governance", "reviewGaps", "formativeKey", "rationale", "candidateSha256", "contextHash"]) expect(json).not.toContain(forbidden);
    expect(json).not.toContain(lesson.scenes.find((scene) => scene.id === "lab")!.expectedObservation!);
  });

  it("a malformed native payload fails closed instead of falling back to legacy fields", () => {
    const projected = projectStudentLessonPayload({ curriculumV2: { contractVersion: "broken" }, body: "legacy body with answers" });
    expect(projected.studentReady).toBe(false);
    expect(JSON.stringify(projected)).not.toContain("legacy body");
  });
});

describe("migration preserves provenance and never infers authority (P2-3, P2-4)", () => {
  const draft = GRADE4_MATH_DRAFT_LESSONS.find((lesson) => lesson.contentId === G4_MIGRATION_DEMO_CONTENT_ID)!;

  it("records source hash, adapter version, section map and omissions; moves no answers into scenes", () => {
    const { candidate, migration } = migrateDraftLesson(draft, g4ProofContext(draft.moeObjectiveId));
    expect(migration.sourceContentId).toBe(draft.contentId);
    expect(migration.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(migration.adapterVersion).toBe("g4-math-draft-to-v2/1.0.0");
    expect(migration.sectionMap.length).toBeGreaterThan(3);
    expect(migration.omissions.join(" ")).toMatch(/answer/);
    expect(candidate.labProposals).toEqual([]);
    const scenesJson = JSON.stringify(candidate.scenes.filter((scene) => scene.type !== "CHECK_UNDERSTANDING"));
    for (const problem of [...draft.payload.practice, ...draft.payload.homework]) expect(scenesJson).not.toContain(`"${problem.answer}"`);
    expect(scenesJson).not.toContain(draft.payload.teacherNotes.slice(0, 40));
    expect(new Set(candidate.scenes.flatMap((scene) => scene.objectiveIds))).toEqual(new Set([draft.moeObjectiveId]));
  });

  it("refuses to migrate against an objective the source does not declare", () => {
    expect(() => migrateDraftLesson(draft, g4ProofContext(FRACTIONS))).toThrow("migration_objective_not_declared_by_source");
  });
});

describe("tool permissions over the canonical toolkit registry (P2-8, P2-9)", () => {
  it("Phase A's tool list matches the canonical registry", () => {
    expect([...KNOWN_TOOL_IDS].sort()).toEqual(canonicalToolIds().sort());
  });

  it("availability intersects grade context, flags, assessment policy and accommodations", () => {
    const base = { grade: 4, subject: "MATH", lessonType: "lesson" as const, prohibited: [] as string[] };
    expect(resolveToolAvailability({ ...base, toolId: "fraction-visualizer", enabledCategories: [] }).reasons).toContain("SWITCHED_OFF_BY_SERVER_FLAGS");
    expect(resolveToolAvailability({ ...base, toolId: "protractor", enabledCategories: [] }).reasons).toContain("NOT_OFFERED_FOR_GRADE_OR_SUBJECT");
    expect(resolveToolAvailability({ ...base, toolId: "protractor", enabledCategories: [], accommodations: ["protractor"] }).reasons).not.toContain("NOT_OFFERED_FOR_GRADE_OR_SUBJECT");
    expect(resolveToolAvailability({ ...base, toolId: "basic-calculator", lessonType: "assessment", enabledCategories: [], prohibited: ["basic-calculator"], accommodations: ["basic-calculator"] }).reasons).toContain("PROHIBITED_BY_POLICY");
    expect(resolveToolAvailability({ ...base, toolId: "laser-cutter", enabledCategories: [] }).reasons).toEqual(["TOOL_UNKNOWN"]);
  });
});

describe("G4 vertical proof", () => {
  it("covers five materially different strands and keeps every artifact a DRAFT", () => {
    expect(G4_PROOF_SAMPLE.map((entry) => entry.strand)).toHaveLength(5);
    const structures = new Set<string>();
    for (const entry of G4_PROOF_SAMPLE) {
      const lesson = lessonFor(entry.file, entry.objectiveId);
      expect(lesson.governance.state).toBe("DRAFT");
      expect(lesson.governance.published).toBe(false);
      structures.add(lesson.scenes.map((scene) => scene.type).join(">"));
    }
    expect(structures.size).toBe(5);
  });

  it("the committed review package matches a fresh build", () => {
    for (const [name, text] of buildG4ProofPackageFiles()) {
      const file = path.join(G4_PROOF_PACKAGE_DIR, name);
      expect(existsSync(file), `${name} missing: run npx tsx scripts/build-curriculum-v2-g4-proof.ts`).toBe(true);
      expect(readFileSync(file, "utf8"), `${name} is stale: run npx tsx scripts/build-curriculum-v2-g4-proof.ts`).toBe(text);
    }
  });
});
