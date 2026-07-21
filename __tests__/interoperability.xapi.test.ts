import { describe, expect, it } from "vitest";
import {
  deterministicStatementId,
  mapLearningEventToXapi,
  mapStudentPerformanceEventToXapi,
  pseudonymizeXapiActor,
  validateXapiStatement,
} from "@/lib/interoperability/xapi";

const SECRET = "phase-c-xapi-test-secret-at-least-32";

describe("xAPI statement mapping", () => {
  it("maps a LearningEvent to a structurally valid xAPI 1.0.3 statement", () => {
    const statement = mapLearningEventToXapi(
      {
        id: "event-1",
        eventType: "lesson.completed",
        occurredAt: new Date("2026-07-20T12:00:00.000Z"),
        studentId: "student-1",
        lessonId: "lesson-1",
        status: "completed",
        curriculumVersion: "2026.1",
        isReplay: true,
        replaySequence: 2,
        replayOfEventId: "event-original",
      },
      { pseudonymSecret: SECRET }
    );

    expect(statement.actor).toEqual({
      objectType: "Agent",
      account: {
        homePage: "https://liberialearn.org/xapi/actors",
        name: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(statement.verb.id).toBe("http://adlnet.gov/expapi/verbs/completed");
    expect(statement.object.objectType).toBe("Activity");
    expect(() => new URL(statement.object.id)).not.toThrow();
    expect(statement.version).toBe("1.0.0");
    expect(statement.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(validateXapiStatement(statement)).toEqual({ valid: true, errors: [] });
  });

  it("uses deterministic source-separated UUIDs", () => {
    const first = deterministicStatementId("LearningEvent", "same-row");
    expect(deterministicStatementId("LearningEvent", "same-row")).toBe(first);
    expect(deterministicStatementId("StudentPerformanceEvent", "same-row")).not.toBe(first);
  });

  it("creates stable and separated actor pseudonyms", () => {
    const first = pseudonymizeXapiActor("student-1", SECRET);
    expect(pseudonymizeXapiActor("student-1", SECRET)).toBe(first);
    expect(pseudonymizeXapiActor("student-2", SECRET)).not.toBe(first);
    expect(pseudonymizeXapiActor("student-1", `${SECRET}-different`)).not.toBe(first);
  });

  it("maps StudentPerformanceEvent score and duration without exposing identity", () => {
    const statement = mapStudentPerformanceEventToXapi(
      {
        id: "performance-1",
        studentId: "student-private-id",
        lessonId: "lesson-7",
        subject: "Mathematics",
        gradeLevel: 7,
        eventType: "practice_attempt",
        score: 0.875,
        durationSeconds: 125,
        attempts: 2,
        aiAssistUsed: false,
        createdAt: "2026-07-20T14:05:00.000Z",
      },
      { pseudonymSecret: SECRET }
    );

    expect(statement.result?.score).toEqual({ scaled: 0.875 });
    expect(statement.result?.duration).toBe("PT125S");
    expect(statement.verb.id).toBe("http://adlnet.gov/expapi/verbs/attempted");
    expect(JSON.stringify(statement)).not.toContain("student-private-id");
    expect(validateXapiStatement(statement).valid).toBe(true);
  });

  it("never copies raw metadata, quality markers, names, emails, or tenant ids", () => {
    const statement = mapLearningEventToXapi(
      {
        id: "event-sensitive",
        eventType: "page_view",
        occurredAt: "2026-07-20T15:00:00.000Z",
        userId: "user-private-id",
        contentId: "content-1",
        targetType: "Private Learner",
        metadata: {
          name: "Private Learner",
          email: "learner@example.org",
          schoolId: "school-private-id",
          nested: { phone: "+231000000000" },
        },
        qualityMarkers: { guardianName: "Private Guardian" },
      },
      { pseudonymSecret: SECRET }
    );
    const json = JSON.stringify(statement);

    expect(json).not.toContain("Private Learner");
    expect(json).not.toContain("private-learner");
    expect(json).not.toContain("learner@example.org");
    expect(json).not.toContain("school-private-id");
    expect(json).not.toContain("+231000000000");
    expect(json).not.toContain("user-private-id");
    expect(json).not.toContain("metadata");
    expect(json).not.toContain("qualityMarkers");
  });

  it("rejects nulls, empty objects, malformed identifiers, scores, and durations", () => {
    const invalid = {
      id: "not-a-uuid",
      actor: { objectType: "Agent", account: {} },
      verb: { id: "not an iri", display: { "en-US": "" } },
      object: { objectType: "Activity", id: null, definition: {} },
      result: { score: { scaled: 2 }, duration: "125 seconds" },
      context: {},
      timestamp: "yesterday",
      version: "1.0.3",
    };

    const result = validateXapiStatement(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(8);
  });
});
