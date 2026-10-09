// Curriculum V2: strict candidate parsing (Codex P1-3), canonical objective/ontology resolution (P1-4),
// server-resolved lab links (P1-6) and deterministic validation.
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { composeGrade4MathRelease2026_2 } from "@/lib/learning-authority/releases/grade4Math2026_2";
import { buildAuthoringContext, loadStructuredSource, AuthoringContextError } from "@/lib/curriculum/v2/authoringContext";
import { CandidateRejectedError, parseCandidateLessonV2, AUTHORITY_KEYS, SECRET_KEYS } from "@/lib/curriculum/v2/parse";
import { validateCandidateAgainstContext } from "@/lib/curriculum/v2/validate";
import { assembleCurriculumLessonV2 } from "@/lib/curriculum/v2/assemble";
import { labLinkEligibility, resolveLabProposal, LabProposalError } from "@/lib/curriculum/v2/labs";
import { findLabExperience } from "@/lib/learner-experience/labExperience";
import { g4ProofContext } from "@/lib/curriculum/v2/g4Proof";
import type { CandidateLessonV2 } from "@/lib/curriculum/v2/contract";

const FRACTIONS = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";
const SOLIDS = "moe-math-g4-s2-p6-geometry-and-statistics-obj5";
const raw = (file: string) => readFileSync(`curriculum/v2/g4-math/candidates/${file}`, "utf8");
const fractions = () => JSON.parse(raw("equivalent-fractions.json")) as Record<string, any>;
const generation = { origin: "AUTHORED_FIXTURE" as const, promptKey: null, promptVersion: null, promptHash: null, model: null, generatedAt: "2026-10-08T00:00:00.000Z" };
const rejectCode = (value: unknown) => { try { parseCandidateLessonV2(value); return "PARSED"; } catch (error) { return (error as CandidateRejectedError).code; } };

describe("strict candidate parser (P1-3)", () => {
  it("accepts every G4 proof candidate", () => {
    for (const file of ["place-value.json", "equivalent-fractions.json", "area-perimeter.json", "solid-figures.json", "bar-graphs.json"]) expect(() => parseCandidateLessonV2(raw(file))).not.toThrow();
  });

  it("rejects malformed LLM output", () => {
    expect(rejectCode("{not json")).toBe("candidate_not_json");
    expect(rejectCode("[]")).toBe("candidate_not_object");
    expect(rejectCode("null")).toBe("candidate_not_object");
    expect(rejectCode(`"${"x".repeat(130_000)}"`)).toBe("candidate_too_large");
    expect(rejectCode({ ...fractions(), contractVersion: "candidate-lesson-v1" })).toBe("candidate_schema_invalid");
    expect(rejectCode({ ...fractions(), scenes: [] })).toBe("candidate_schema_invalid");
  });

  it.each(["approved", "released", "mastery", "nextLesson", "teacherOverride", "status", "releaseId", "releaseIdentity", "approvedBy", "approvedAt", "governance", "published", "moeApprovalState", "studentEligible"])("rejects authority-bearing key %s at any depth", (key) => {
    const top = fractions(); top[key] = true;
    expect(rejectCode(top)).toBe("candidate_authority_injection");
    const nested = fractions(); nested.scenes[3].interaction.steps[0][key] = "APPROVED_RELEASE";
    expect(rejectCode(nested)).toBe("candidate_authority_injection");
    const lab = JSON.parse(raw("solid-figures.json")); lab.labProposals[0][key] = "APPROVED";
    expect(rejectCode(lab)).toBe("candidate_authority_injection");
  });

  it.each(["answer", "answerKey", "correctIndex", "rubric", "scoring", "explanationForTeacher", "points", "correct", "teacherNotes", "markScheme"])("rejects assessment secret %s, including nested rubric/scoring", (key) => {
    const item = fractions(); item.scenes[5].interaction.items[0][key] = 1;
    expect(rejectCode(item)).toBe("candidate_secret_field");
    const nested = fractions(); nested.assessmentRequests[0].tools = { requested: [], prohibited: [], hidden: { [key]: "x" } };
    expect(rejectCode(nested)).toBe("candidate_secret_field");
  });

  it("rejects unknown keys, forged enum values, URLs and empty checks", () => {
    const unknown = fractions(); unknown.scenes[0].sneaky = "x";
    expect(rejectCode(unknown)).toBe("candidate_schema_invalid");
    const forgedType = fractions(); forgedType.scenes[0].type = "APPROVED_RELEASE";
    expect(rejectCode(forgedType)).toBe("candidate_schema_invalid");
    const url = fractions(); url.scenes[0].content.body = "See https://example.com/answers";
    expect(rejectCode(url)).toBe("candidate_url_forbidden");
    const empty = fractions(); empty.scenes[5].interaction.items = [];
    expect(rejectCode(empty)).toBe("candidate_schema_invalid");
    const oneStep = fractions(); oneStep.scenes[2].interaction.steps = oneStep.scenes[2].interaction.steps.slice(0, 1);
    expect(rejectCode(oneStep)).toBe("candidate_schema_invalid");
    const longString = fractions(); longString.scenes[0].title = "x".repeat(200);
    expect(rejectCode(longString)).toBe("candidate_schema_invalid");
  });

  it("documents the forbidden vocabularies", () => {
    expect(AUTHORITY_KEYS).toEqual(expect.arrayContaining(["approved", "released", "mastery", "nextLesson", "teacherOverride"]));
    expect(SECRET_KEYS).toEqual(expect.arrayContaining(["answer", "answerKey", "correctIndex", "rubric", "scoring"]));
  });
});

