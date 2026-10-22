// Interactive Learning V4: the Visual Teaching Block Registry, the V4 instructional standard and the
// candidate-lesson-v2/1.1.0 contract (parser, validator, generation brief and pipeline guard).
import { describe, expect, it, vi } from "vitest";
import { AUTHORITY_KEYS, SECRET_KEYS, parseCandidateLessonV2, CandidateRejectedError } from "@/lib/curriculum/v2/parse";
import { buildV4GenerationBrief, generateCurriculumLessonV2 } from "@/lib/curriculum/v2/pipeline";
import { validateCandidateAgainstContext } from "@/lib/curriculum/v2/validate";
import { evaluateV4Standard } from "@/lib/curriculum/v4/standard";
import { candidateText, findV4Lesson } from "@/lib/curriculum/v4/candidates";
import { g4ProofContext } from "@/lib/curriculum/v2/g4Proof";
import { ageBandForGrade } from "@/lib/curriculum/v2/authoringContext";
import { BLOCK_SCHEMAS, BLOCK_TYPES, TEACHING_BLOCK_REGISTRY, blockTextAlternative, generationCatalogue, subjectFamily, validateBlock, type VisualBlock } from "@/lib/learner-experience/teaching/registry";
import { z } from "zod";

const geometry = () => JSON.parse(candidateText(findV4Lesson("g7-math-area-perimeter")!));
const lesson = findV4Lesson("g7-math-area-perimeter")!;
const context = { grade: 7, subject: "MATH", ageBand: ageBandForGrade(7), objectives: lesson.objectives };
const sceneOf = (candidate: { scenes: { id: string }[] }, id: string) => candidate.scenes.find((scene) => scene.id === id) as any;
const errorsFor = (candidate: unknown) => validateCandidateAgainstContext(parseCandidateLessonV2(candidate), context).errors;

