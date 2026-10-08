// Curriculum V2 / Codex P1-1 and P1-2: learner payload secrecy at the student curriculum boundaries.
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
const requireRole = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: { curriculumContent: { findMany } } }));
vi.mock("@/lib/auth", () => ({ requireRole }));

import { GET } from "@/app/api/curriculum/route";
import { projectStudentLabPayload, projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";

const SECRET = "SECRET-DO-NOT-SHIP";
const SECRET_KEYS = ["answer", "answerKey", "correctIndex", "explanation", "scoring", "rubric", "scoringRubric", "expectedAnswer", "teacherNotes", "teacherNote", "teacherGuide", "markScheme", "futureHiddenField"];

/** Every secret key planted at several depths, including inside nested scoring/rubric objects. */
function secretFields(): Record<string, unknown> {
  return Object.fromEntries(SECRET_KEYS.map((key) => [key, key === "correctIndex" ? 2 : { nested: { rubric: SECRET, scoring: { points: SECRET } }, value: SECRET }]));
}

function assertNoSecrets(value: unknown) {
  const json = JSON.stringify(value);
  expect(json).not.toContain(SECRET);
  for (const key of SECRET_KEYS) expect(json).not.toContain(`"${key}"`);
}

const approvedPayload = {
  title: "Equivalent fractions",
  body: ["## Learn", "", "Two fractions can name the same amount.", "", "## Teacher Notes", "", "SECRET-DO-NOT-SHIP"].join("\n"),
  objectives: ["Write equivalent fractions"],
  teacherNotes: SECRET,
  answerKey: { q1: SECRET },
  assessment: [
    { id: "q1", question: "Which is equal to 1/2?", type: "mcq", options: ["1/3", { id: "b", text: "2/4", correct: true, rubric: SECRET }], ...secretFields() },
    { id: "q2", prompt: "Explain why.", choices: ["a", "b"], scoring: { rubric: { level4: SECRET } }, ...secretFields() },
    { ...secretFields() },
  ],
  labs: [{
    id: "lab-1", title: "Fold strips", labObjective: "See equal parts",
    procedure: [{ step: 1, instruction: "Fold the strip.", teacherNote: SECRET, ...secretFields() }],
    observationForm: [{ id: "o1", prompt: "What did you see?", expectedAnswer: SECRET, ...secretFields() }],
    analysisQuestions: [{ id: "a1", question: "Why?", expectedAnswer: SECRET, scoringRubric: SECRET, ...secretFields() }],
    ...secretFields(),
  }],
  pseudoLabs: [{ id: "p1", title: "Strip lab", objective: "Equal parts", approved: true, renderStatus: "ready", procedureSteps: ["Fold the paper strip in half."], commonConfusionSignals: [SECRET], expectedSuccessRate: 0.7, ...secretFields() }],
  simulationDefinitions: [{
    id: "s1", title: "Strips", objective: "Equal parts", approved: true, renderStatus: "ready", simulationType: "slider", rendererKey: "fraction-bar",
    teacherGuide: SECRET, stateSchema: { secret: SECRET },
    inputs: [{ key: "n", label: "Parts", type: "range", min: 1, max: 8, answer: SECRET, ...secretFields() }],
    outputs: [{ key: "bar", label: "Bar", description: "A bar.", ...secretFields() }],
    uiConfig: { compact: true, showTeacherNotes: true, accentColor: "#fff", hidden: SECRET },
    ...secretFields(),
  }],
};

describe("P1-2 student lesson projection is allow-list based", () => {
  it("removes generic answer, nested scoring/rubric, teacher-only and unknown future fields from legacy payloads", () => {
    const projected = projectStudentLessonPayload(approvedPayload);
    assertNoSecrets(projected);
    const assessment = projected.assessment as Array<Record<string, unknown>>;
    expect(assessment.map((item) => item.id)).toEqual(["q1", "q2"]);
    expect(assessment[0]).toEqual({ id: "q1", question: "Which is equal to 1/2?", type: "mcq", options: ["1/3", { id: "b", text: "2/4" }] });
    expect((projected.labs as Array<Record<string, unknown>>)[0].procedure).toEqual([{ step: 1, instruction: "Fold the strip." }]);
    expect((projected.simulationDefinitions as Array<Record<string, unknown>>)[0].inputs).toEqual([{ key: "n", label: "Parts", type: "range", min: 1, max: 8 }]);
  });

  it("applies the same allow-list to authored studentMaterials payloads", () => {
    const projected = projectStudentLessonPayload({ ...approvedPayload, studentMaterials: { learnerMaterial: "Read about equal parts.", guidedItems: ["Fold a strip."], lab: approvedPayload.labs[0] } });
    assertNoSecrets(projected);
    expect(projected.studentReady).toBe(true);
  });

  it("projects standalone lab payloads through the same allow-list", () => {
    assertNoSecrets(projectStudentLabPayload(approvedPayload.labs[0]));
  });
});

describe("P1-1 student curriculum list returns a learner-safe summary", () => {
  beforeEach(() => {
    findMany.mockReset();
    requireRole.mockReset();
    findMany.mockResolvedValue([{
      id: "row-1", contentId: "c-1", title: "Equivalent fractions", grade: 4, subject: "MATH", contentType: "lesson", status: "published", version: "3",
      payload: approvedPayload,
      audioAssets: [{ id: "a1", status: "GENERATED", contentVersion: "3", storageUrl: "https://blob.example/secret.mp3", estimatedCostUsd: 0.4 }],
      createdAt: new Date("2026-10-01T00:00:00.000Z"), updatedAt: new Date("2026-10-02T00:00:00.000Z"),
    }]);
  });

  it("never returns the stored payload, storage URLs or costs to a student", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "STUDENT", schoolId: "school-a" });
    const response = await GET(new Request("http://localhost/api/curriculum?grade=4"));
    const body = await response.json();
    assertNoSecrets(body);
    expect(JSON.stringify(body)).not.toContain("payload");
    expect(JSON.stringify(body)).not.toContain("blob.example");
    expect(Object.keys(body.items[0]).sort()).toEqual(["audioStatus", "contentId", "contentType", "displayTitle", "grade", "subject", "title", "updatedAt", "version"]);
  });

  it("scopes students to platform + own-school content, APPROVED status and an APPROVED governed lifecycle", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "STUDENT", schoolId: "school-a" });
    await GET(new Request("http://localhost/api/curriculum"));
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["published", "APPROVED"] });
    expect(where.AND[0]).toEqual({ OR: [{ schoolId: null }, { schoolId: "school-a" }] });
    expect(where.AND[1]).toEqual({ OR: [{ provenance: { is: null } }, { provenance: { is: { lifecycleState: "APPROVED" } } }] });
  });

  it("a student with no school sees only platform content", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "STUDENT", schoolId: null });
    await GET(new Request("http://localhost/api/curriculum"));
    expect(findMany.mock.calls[0][0].where.AND[0]).toEqual({ OR: [{ schoolId: null }] });
  });

  it("teachers keep their authoring view but are tenant scoped too", async () => {
    requireRole.mockResolvedValue({ id: "t1", role: "TEACHER", schoolId: "school-a" });
    const body = await (await GET(new Request("http://localhost/api/curriculum"))).json();
    expect(body.items[0].payload).toBeDefined();
    expect(findMany.mock.calls[0][0].where.AND[0]).toEqual({ OR: [{ schoolId: null }, { schoolId: "school-a" }] });
  });
});