describe("canonical objective / ontology resolution (P1-4)", () => {
  const build = (objectiveIds: string[], overrides: Partial<Parameters<typeof buildAuthoringContext>[0]> = {}) =>
    buildAuthoringContext({ objectiveIds, grade: 4, subject: "MATH", source: loadStructuredSource(), cell: GRADE4_MATH_TEMPLATE_CELL, release: GRADE4_MATH_ONTOLOGY_RELEASE, ...overrides });
  const code = (fn: () => unknown) => { try { fn(); return "OK"; } catch (error) { return (error as AuthoringContextError).code; } };

  it("resolves objective, concept, standard, skill, prerequisite, release and source identity exactly", () => {
    const context = build([FRACTIONS]);
    expect(context.objectives[0]).toMatchObject({ id: FRACTIONS, grade: 4, subject: "MATH", unitId: "g4-math-u3-number-theory-fractions", conceptIds: ["g4-fractions-equivalence"], standardCodes: ["LR-MATH-G4_6-02"], skillIds: ["placement-skill-MATH-G4_6"] });
    expect(context.prerequisiteConceptIds).toEqual(["g4-fractions-equal-parts"]);
    expect(context.release.id).toBe("lr-moe-g4-math-fractions-2026.1");
    expect(context.release.identity).toMatch(/^[a-f0-9]{64}$/);
    expect(context.source.sourceMember).toBe("GRADE-1-6/Math 1-6.pdf");
    expect(context.governedItems.map((item) => item.itemId)).toContain("g4-frac-practice-equivalence");
    expect(JSON.stringify(context.governedItems)).not.toMatch(/correctIndex/);
    expect(context.contextHash).toBe(build([FRACTIONS]).contextHash);
  });

  it("rejects invented, cross-grade, cross-subject, non-objective, low-confidence and title-matched references", () => {
    expect(code(() => build(["moe-math-g4-s1-p3-number-theory-and-fraction-obj99"]))).toBe("objective_unknown");
    expect(code(() => build(["Write equivalent fractions."]))).toBe("objective_unknown");
    const g5 = loadStructuredSource().items.find((item) => item.kind === "OBJECTIVE" && item.grade === 5 && item.subject === "MATH")!;
    expect(code(() => build([g5.id]))).toBe("objective_cross_grade");
    const science = loadStructuredSource().items.find((item) => item.kind === "OBJECTIVE" && item.grade === 4 && item.subject !== "MATH")!;
    expect(code(() => build([science.id]))).toBe("objective_cross_subject");
    expect(code(() => build(["moe-math-g4-s1-p1-numeration-addition-and-subtraction-act1"]))).toBe("objective_not_an_objective");
    expect(code(() => build(["moe-math-g4-s2-p6-geometry-and-statistics-obj7"]))).toBe("objective_not_bindable");
    expect(code(() => build([FRACTIONS, SOLIDS]))).toBe("objectives_span_units");
    expect(code(() => build([]))).toBe("objectives_required");
  });

  it("only pins an executable (published) release in matching scope", () => {
    expect(() => build([FRACTIONS], { release: composeGrade4MathRelease2026_2({ ledger: {} }).release })).toThrow("ontology_release_not_executable");
    expect(code(() => build([FRACTIONS], { grade: 5 }))).toBe("release_scope_mismatch");
  });

  it("records missing concept/standard bindings as explicit gaps, never a fall-back node", () => {
    const context = build([SOLIDS]);
    expect(context.objectives[0].conceptIds).toEqual([]);
    expect(context.objectives[0].standardCodes).toEqual([]);
    expect(context.gaps.map((gap) => gap.code)).toEqual(expect.arrayContaining(["CONCEPT_UNBOUND", "STANDARD_UNBOUND", "SOURCE_CONFIDENCE_MEDIUM"]));
  });

  it("a candidate referencing an objective outside the pinned context is rejected", () => {
    const candidate = fractions(); candidate.scenes[4].objectiveIds = ["moe-math-g4-s1-p3-number-theory-and-fraction-obj6"];
    const result = validateCandidateAgainstContext(parseCandidateLessonV2(candidate), g4ProofContext(FRACTIONS));
    expect(result.errors).toContain(`objective_unknown:rule:moe-math-g4-s1-p3-number-theory-and-fraction-obj6`);
  });
});

