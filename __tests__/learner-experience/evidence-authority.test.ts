import { beforeEach, describe, expect, it, vi } from "vitest";

const mastery = vi.hoisted(() => ({ appendCanonicalMasteryUpdate: vi.fn() }));
vi.mock("@/lib/learning-state/masteryWriter", () => mastery);

import { hydropowerLessonExperience as lesson, hydropowerLabLink as link } from "@/lib/learner-experience/fixtures/hydropowerLesson";
import { advance, applyLabReturn, chooseLabFallback, goToScene, initialProgress, isSceneComplete, recordResponse, restoreProgress } from "@/lib/learner-experience/progress";
import { buildEvidenceEnvelope, observationDisposition } from "@/lib/learner-experience/evidenceHandoff";
import { findLabExperience } from "@/lib/learner-experience/labExperience";
import type { LessonExperience } from "@/lib/learner-experience/types";
import { adaptEnvelope } from "@/lib/learner-experience/evidenceAdapter";
import { validateGovernedEvidence } from "@/lib/learning-evidence/evidenceContract";

const hydro = findLabExperience("mount-coffee-hydropower")!;
const releasedHydro = { ...hydro, release: { ...hydro.release, status: "RELEASED" as const } };
const labs = { "mount-coffee-hydropower": hydro };
const server = { experience: lesson, links: [link] };
const online = { source: "ONLINE" as const, syncIdentity: null, syncBatchId: null, clientEventId: null };
const learner = { tenantId: "school-a", schoolId: "school-a", studentId: "student-a", studentUserId: "user-a", sessionId: "session-a" };

function completedProgress() {
  let progress = goToScene(lesson, initialProgress(lesson), "quick-check");
  progress = recordResponse(progress, "quick-check", "qc-generator", 1);
  progress = recordResponse(progress, "quick-check", "qc-dry-season", 0);
  progress = applyLabReturn(lesson, progress, "lab", { labId: "mount-coffee-hydropower", labVersion: "1.1.0", linkId: link.linkId, completedCheckIds: ["trace-water", "find-generator"], totalChecks: 5, tripObserved: true, resetObserved: true, finalProfile: "LOW", minutesInLab: 6, exit: "RETURNED_EARLY" });
  progress = recordResponse(progress, "reflection", "why-trip", "The city asked for more power than the plant could make.");
  progress = recordResponse(progress, "reflection", "before-reset", "We had to switch off some shops blocks so demand fit.");
  for (const item of ["proto-hydro-m1", "proto-hydro-m2", "proto-hydro-m3"]) progress = recordResponse(progress, "mastery", item, 1);
  return progress;
}

