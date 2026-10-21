// Interactive Learning V4: the six representative DRAFT candidates, end to end through the existing pipeline
// (parse → registry → validation + V4 standard → deliverability → Lesson Player V2 projection).
import { existsSync, readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { buildV4ReviewManifest, evaluateV4Candidate, V4_LESSONS, V4_REVIEW_DIR, v4LearnerProjection } from "@/lib/curriculum/v4/candidates";
import { MATH_PRACTICE_TARGET } from "@/lib/curriculum/v4/standard";
import { INDEPENDENT_PHASES, INSTRUCTION_PATTERNS, isSupportBlock } from "@/lib/learner-experience/teaching/instruction";
import { subjectFamily } from "@/lib/learner-experience/teaching/registry";
import { validateLessonExperience } from "@/lib/learner-experience/sceneContract";
import { buildEvidenceEnvelope } from "@/lib/learner-experience/evidenceHandoff";
import { initialProgress, isSceneComplete, markBlockDone, pendingTeachingBlocks, recordResponse } from "@/lib/learner-experience/progress";
import { scanCandidate } from "@/lib/curriculum/v2/parse";

describe.each(V4_LESSONS.map((lesson) => [lesson.key, lesson] as const))("%s", (_key, lesson) => {
  const outcome = evaluateV4Candidate(lesson);
  const family = subjectFamily(lesson.subject)!;

  it("parses and validates with no errors, and stays a review-blocked DRAFT", () => {
    expect(outcome.errors).toEqual([]);
    expect(outcome.status).toBe("REVIEW_BLOCKED");
    expect(outcome.gaps.filter((gap) => gap.severity === "BLOCKING").map((gap) => gap.code)).toEqual(expect.arrayContaining(["MOE_OBJECTIVE_UNBOUND", "V4_HUMAN_REVIEW_REQUIRED", "ASSESSMENT_ITEMS_PENDING"]));
  });

  it("meets the V4 standard with no blocking problems and teaches through its subject's pattern", () => {
    expect(outcome.standard.problems.filter((problem) => problem.severity !== "ADVISORY")).toEqual([]);
    const phases = new Set(outcome.candidate.scenes.map((scene) => scene.teaching?.phase));
    for (const phase of INSTRUCTION_PATTERNS[family]) expect(phases.has(phase)).toBe(true);
    expect(outcome.standard.balance.activityShare).toBeGreaterThanOrEqual(0.6);
    expect(outcome.standard.balance.activityShare).toBeLessThanOrEqual(0.85);
  });

  it("keeps independent work independent and mastery with the assessment authority", () => {
    for (const scene of outcome.candidate.scenes) {
      const blocks = [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])];
      if (scene.teaching && INDEPENDENT_PHASES.has(scene.teaching.phase)) { expect(blocks.some(isSupportBlock)).toBe(false); expect(scene.hints).toEqual([]); }
      if (scene.type === "MASTERY_CHECK") { expect(blocks).toEqual([]); expect(scene.interaction.kind).toBe("ASSESSMENT_HANDOFF"); }
    }
  });

  it("projects to a valid Lesson Player V2 experience with no assessment secrets", () => {
    const experience = v4LearnerProjection(lesson, outcome.candidate);
    expect(() => validateLessonExperience(experience)).not.toThrow();
    expect(experience.authority.status).toBe("CURRICULUM_V2_DRAFT");
    expect(experience.authority.releaseId).toBeNull();
    const mastery = experience.scenes.find((scene) => scene.type === "MASTERY_CHECK")!;
    expect(mastery.teaching).toBeUndefined();
    expect(mastery.interaction.kind === "ASSESSMENT_HANDOFF" && mastery.interaction.assessment.items).toEqual([]);
    // Formative keys exist only as `formativeKey`; nothing named like an answer key crosses into the learner projection.
    expect(scanCandidate(experience.scenes.map((scene) => scene.teaching ?? null)).filter((issue) => issue.startsWith("secret"))).toEqual([]);
  });

  it("states its lineage without inventing provenance", () => {
    if (lesson.source.kind === "SYNTHETIC_DEMONSTRATION") { expect(v4LearnerProjection(lesson).authority.candidateContentIds).toEqual([]); return; }
    expect(lesson.source.revisionId).toMatch(/^cmss/);
    expect(lesson.source.snapshot.rowSha256).toMatch(/^[a-f0-9]{64}$/);
    if (lesson.source.kind === "FIRST_TEN_BOUND") { expect(lesson.source.baseline.read).toBe(false); expect(lesson.source.baseline.packageDigest).toMatch(/^[a-f0-9]{64}$/); }
  });
});

describe("mathematics lessons meet the per-concept practice target", () => {
  it.each(["g7-math-area-perimeter", "g7-math-fractions", "math-multiplication-models"])("%s", (key) => {
    const outcome = evaluateV4Candidate(V4_LESSONS.find((lesson) => lesson.key === key)!);
    const demonstrated = new Set(outcome.candidate.scenes.filter((scene) => scene.teaching?.phase === "DEMONSTRATE").flatMap((scene) => scene.objectiveIds));
    expect(demonstrated.size).toBeGreaterThan(0);
    for (const objectiveId of demonstrated) for (const [measure, target] of Object.entries(MATH_PRACTICE_TARGET)) expect(outcome.standard.practice[objectiveId][measure as keyof typeof MATH_PRACTICE_TARGET], `${objectiveId} ${measure}`).toBeGreaterThanOrEqual(target);
  });
});

describe("the geometry reference lesson keeps the founder's worked example", () => {
  it("90 m by 45 m: 4,050 m² of seed and 270 m of rope", () => {
    const candidate = evaluateV4Candidate(V4_LESSONS[0]).candidate;
    const worked = candidate.scenes.find((scene) => scene.id === "watch-field")!.teaching!.blocks[0];
    expect(worked).toMatchObject({ type: "WORKED_SOLUTION", shape: { kind: "RECTANGLE", length: 90, width: 45 } });
    expect(JSON.stringify(worked)).toContain("4,050");
    expect(JSON.stringify(worked)).toContain("270");
  });
});

describe("finishing a V4 block opens Continue but is never evidence", () => {
  it("the done marker is position state, excluded from the evidence envelope", () => {
    const lesson = V4_LESSONS.find((candidate) => candidate.key === "g7-english-reading-evidence")!;
    const experience = v4LearnerProjection(lesson);
    const scene = experience.scenes.find((candidate) => candidate.id === "construct")!;
    let progress = initialProgress(experience, "2026-10-21T00:00:00.000Z");
    expect(isSceneComplete(scene, progress)).toBe(false);
    expect(pendingTeachingBlocks(scene, progress)).toEqual(["claim-sentence", "evidence-paragraph"]);
    progress = markBlockDone(markBlockDone(progress, scene.id, "claim-sentence"), scene.id, "evidence-paragraph");
    expect(isSceneComplete(scene, progress)).toBe(true);
    expect(progress.responses[scene.id]).toBeUndefined();
    progress = recordResponse(progress, "show-what-you-know", "unrelated", 0);
    expect(JSON.stringify(buildEvidenceEnvelope(experience, progress, [], {}))).not.toContain("v4-block:");
  });
});

describe("deterministic review package", () => {
  it("rebuilding the manifest gives identical bytes to the committed one", () => {
    const file = `${V4_REVIEW_DIR}/manifest.json`;
    expect(existsSync(file)).toBe(true);
    expect(JSON.stringify(buildV4ReviewManifest(), null, 2) + "\n").toBe(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  });
});