describe("deterministic validation and quality gates", () => {
  const context = () => g4ProofContext(FRACTIONS);
  const errorsFor = (mutate: (candidate: Record<string, any>) => void) => { const candidate = fractions(); mutate(candidate); return validateCandidateAgainstContext(parseCandidateLessonV2(candidate), context()).errors; };

  it("passes the fractions candidate with no errors", () => {
    expect(validateCandidateAgainstContext(parseCandidateLessonV2(fractions()), context()).errors).toEqual([]);
  });

  it.each([
    ["duplicate nested ids", (c: any) => { c.scenes[6].interaction.prompts[0].id = "equal-to-third"; c.scenes[6].evidence.responses[0].responseKey = "equal-to-third"; }, "duplicate_id"],
    ["impossible dependency", (c: any) => { c.scenes[2].dependsOn = ["practice"]; }, "dependency_not_earlier"],
    ["unknown dependency", (c: any) => { c.scenes[2].dependsOn = ["ghost"]; }, "dependency_unknown"],
    ["intro not first", (c: any) => { c.scenes.push(c.scenes.shift()); }, "intro_not_first"],
    ["mastery before learning", (c: any) => { const mastery = c.scenes.pop(); c.scenes.splice(2, 0, mastery); }, "mastery_before_learning"],
    ["unknown tool", (c: any) => { c.scenes[2].tools.requested = ["laser-cutter"]; }, "tool_unknown"],
    ["tool conflict", (c: any) => { c.scenes[2].tools.prohibited = ["fraction-visualizer"]; }, "tool_conflict"],
    ["insufficient text alternative", (c: any) => { c.scenes[4].accessibility.textAlternative = "The multiplying rule"; }, "text_alternative_insufficient"],
    ["offline fallback missing", (c: any) => { c.scenes[4].offline.mode = "ONLINE_ENHANCED"; }, "offline_fallback_missing"],
    ["unsupported interaction with no fallback", (c: any) => { c.scenes[6].interaction = { kind: "NUMERIC", prompt: "Enter it", elements: ["a"] }; c.scenes[6].completion = "VIEWED"; c.scenes[6].evidence = { kind: "NONE" }; }, "unsupported_interaction_without_fallback"],
    ["formative key outside a formative scene", (c: any) => { c.scenes[5].type = "EXPLANATION"; }, "formative_key_outside_formative_scene"],
    ["mastery without assessment handoff", (c: any) => { c.scenes[8].interaction = { kind: "NONE" }; c.scenes[8].completion = "VIEWED"; }, "mastery_requires_assessment_handoff"],
    ["mastery evidence outside the assessment seam", (c: any) => { c.scenes[7].evidence.kind = "MASTERY_RESPONSE"; }, "mastery_evidence_requires_assessment_handoff"],
    ["response not mapped to evidence", (c: any) => { c.scenes[6].evidence.responses.pop(); }, "evidence_response_unmapped"],
    ["evidence objective outside the scene", (c: any) => { c.scenes[6].evidence.responses[0].objectiveId = "moe-math-g4-s1-p3-number-theory-and-fraction-obj6"; }, "evidence_objective_not_in_scene"],
    ["formative key not an option", (c: any) => { c.scenes[5].interaction.items[0].formativeKey.expectedOptionId = "z"; }, "formative_key_unknown_option"],
    ["oversized age variant", (c: any) => { c.scenes[4].content.ageVariants = { EARLY_PRIMARY: { body: "word ".repeat(400) } }; }, "age_variant_too_long"],
    ["giant scene", (c: any) => { c.scenes[4].content.body = "word ".repeat(400); }, "scene_too_long"],
    ["completion that does not match the interaction", (c: any) => { c.scenes[2].completion = "VIEWED"; }, "completion_mismatch"],
    ["all-explanation lesson", (c: any) => { c.scenes = c.scenes.filter((s: any) => ["INTRO", "OBJECTIVE", "EXPLANATION"].includes(s.type)); c.assessmentRequests = []; }, "all_explanation_lesson"],
    ["unused assessment request", (c: any) => { c.assessmentRequests.push({ ...c.assessmentRequests[0], id: "spare" }); }, "assessment_request_unused"],
  ])("rejects %s", (_name, mutate, expected) => {
    expect(errorsFor(mutate as any).some((error) => error.startsWith(expected as string))).toBe(true);
  });

  it("keeps declared-but-unsupported interactions visible to reviewers instead of flattening them", () => {
    const outcome = assembleCurriculumLessonV2({ candidate: parseCandidateLessonV2(raw("area-perimeter.json")), context: g4ProofContext("moe-math-g4-s2-p5-measurement-obj9"), generation });
    if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
    expect(outcome.lesson.scenes.find((scene) => scene.id === "calculate")!.interaction.kind).toBe("NUMERIC");
    expect(outcome.lesson.reviewGaps).toEqual(expect.arrayContaining([expect.objectContaining({ code: "UNSUPPORTED_INTERACTION_DECLARED", sceneId: "calculate" })]));
  });
});