describe("Visual Teaching Block Registry", () => {
  it("every block is formative only, works offline and has a schema, a label and a learner-time estimate", () => {
    for (const type of BLOCK_TYPES) {
      const entry = TEACHING_BLOCK_REGISTRY[type];
      expect(entry.type).toBe(type);
      expect(entry.assessment).toBe("FORMATIVE_ONLY");
      expect(entry.offline).toBe("FULL");
      expect(entry.minInlineSize).toBeLessThanOrEqual(300);
      expect(BLOCK_SCHEMAS[type]).toBeDefined();
    }
  });

  it("no block schema has a key the strict candidate parser treats as authority or as an assessment secret", () => {
    const forbidden = new Set([...AUTHORITY_KEYS, ...SECRET_KEYS].map((key) => key.toLowerCase()));
    const keys = (schema: unknown): string[] => {
      if (!schema || typeof schema !== "object") return [];
      const record = schema as Record<string, unknown>;
      return [...Object.keys((record.properties as object) ?? {}), ...Object.values(record).flatMap(keys)];
    };
    for (const type of BLOCK_TYPES) for (const key of keys(z.toJSONSchema(BLOCK_SCHEMAS[type]))) expect(forbidden.has(key.toLowerCase()), `${type}.${key}`).toBe(false);
  });

  it("rejects unregistered types and inconsistent models", () => {
    expect(validateBlock({ type: "DECORATIVE_IMAGE", src: "x" }).problems[0]).toMatch(/^block_type_unsupported/);
    expect(validateBlock({ type: "FRACTION_COMPARE", id: "c", a: { numerator: 1, denominator: 8 }, b: { numerator: 1, denominator: 4 }, prompt: "Which?", formativeKey: { relation: ">" } }).problems).toContain("fraction_compare_key_wrong:c");
    expect(validateBlock({ type: "NUMERIC_RESPONSE", id: "n", mode: "INDEPENDENT", prompt: "Find it.", shape: { kind: "RECTANGLE", length: 8, width: 6, unit: "m" }, parts: [{ id: "a", label: "Area", quantity: "AREA", unit: { kind: "AREA", base: "m" }, formativeKey: { value: 46 }, misconceptions: [] }], hints: ["Multiply."], afterAttempt: ["8 × 6"] }).problems)
      .toEqual(expect.arrayContaining(["independent_problem_has_hints:n", "numeric_key_disagrees_with_shape_area:n"]));
    expect(validateBlock({ type: "SHAPE_MODEL", id: "t", shape: { kind: "TRIANGLE", base: 8, height: 3, apexOffset: 4, unit: "m", sideLabels: [6, 5] }, views: [], explore: false, caption: "A triangle." }).problems).toContain("triangle_side_labels_inconsistent:t");
    expect(validateBlock({ type: "SOURCE_EVIDENCE", id: "s", source: { title: "T", kind: "PASSAGE", origin: { kind: "ORIGINAL_FOR_LIBERIALEARN", license: "L", attribution: "A" } }, question: "Q?", sentences: [{ id: "a", text: "x", supports: true, why: "w" }, { id: "b", text: "y", supports: true, why: "w" }, { id: "c", text: "z", supports: true, why: "w" }], minSelect: 2 }).problems).toContain("evidence_requires_distractors:s");
  });

  it("checks subject and grade fit", () => {
    const particle = { type: "PARTICLE_MODEL", id: "p", substance: "WATER", startC: 20, minC: -10, maxC: 120, caption: "Water." };
    expect(validateBlock(particle, { subject: "SCIENCE", grade: 7 }).problems).toEqual([]);
    expect(validateBlock(particle, { subject: "MATH", grade: 7 }).problems).toContain("block_subject_unfit:PARTICLE_MODEL:MATH");
    expect(validateBlock(particle, { subject: "SCIENCE", grade: 1 }).problems).toContain("block_grade_unfit:PARTICLE_MODEL:1");
    expect(subjectFamily("CIVICS")).toBe("HUMANITIES");
    expect(subjectFamily("LITERACY")).toBe("LANGUAGE");
  });

  it("the generation catalogue offers only blocks that fit the subject and grade", () => {
    const science = generationCatalogue({ subject: "SCIENCE", grade: 7 }).map((entry) => entry.type);
    expect(science).toContain("PARTICLE_MODEL");
    expect(science).not.toContain("FRACTION_MODEL");
    expect(generationCatalogue({ subject: "ENGLISH", grade: 7 }).map((entry) => entry.type)).toEqual(expect.arrayContaining(["READING_PASSAGE", "SENTENCE_BUILDER", "WRITING_ORGANIZER"]));
  });

  it("text alternatives never reveal a formative key", () => {
    const block = validateBlock({ type: "NUMERIC_RESPONSE", id: "n", mode: "INDEPENDENT", prompt: "A plot is 25 m by 16 m.", shape: { kind: "RECTANGLE", length: 25, width: 16, unit: "m" }, parts: [{ id: "a", label: "Area", quantity: "AREA", unit: { kind: "AREA", base: "m" }, formativeKey: { value: 400 }, misconceptions: [] }], hints: [], afterAttempt: ["25 × 16 = 400"] }).block as VisualBlock;
    expect(blockTextAlternative(block)).not.toContain("400");
  });
});

