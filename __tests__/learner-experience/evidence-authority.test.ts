import { beforeEach, describe, expect, it, vi } from "vitest";

const mastery = vi.hoisted(() => ({ appendCanonicalMasteryUpdate: vi.fn() }));
vi.mock("@/lib/learning-state/masteryWriter", () => mastery);

import { hydropowerLessonExperience as lesson, hydropowerLabLink as link } from "@/lib/learner-experience/fixtures/hydropowerLesson";
import { advance, applyLabReturn, goToScene, initialProgress, recordResponse } from "@/lib/learner-experience/progress";
import { buildEvidenceEnvelope, observationDisposition } from "@/lib/learner-experience/evidenceHandoff";
import { adaptEnvelope } from "@/lib/learner-experience/evidenceAdapter";
import { validateGovernedEvidence } from "@/lib/learning-evidence/evidenceContract";

const server = { experience: lesson, links: [link] };
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
    const envelope = buildEvidenceEnvelope(lesson, completedProgress(), link);
    expect(envelope.masteryMutation).toBe(false);
    expect(envelope.nextActionAuthority).toBe("LEARNING_ORCHESTRATOR");
    expect(envelope.observations.map((o) => o.kind)).toEqual(["FORMATIVE_OBSERVATION", "LAB_OBSERVATION", "REFLECTION", "MASTERY_RESPONSE"]);
    // Prototype lesson + prototype link: governance keeps everything a raw observation.
    expect(envelope.observations.every((o) => o.disposition === "RAW_OBSERVATION")).toBe(true);
    const masteryObservation = envelope.observations.find((o) => o.kind === "MASTERY_RESPONSE")!;
    expect(JSON.stringify(masteryObservation.payload)).not.toMatch(/correct/i);
  });

  it("adapts into valid governed evidence through existing lab governance without calling the mastery writer", () => {
    const adapted = adaptEnvelope(buildEvidenceEnvelope(lesson, completedProgress(), link), server, learner, "2026-10-07T00:00:00.000Z");
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
    const envelope = buildEvidenceEnvelope(lesson, completedProgress(), link);
    expect(() => adaptEnvelope({ ...envelope, masteryMutation: true as unknown as false }, server, learner)).toThrow("experience_envelope_invariant_violated");
  });

  it("ignores authority, disposition and evidence type claimed by the client envelope", () => {
    const envelope = buildEvidenceEnvelope(lesson, completedProgress(), link);
    const forged = {
      ...envelope,
      authorityStatus: "APPROVED_RELEASE" as const,
      observations: envelope.observations.map((o) => ({ ...o, disposition: "PROVISIONAL" as const, evidenceType: "EXAM_TEST" as const, objectiveIds: ["forged-objective"] })),
    };
    const adapted = adaptEnvelope(forged, server, learner, "2026-10-07T00:00:00.000Z");
    expect(adapted.every((entry) => entry.disposition === "RAW_OBSERVATION")).toBe(true);
    for (const evidence of adapted.flatMap((entry) => entry.evidence)) {
      expect(evidence.evidenceType).not.toBe("EXAM_TEST");
      expect(evidence.objective.objectiveId).not.toBe("forged-objective");
      expect(evidence.curriculum.ontologyReleaseId).toBe("unreleased");
    }
    expect(() => adaptEnvelope({ ...envelope, experienceVersion: "9.9.9" }, server, learner)).toThrow("experience_envelope_lesson_mismatch");
  });

  it("only an approved release can raise disposition, and mastery always goes to the assessment authority", () => {
    const released = { ...lesson, authority: { ...lesson.authority, status: "APPROVED_RELEASE" as const } };
    expect(observationDisposition("LAB_OBSERVATION", released, link)).toBe("RAW_OBSERVATION");
    expect(observationDisposition("LAB_OBSERVATION", released, { ...link, status: "APPROVED" })).toBe("PROVISIONAL");
    expect(observationDisposition("MASTERY_RESPONSE", released, link)).toBe("SUBMIT_TO_ASSESSMENT_AUTHORITY");
    expect(observationDisposition("MASTERY_RESPONSE", lesson, link)).toBe("RAW_OBSERVATION");
  });

  it("the lesson flow never decides the next lesson: Continue only moves within this lesson", () => {
    let progress = goToScene(lesson, initialProgress(lesson), "review");
    progress = advance(lesson, progress);
    expect(progress.sceneId).toBe("mastery");
    expect(advance(lesson, progress).sceneId).toBe("mastery");
  });
});