describe("server-resolved lab links (P1-6)", () => {
  const solids = () => parseCandidateLessonV2(raw("solid-figures.json"));
  const context = () => g4ProofContext(SOLIDS);
  const resolve = (proposal: Partial<CandidateLessonV2["labProposals"][number]>) => {
    const candidate = solids();
    return resolveLabProposal({ proposal: { ...candidate.labProposals[0], ...proposal }, scenes: candidate.scenes, lesson: { lessonId: "cv2-test", version: "0.1.0" }, context: context() });
  };
  const code = (fn: () => unknown) => { try { fn(); return "OK"; } catch (error) { return (error as LabProposalError).code; } };

  it("resolves the real lab, version and checks from the registry and stays CANDIDATE and ineligible", () => {
    const resolved = resolve({});
    expect(resolved.link.status).toBe("CANDIDATE");
    expect(resolved.link.authority).toEqual(expect.objectContaining({ approvedBy: null, approvedAt: null }));
    expect(resolved.link.experience).toEqual({ kind: "INTERACTIVE_LAB", labId: "g4-solid-figures", labVersion: findLabExperience("g4-solid-figures")!.version });
    expect(resolved.link.evidenceMapping.map((mapping) => mapping.labCheckId)).toEqual(["no-flat-faces", "cube-vertices"]);
    expect(resolved.link.evidenceMapping.every((mapping) => mapping.disposition === "RAW_OBSERVATION")).toBe(true);
    expect(resolved.eligibility.studentEligible).toBe(false);
    expect(resolved.eligibility.reasons).toEqual(expect.arrayContaining(["LINK_CANDIDATE", "LESSON_NOT_APPROVED"]));
    expect(resolved.eligibility.reasons.some((reason) => reason.startsWith("LAB_NOT_RELEASED"))).toBe(true);
  });

  it("rejects unknown labs, invented checks, objectives the lab does not claim and bad placement", () => {
    expect(code(() => resolve({ labId: "g4-solid-shapes-pro" }))).toBe("lab_unknown");
    expect(code(() => resolve({ checkIds: ["teleport-cube"] }))).toBe("lab_check_unknown");
    expect(code(() => resolve({ labId: "mount-coffee-hydropower", checkIds: [] }))).toBe("lab_objective_not_supported_by_lab");
    expect(code(() => resolve({ objectiveId: FRACTIONS }))).toBe("lab_objective_not_in_lesson");
    expect(code(() => resolve({ placementSceneId: "check" }))).toBe("lab_placement_invalid");
  });

  it("student eligibility accounts for governed context: draft/withdrawn labs, wrong grade, version and approval", () => {
    const link = resolve({}).link;
    const solidsLab = findLabExperience("g4-solid-figures")!;
    const released = { ...solidsLab, release: { ...solidsLab.release, status: "RELEASED" as const } };
    const approved = { ...link, status: "APPROVED" as const };
    expect(labLinkEligibility({ link: approved, lab: released, learnerGrade: 4, lessonApproved: true }).studentEligible).toBe(true);
    expect(labLinkEligibility({ link: approved, lab: solidsLab, learnerGrade: 4, lessonApproved: true }).studentEligible).toBe(false);
    expect(labLinkEligibility({ link: approved, lab: released, learnerGrade: 9, lessonApproved: true }).reasons).toContain("LAB_GRADE_INCOMPATIBLE");
    expect(labLinkEligibility({ link: approved, lab: { ...released, version: "9.9.9" }, learnerGrade: 4, lessonApproved: true }).reasons).toContain("LAB_VERSION_MISMATCH");
    expect(labLinkEligibility({ link: approved, lab: null, learnerGrade: 4, lessonApproved: true }).reasons).toContain("LAB_UNKNOWN");
    const hydro = findLabExperience("mount-coffee-hydropower")!;
    expect(hydro.release.status).toBe("DRAFT_UNRELEASED");
    expect(labLinkEligibility({ link: { ...approved, experience: { kind: "INTERACTIVE_LAB", labId: hydro.labId, labVersion: hydro.version } }, lab: hydro, learnerGrade: 8, lessonApproved: true }).studentEligible).toBe(false);
  });

  it("an unresolvable lab proposal rejects the whole artifact", () => {
    const candidate = JSON.parse(raw("solid-figures.json")); candidate.labProposals[0].checkIds = ["invented-check"];
    const outcome = assembleCurriculumLessonV2({ candidate: parseCandidateLessonV2(candidate), context: context(), generation });
    expect(outcome.status).toBe("REJECTED");
  });
});