describe("candidate-lesson-v2/1.1.0", () => {
  it("1.0.0 candidates may not carry V4 fields, and 1.1.0 must declare the instruction plan", () => {
    const v4 = geometry();
    expect(() => parseCandidateLessonV2({ ...v4, contractVersion: "candidate-lesson-v2/1.0.0" })).toThrow(CandidateRejectedError);
    const { instruction: _instruction, ...noPlan } = v4;
    expect(() => parseCandidateLessonV2(noPlan)).toThrow(/candidate_v4_instruction_required/);
  });

  it("rejects an unregistered block or an answer key smuggled into a block", () => {
    const bad = geometry();
    sceneOf(bad, "see-it").teaching.blocks.push({ type: "STOCK_PHOTO", alt: "A field" });
    expect(() => parseCandidateLessonV2(bad)).toThrow(/candidate_block_invalid/);
    const leak = geometry();
    sceneOf(leak, "alone-rice-farm").teaching.blocks[0].parts[0].correctAnswer = 400;
    expect(() => parseCandidateLessonV2(leak)).toThrow(/candidate_secret_field/);
  });

  it("independent phases may not contain worked solutions, guided problems or hints", () => {
    const worked = geometry();
    sceneOf(worked, "alone-rice-farm").teaching.blocks.push(sceneOf(geometry(), "watch-field").teaching.blocks[0]);
    sceneOf(worked, "watch-field").teaching.blocks = [{ type: "EQUATION", tex: "A = l \\times w" }];
    expect(errorsFor(worked)).toContain("v4_support_in_independent_phase:alone-rice-farm");
    const hinted = geometry();
    sceneOf(hinted, "apply-school-grounds").hints = ["Split the L-shape."];
    expect(errorsFor(hinted)).toContain("v4_hints_in_independent_phase:apply-school-grounds");
  });

  it("mastery stays with Assessment Player V2: no teaching blocks on a mastery scene", () => {
    const bad = geometry();
    sceneOf(bad, "show-what-you-know").teaching.blocks = [{ type: "EQUATION", tex: "A = l \\times w" }];
    expect(errorsFor(bad)).toContain("v4_blocks_in_mastery:show-what-you-know");
  });

  it("a lesson that is mostly text fails the standard", () => {
    const candidate = parseCandidateLessonV2(geometry());
    const textOnly = { ...candidate, scenes: candidate.scenes.map((scene) => (scene.teaching && scene.teaching.phase !== "ASSESS" ? { ...scene, teaching: { phase: scene.teaching.phase, blocks: [] } } : scene)) };
    const codes = evaluateV4Standard(textOnly, context).problems.map((problem) => problem.code);
    expect(codes).toEqual(expect.arrayContaining(["v4_text_only_scene", "v4_math_practice_short"]));
  });

  it("a declared misconception that nothing diagnoses is a blocking gap", () => {
    const candidate = geometry();
    candidate.misconceptions.push({ id: "m-unused", objectiveId: "ll-g7-math-ap-rectangles", description: "Unused.", response: "None." });
    const gaps = validateCandidateAgainstContext(parseCandidateLessonV2(candidate), context).gaps.map((gap) => gap.code);
    expect(gaps).toEqual(expect.arrayContaining(["V4_MISCONCEPTION_NOT_TAUGHT", "V4_MISCONCEPTION_NOT_DIAGNOSABLE"]));
  });
});

describe("generation uses the V4 standard by default", () => {
  const FRACTIONS = "moe-math-g4-s1-p3-number-theory-and-fraction-obj5";

  it("the brief carries the subject pattern, the block catalogue and the limits", () => {
    const brief = buildV4GenerationBrief(g4ProofContext(FRACTIONS)) as any;
    expect(brief.candidateContract).toBe("candidate-lesson-v2/1.1.0");
    expect(brief.pattern.map((entry: { phase: string }) => entry.phase)).toEqual(["VISUALIZE", "DEMONSTRATE", "SOLVE_WITH_SUPPORT", "PRACTICE_INDEPENDENTLY", "ANALYZE_MISTAKE", "APPLY"]);
    expect(brief.blocks.map((entry: { type: string }) => entry.type)).toEqual(expect.arrayContaining(["FRACTION_MODEL", "NUMERIC_RESPONSE", "WORKED_SOLUTION"]));
    expect(brief.limits.mathPracticePerConcept).toMatchObject({ guided: 2, independent: 2 });
  });

  it("uses the archived V4 prompt and rejects an old-shape (1.0.0) lesson", async () => {
    const legacy = (await import("fs")).readFileSync("curriculum/v2/g4-math/candidates/equivalent-fractions.json", "utf8");
    const complete = vi.fn().mockResolvedValue({ content: legacy, model: "test-model" });
    const outcome = await generateCurriculumLessonV2({ context: g4ProofContext(FRACTIONS), complete });
    expect(complete.mock.calls[0][0].aiUsage).toMatchObject({ promptKey: "curriculum.v2.lesson", promptVersion: "1.1.0" });
    expect(complete.mock.calls[0][0].messages[0].content).toContain("candidate-lesson-v2/1.1.0");
    expect(outcome).toEqual({ status: "REJECTED", errors: ["candidate_contract_not_v4"], gaps: [] });
  });
});