describe("lab and lesson evidence never mutate mastery", () => {
  beforeEach(() => mastery.appendCanonicalMasteryUpdate.mockReset());

  it("builds an envelope of observations with the mastery invariants on the wire", () => {
    const envelope = buildEvidenceEnvelope(lesson, completedProgress(), [link], labs);
    expect(envelope.masteryMutation).toBe(false);
    expect(envelope.nextActionAuthority).toBe("LEARNING_ORCHESTRATOR");
    expect(envelope.observations.map((o) => o.kind)).toEqual(["FORMATIVE_OBSERVATION", "LAB_OBSERVATION", "REFLECTION", "MASTERY_RESPONSE"]);
    // Prototype lesson + prototype link: governance keeps everything a raw observation.
    expect(envelope.observations.every((o) => o.disposition === "RAW_OBSERVATION")).toBe(true);
    const masteryObservation = envelope.observations.find((o) => o.kind === "MASTERY_RESPONSE")!;
    expect(JSON.stringify(masteryObservation.payload)).not.toMatch(/correct/i);
  });

  it("adapts into valid governed evidence through existing lab governance without calling the mastery writer", () => {
    const adapted = adaptEnvelope(buildEvidenceEnvelope(lesson, completedProgress(), [link], labs), server, learner, online, "2026-10-07T00:00:00.000Z");
    const all = adapted.flatMap((entry) => entry.evidence);
    expect(all.length).toBeGreaterThanOrEqual(5);
    for (const evidence of all) {
      validateGovernedEvidence(evidence);
      expect(evidence.canonicalMasteryMutation).toBe(false);
      expect(evidence.strength.serverScored).toBe(false);
      expect(evidence.performance.correct).toBeNull();
    }
    const lab = adapted.find((entry) => entry.observationId.endsWith(":lab"))!;
    expect(lab.disposition).toBe("RAW_OBSERVATION");
    expect(lab.evidence.map((e) => e.activity.activityId)).toEqual(["mount-coffee-hydropower", "mount-coffee-hydropower"]);
    expect(mastery.appendCanonicalMasteryUpdate).not.toHaveBeenCalled();
  });

  it("rejects an envelope whose invariants were tampered with", () => {
    const envelope = buildEvidenceEnvelope(lesson, completedProgress(), [link], labs);
    expect(() => adaptEnvelope({ ...envelope, masteryMutation: true as unknown as false }, server, learner, online)).toThrow("experience_envelope_invariant_violated");
  });

  it("ignores authority, disposition and evidence type claimed by the client envelope", () => {
    const envelope = buildEvidenceEnvelope(lesson, completedProgress(), [link], labs);
    const forged = {
      ...envelope,
      authorityStatus: "APPROVED_RELEASE" as const,
      observations: envelope.observations.map((o) => ({ ...o, disposition: "PROVISIONAL" as const, evidenceType: "EXAM_TEST" as const, objectiveIds: ["forged-objective"] })),
    };
    const adapted = adaptEnvelope(forged, server, learner, online, "2026-10-07T00:00:00.000Z");
    expect(adapted.every((entry) => entry.disposition === "RAW_OBSERVATION")).toBe(true);
    for (const evidence of adapted.flatMap((entry) => entry.evidence)) {
      expect(evidence.evidenceType).not.toBe("EXAM_TEST");
      expect(evidence.objective.objectiveId).not.toBe("forged-objective");
      expect(evidence.curriculum.ontologyReleaseId).toBe("unreleased");
    }
    expect(() => adaptEnvelope({ ...envelope, experienceVersion: "9.9.9" }, server, learner, online)).toThrow("experience_envelope_lesson_mismatch");
  });

  it("only an approved release can raise disposition, and mastery always goes to the assessment authority", () => {
    const released = { ...lesson, authority: { ...lesson.authority, status: "APPROVED_RELEASE" as const } };
    const approved = { ...link, status: "APPROVED" as const };
    expect(observationDisposition("LAB_OBSERVATION", released, link, releasedHydro)).toBe("RAW_OBSERVATION");
    expect(observationDisposition("LAB_OBSERVATION", released, approved, releasedHydro)).toBe("PROVISIONAL");
    expect(observationDisposition("MASTERY_RESPONSE", released, link, null)).toBe("SUBMIT_TO_ASSESSMENT_AUTHORITY");
    expect(observationDisposition("MASTERY_RESPONSE", lesson, link, null)).toBe("RAW_OBSERVATION");
  });

  it("keeps lab observations raw when the linked lab is not released (withdrawn, or link approved before release)", () => {
    const released = { ...lesson, authority: { ...lesson.authority, status: "APPROVED_RELEASE" as const } };
    const approved = { ...link, status: "APPROVED" as const };
    expect(observationDisposition("LAB_OBSERVATION", released, approved, hydro)).toBe("RAW_OBSERVATION");
    expect(observationDisposition("LAB_OBSERVATION", released, approved, null)).toBe("RAW_OBSERVATION");
    expect(observationDisposition("LAB_OBSERVATION", released, approved, { ...releasedHydro, labId: "another-lab" })).toBe("RAW_OBSERVATION");
  });

  it("admits only lab checks named by the link's evidence mapping", () => {
    const narrow = { ...link, evidenceMapping: link.evidenceMapping.filter((mapping) => mapping.labCheckId === "trace-water") };
    const envelope = buildEvidenceEnvelope(lesson, completedProgress(), [narrow], labs);
    const adapted = adaptEnvelope(envelope, { experience: lesson, links: [narrow] }, learner, online, "2026-10-07T00:00:00.000Z");
    const lab = adapted.find((entry) => entry.observationId.endsWith(":lab"))!;
    // The learner finished trace-water and find-generator; only the mapped check becomes evidence.
    expect(lab.evidence.map((evidence) => evidence.idempotencyKey.split(":").pop())).toEqual(["trace-water"]);
    expect(lab.evidence[0].objective.objectiveId).toBe("hydropower-cause-and-effect");
  });

  it("the lesson flow never decides the next lesson: Continue only moves within this lesson", () => {
    let progress = goToScene(lesson, initialProgress(lesson), "review");
    progress = advance(lesson, progress);
    expect(progress.sceneId).toBe("mastery");
    expect(advance(lesson, progress).sceneId).toBe("mastery");
  });
});

