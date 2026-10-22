import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { V4_LESSONS, loadV4Candidate } from "@/lib/curriculum/v4/candidates";
import { buildVisualSidecar, validateVisualSidecar, validateV4Draft, verifyReferenceInputs, referenceBlueprint,
  assertV4AnswerIsolation, hash, v4GenerationBrief } from "@/lib/content-factory/v4/generation";
import { visualTeachingSidecarSchema } from "@/lib/content-factory/v4/visualTeachingBlock";
import { buildReferenceCandidate, writeImmutableBatch } from "@/lib/content-factory/v4/referenceBatch";
import { blueprintHash, parseBlueprint } from "@/lib/content-factory/v2/blueprint";
import { validateArtifact, artifactHash } from "@/lib/content-factory/v2/quality";
import { specFor } from "@/__tests__/assessment-v2/fixtures";
import { authorLesson } from "@/lib/content-factory/v4/lessonAuthor";

const lesson = V4_LESSONS[0];

describe("V4 factory reference generation", () => {
  it("verifies frozen input bytes and every proposed MOE reference without asserting approval", () => {
    expect(() => verifyReferenceInputs()).not.toThrow();
  });

  it.each(V4_LESSONS)("deterministically packages $key through the existing V2 manager", async current => {
    const first = await buildReferenceCandidate(current), second = await buildReferenceCandidate(current);
    expect(first).toEqual(second);
    expect(first.manifest.academicSchema.valid).toBe(true);
    expect(first.manifest.visualInstruction.valid).toBe(true);
    expect(first.manifest.factoryStatus).toBe("REVISION_REQUIRED");
    expect(first.manifest.releaseBlockers).toContain("ASSESSMENT_ITEMS_PENDING");
    expect(first.manifest.learnerDeliverable).toBe(false);
    expect(first.manifest.protectedAssessment.included).toBe(false);
    const sidecar = visualTeachingSidecarSchema.parse(JSON.parse(first.files["visual-teaching.json"]));
    expect(sidecar.blocks.every(b => b.accessibility.textAlternative && b.accessibility.keyboardPath && b.offline.responsePrompt)).toBe(true);
    expect(sidecar.objectives.flatMap(o => o.standards).every(s => s.mapping === "PROPOSED")).toBe(true);
    expect(sidecar.blocks.flatMap(b => b.sourcePins).every(p => p.rights === "REVIEW_ONLY")).toBe(true);
    const receipt = JSON.parse(first.files["factory-receipt.json"]);
    expect(receipt.events.some((e: { role: string; status: string }) => e.role === "LESSON_AUTHOR" && e.status === "SUCCEEDED")).toBe(true);
  });

  it("rejects altered candidate bytes instead of silently repinning", () => {
    const root = mkdtempSync(path.join(tmpdir(), "v4-pins-"));
    mkdirSync(path.join(root, "curriculum/structured"), { recursive: true });
    writeFileSync(path.join(root, "curriculum/structured/moe-structured-v1.json"), "altered source");
    expect(() => verifyReferenceInputs(root)).toThrow("source_pin_mismatch:curriculum/structured/moe-structured-v1.json");
  });

  it("rejects forged bindings, incomplete accessibility and fabricated release authority", () => {
    const candidate = loadV4Candidate(lesson), sidecar = buildVisualSidecar(lesson, candidate);
    expect(() => validateVisualSidecar({ ...sidecar, candidateSha256: "a".repeat(64) }, lesson, candidate)).toThrow("visual_sidecar_binding_mismatch");
    expect(() => validateVisualSidecar({ ...sidecar, blocks: sidecar.blocks.slice(1) }, lesson, candidate)).toThrow("visual_sidecar_binding_mismatch");
    const invalid = structuredClone(sidecar);
    invalid.blocks[0].accessibility.textAlternative = "";
    expect(visualTeachingSidecarSchema.safeParse(invalid).success).toBe(false);
    expect(visualTeachingSidecarSchema.safeParse({ ...sidecar, approved: true }).success).toBe(false);
    expect(visualTeachingSidecarSchema.safeParse({ ...sidecar, answerKey: "secret" }).success).toBe(false);
  });

  it("rejects lost worked solutions, hints in independent phases and teaching keys in mastery", () => {
    const candidate = structuredClone(loadV4Candidate(lesson));
    const independent = candidate.scenes.find(s => s.teaching?.phase === "PRACTICE_INDEPENDENTLY")!;
    const hinted = { ...candidate, scenes: candidate.scenes.map(s => s.id === independent.id ? { ...s, hints: ["A hint that would contaminate the independent attempt."] } : s) };
    expect(() => validateV4Draft(hinted, lesson)).toThrow(/independent/);
    const noWorked = { ...candidate, scenes: candidate.scenes.map(s => ({ ...s, teaching: s.teaching ? { ...s.teaching, blocks: s.teaching.blocks.filter(b => b.type !== "WORKED_SOLUTION") } : undefined })) };
    expect(() => validateV4Draft(noWorked, lesson)).toThrow(/v4_math_practice_short/);
    const withMasteryKey = { ...candidate, scenes: candidate.scenes.map(s => s.type === "MASTERY_CHECK" ? { ...s, teaching: { ...s.teaching, blocks: [{ type: "EQUATION", tex: "1+1=2" }] } } : s) };
    expect(() => validateV4Draft(withMasteryKey, lesson)).toThrow();
  });

  it("keeps the legacy blueprint contract and requires V4 opt-in", () => {
    const v4 = referenceBlueprint(lesson);
    expect(parseBlueprint(v4).schemaVersion).toBe("unit-blueprint/2.2.0");
    const legacy = { ...v4, schemaVersion: "unit-blueprint/2.1.0" as const };
    expect(() => parseBlueprint({ ...legacy, contentHash: blueprintHash(legacy) })).toThrow("instruction_standard_requires_blueprint_2_2");
    const { instructionStandard: _, ...old } = legacy;
    expect(parseBlueprint({ ...old, contentHash: blueprintHash(old) }).schemaVersion).toBe("unit-blueprint/2.1.0");
  });

  it("runs V4 checks in the core artifact gate, including provider outputs outside the reference runner", () => {
    const blueprint = referenceBlueprint(lesson), candidate = loadV4Candidate(lesson);
    const body = { id: `${lesson.key}-lesson`, version: "4.0.0", payload: { kind: "LESSON" as const, candidate },
      blueprint: { blueprintId: blueprint.blueprintId, version: blueprint.version, contentHash: blueprint.contentHash },
      role: "LESSON_AUTHOR" as const, author: { kind: "AI" as const, agentId: "test", modelFamily: "local", sessionId: "test" }, dependencies: [] };
    expect(validateArtifact(blueprint, { ...body, contentHash: artifactHash(body) })).toEqual([]);
    const changed = { ...body, payload: { ...body.payload, candidate: { ...candidate, instruction: undefined } } };
    expect(validateArtifact(blueprint, { ...changed, contentHash: artifactHash(changed) }).length).toBeGreaterThan(0);
  });

  it("isolates protected assessment material from both teaching and accessibility/offline sidecars", () => {
    const candidate = loadV4Candidate(lesson), sidecar = buildVisualSidecar(lesson, candidate);
    const assessment = { items: [], specs: [specFor("protected", { kind: "SHORT_CONSTRUCTED", acceptedAnswers: ["protected-v4-answer-sentinel"], autoScore: "EXACT_NORMALIZED" })] };
    expect(() => assertV4AnswerIsolation(candidate, sidecar, assessment)).not.toThrow();
    expect(() => assertV4AnswerIsolation({ ...candidate, title: "protected-v4-answer-sentinel" }, sidecar, assessment)).toThrow(/leak_value/);
    const leak = structuredClone(sidecar);
    leak.blocks[0].accessibility.textAlternative = "protected-v4-answer-sentinel";
    expect(() => assertV4AnswerIsolation(candidate, leak, assessment)).toThrow(/leak_value/);
  });

  it("exports subject-fit generation schemas rather than a separate provider or renderer contract", () => {
    const math = v4GenerationBrief({ subject: "MATH", grade: 7 });
    expect(math.blocks.some(b => b.type === "SHAPE_MODEL")).toBe(true);
    expect(math.blocks.some(b => b.type === "READING_PASSAGE")).toBe(false);
    expect(hash(math)).toBe(hash(v4GenerationBrief({ subject: "MATH", grade: 7 })));
  });

  it("recomputes generated arithmetic against independently checked expected quantities", () => {
    const expected: Record<string, number[]> = {
      "g7-math-area-perimeter": [36, 26, 12, 16, 77, 36, 60, 36, 72, 34],
      "g7-math-fractions": [5 / 6, 5 / 6, 7 / 8, 1 / 2, 5 / 12],
      "math-multiplication-models": [92, 80, 128, 136, 114],
    };
    for (const current of V4_LESSONS.filter(l => l.subject === "MATH")) {
      const values = authorLesson(current).scenes.flatMap(s => s.teaching?.blocks ?? []).flatMap(b => b.type === "NUMERIC_RESPONSE" ? b.parts.map(p => p.formativeKey.value) : []);
      expect(values).toHaveLength(expected[current.key].length);
      values.forEach((value, i) => expect(value).toBeCloseTo(expected[current.key][i], 10));
    }
  });

  it("preserves mtimes on rerun and preflights the whole batch before a conflict or path escape", () => {
    const root = mkdtempSync(path.join(tmpdir(), "v4-output-"));
    writeImmutableBatch(root, { "lesson/manifest.json": "draft\n" });
    const file = path.join(root, "lesson/manifest.json"), before = statSync(file).mtimeMs;
    writeImmutableBatch(root, { "lesson/manifest.json": "draft\n" });
    expect(statSync(file).mtimeMs).toBe(before);
    expect(() => writeImmutableBatch(root, { "new.json": "no", "lesson/manifest.json": "changed" })).toThrow("immutable_output_conflict");
    expect(() => readFileSync(path.join(root, "new.json"))).toThrow();
    expect(() => writeImmutableBatch(root, { "../escape.json": "no" })).toThrow("output_path_escape");
    expect(readFileSync(file, "utf8")).toBe("draft\n");
    writeFileSync(path.join(root, "unlisted-assessment.json"), "unlisted file");
    expect(() => writeImmutableBatch(root, { "lesson/manifest.json": "draft\n" })).toThrow("unexpected_existing_output");
  });
});