describe("PR #176 review P2s: governed delivery attributes and lab evidence", () => {
  it("rejects a candidate whose age band disagrees with the grade-derived context (P2-2)", () => {
    const candidate = fractions();
    candidate.ageBand = "SENIOR_SECONDARY";
    expect(validateCandidateAgainstContext(parseCandidateLessonV2(candidate), g4ProofContext(FRACTIONS)).errors).toContain("age_band_mismatch:SENIOR_SECONDARY");
    const outcome = assembleCurriculumLessonV2({ candidate: parseCandidateLessonV2(candidate), context: g4ProofContext(FRACTIONS), generation });
    expect(outcome.status).toBe("REJECTED");
  });

  it("an accepted lesson carries the context age band, never the candidate's (P2-2)", () => {
    const outcome = assembleCurriculumLessonV2({ candidate: parseCandidateLessonV2(raw("equivalent-fractions.json")), context: g4ProofContext(FRACTIONS), generation });
    if (outcome.status === "REJECTED") throw new Error(outcome.errors.join());
    expect(outcome.lesson.ageBand).toBe(g4ProofContext(FRACTIONS).ageBand);
  });

  it("a lab scene counts as evidence only when it declares LAB_OBSERVATION (P2-3)", () => {
    const solids = JSON.parse(raw("solid-figures.json")) as Record<string, any>;
    const lab = solids.scenes.find((scene: any) => scene.interaction.kind === "LAB_LAUNCH");
    expect(validateCandidateAgainstContext(parseCandidateLessonV2(solids), g4ProofContext(SOLIDS)).errors).toEqual([]);
    lab.evidence.kind = "REFLECTION";
    expect(validateCandidateAgainstContext(parseCandidateLessonV2(solids), g4ProofContext(SOLIDS)).errors).toContain(`evidence_not_collectable:${lab.id}`);
  });
});

describe("PR #176 merge gate: duplicate scene objective ids", () => {
  it("rejects a scene that lists the same objective twice", () => {
    const candidate = fractions();
    const scene = candidate.scenes.find((entry: any) => entry.objectiveIds.length > 0);
    scene.objectiveIds = [scene.objectiveIds[0], scene.objectiveIds[0]];
    expect(validateCandidateAgainstContext(parseCandidateLessonV2(candidate), g4ProofContext(FRACTIONS)).errors).toContain(`objective_duplicate:${scene.id}`);
  });
});