describe("two lab scenes in one lesson", () => {
  const second = { ...link, linkId: "proto-link-second" };
  const twoLabs: LessonExperience = {
    ...lesson,
    scenes: lesson.scenes.flatMap((scene) => scene.id === "reflection"
      ? [{ ...scene, id: "lab-2", type: "LAB" as const, title: "Second lab", interaction: { kind: "LAB_LAUNCH" as const, linkId: second.linkId }, evidence: lesson.scenes.find((item) => item.id === "lab")!.evidence, completion: { kind: "LAB_RETURNED_OR_FALLBACK" as const } }, scene]
      : [scene]),
  };
  const observation = { labId: "mount-coffee-hydropower", labVersion: "1.1.0", linkId: link.linkId, completedCheckIds: ["trace-water"], totalChecks: 5, tripObserved: true, resetObserved: true, finalProfile: "LOW", minutesInLab: 3, exit: "RETURNED_EARLY" as const };

  it("completing the first lab does not complete the second, and the fallback is per scene", () => {
    let progress = applyLabReturn(twoLabs, initialProgress(twoLabs), "lab", observation);
    const first = twoLabs.scenes.find((scene) => scene.id === "lab")!;
    const secondScene = twoLabs.scenes.find((scene) => scene.id === "lab-2")!;
    expect(isSceneComplete(first, progress)).toBe(true);
    expect(isSceneComplete(secondScene, progress)).toBe(false);
    progress = chooseLabFallback(progress, "lab-2");
    expect(isSceneComplete(secondScene, progress)).toBe(true);
    expect(progress.labs.lab.status).toBe("RETURNED");
  });

  it("each lab scene reports only its own lab's observation", () => {
    const progress = applyLabReturn(twoLabs, initialProgress(twoLabs), "lab", observation);
    const envelope = buildEvidenceEnvelope(twoLabs, progress, [link, second], labs);
    const labObservations = envelope.observations.filter((o) => o.kind === "LAB_OBSERVATION");
    expect(labObservations.map((o) => o.sceneId)).toEqual(["lab"]);
  });

  it("restore drops a lab observation stored under the wrong scene's link", () => {
    const tampered = { ...applyLabReturn(twoLabs, initialProgress(twoLabs), "lab", observation) };
    const raw = JSON.parse(JSON.stringify({ ...tampered, labs: { "lab-2": { status: "RETURNED", observation } } }));
    expect(restoreProgress(twoLabs, raw).labs["lab-2"]).toBeUndefined();
  });
});

describe("evidence identity and admission provenance come from trusted context (Codex P2-6, P2-7)", () => {
  const approvedLesson = { ...lesson, authority: { ...lesson.authority, status: "APPROVED_RELEASE" as const, releaseId: "lr-moe-g4-math-fractions-2026.1", releaseIdentity: "a".repeat(64) } };
  const formativeOnly = () => recordResponse(recordResponse(goToScene(lesson, initialProgress(lesson), "quick-check"), "quick-check", "qc-generator", 1), "quick-check", "qc-dry-season", 2);

  it("uses the pinned ontology release identity, never the lesson version", () => {
    const envelope = { ...buildEvidenceEnvelope(approvedLesson, formativeOnly(), [link], labs) };
    const [entry] = adaptEnvelope(envelope, { experience: approvedLesson, links: [link] }, learner, online, "2026-10-07T00:00:00.000Z");
    expect(entry.evidence[0].curriculum).toEqual({ ontologyReleaseId: "lr-moe-g4-math-fractions-2026.1", ontologyReleaseIdentity: "a".repeat(64) });
    expect(entry.evidence[0].curriculum.ontologyReleaseIdentity).not.toBe(lesson.version);
  });

  it("fails closed when an approved lesson has no release identity", () => {
    const missing = { ...approvedLesson, authority: { ...approvedLesson.authority, releaseIdentity: null } };
    expect(() => adaptEnvelope(buildEvidenceEnvelope(missing, formativeOnly(), [link], labs), { experience: missing, links: [link] }, learner, online)).toThrow("experience_release_identity_required");
  });

  it("records offline admission from the authenticated sync context", () => {
    const offline = { source: "OFFLINE" as const, syncIdentity: "sync-7", syncBatchId: "batch-3", clientEventId: "evt-9" };
    const [entry] = adaptEnvelope(buildEvidenceEnvelope(lesson, formativeOnly(), [link], labs), server, learner, offline, "2026-10-07T00:00:00.000Z");
    expect(entry.evidence[0].provenance).toMatchObject({ source: "OFFLINE", runtime: "SYNC", syncBatchId: "batch-3", clientEventId: "evt-9" });
    expect(entry.evidence[0].offline).toEqual({ isOffline: true, syncIdentity: "sync-7" });
  });
});
