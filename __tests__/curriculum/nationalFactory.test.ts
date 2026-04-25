import { describe, it, expect, vi, beforeEach } from "vitest";

const { STUB_BODY, mockFindMany, mockCreate } = vi.hoisted(() => {
  const STUB_BODY = [
    "## Objective",
    "Students in Grade X will understand the core concept and apply it to age-appropriate tasks using",
    "real-world Liberian contexts such as markets, county examples, and daily life activities.",
    "",
    "## Teacher Explanation",
    "The teacher introduces the core concept using direct modeling with worked examples. Key vocabulary",
    "is defined clearly and checked before moving to guided practice. All examples draw on Liberian",
    "contexts including Monrovia markets, county farms, and civic examples from Liberian daily life.",
    "",
    "## Worked Example",
    "Model one complete step-by-step example connected to the unit theme, naming each step and",
    "explaining why the answer is valid. Reference Liberian contexts throughout the demonstration.",
    "",
    "## Guided Practice",
    "Lead the class through one shared task and one paired task. Use teacher prompts and quick oral",
    "checks to confirm understanding before moving to independent work.",
    "",
    "## Independent Practice",
    "Students complete individual work demonstrating they can apply the concept without copying the",
    "model. Ask at least one student to explain their answer in writing or orally.",
    "",
    "## Assessment",
    "Short exit task: one recall item and one application item aligned to the lesson objective.",
    "Collect responses to inform next lesson planning and identify students who need remediation.",
    "",
    "## Guardian Support",
    "Ask the student to explain today main idea to a family member and complete one short home",
    "activity using household materials available in most Liberian homes.",
  ].join("\n");
  return { STUB_BODY, mockFindMany: vi.fn(), mockCreate: vi.fn() };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findMany: (...args: any[]) => mockFindMany(...args),
      create: (...args: any[]) => mockCreate(...args),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" }),
}));

vi.mock("@/lib/curriculum/generationEngine", () => ({
  buildCoverageGenerationPlan: vi.fn(({ grade, subject }: { grade: number; subject: string }) => [
    {
      contentId: `${subject.toLowerCase()}-g${grade}-1-unit-one-foundations`,
      grade, subject,
      unitId: `${subject.toLowerCase()}-g${grade}-1-unit-one`,
      orderInUnit: 1, hash: "abc123",
      payload: {
        title: `${subject} Unit One: Foundations`, grade, subject, lessonFormat: "either",
        objectives: ["Students will understand the core concept and apply it in context."],
        body: STUB_BODY, body_standard: STUB_BODY,
        body_block: `## Day 1\n${STUB_BODY}\n\n## Day 2\nGuided and independent practice.`,
        activities: ["Teacher modeling", "Paired practice", "Individual check"],
        labs: [], moeAlignments: [],
        metadata: { topic: "Unit One", locale: "LR", generatedAt: "test", model: "test" },
      },
    },
    {
      contentId: `${subject.toLowerCase()}-g${grade}-1-unit-one-core-concept`,
      grade, subject,
      unitId: `${subject.toLowerCase()}-g${grade}-1-unit-one`,
      orderInUnit: 2, hash: "def456",
      payload: {
        title: `${subject} Unit One: Core Concept`, grade, subject, lessonFormat: "either",
        objectives: ["Students will apply the core concept independently in varied contexts."],
        body: STUB_BODY, body_standard: STUB_BODY,
        body_block: `## Day 1\n${STUB_BODY}\n\n## Day 2\nExtension and review.`,
        activities: ["Concept exploration", "Group discussion", "Exit task"],
        labs: [], moeAlignments: [],
        metadata: { topic: "Unit One", locale: "LR", generatedAt: "test", model: "test" },
      },
    },
  ]),
}));

import {
  validatePayloadQuality, auditNationalCoverage, generateNationalBatch,
  buildGenerationPlan, NATIONAL_LESSON_TARGET, FACTORY_STATUS, FACTORY_SOURCE,
} from "@/lib/curriculum/nationalFactory";

describe("validatePayloadQuality", () => {
  it("passes a complete payload", () => {
    const result = validatePayloadQuality({ title: "Mathematics Unit One: Foundations", objectives: ["Students will understand place value."], body: STUB_BODY, assessment: "Two-item exit task." });
    expect(result.passed).toBe(true);
  });
  it("rejects a missing title", () => {
    const result = validatePayloadQuality({ title: "", objectives: ["Some objective"], body: STUB_BODY });
    expect(result.passed).toBe(false); expect(result.reason).toBe("missing_title");
  });
  it("rejects missing objectives", () => {
    const result = validatePayloadQuality({ title: "Valid Title", objectives: [], body: STUB_BODY });
    expect(result.passed).toBe(false); expect(result.reason).toBe("missing_objectives");
  });
  it("rejects a body that is too short", () => {
    const result = validatePayloadQuality({ title: "Valid Title", objectives: ["An objective"], body: "Too short." });
    expect(result.passed).toBe(false); expect(result.reason).toBe("body_too_short");
  });
  it("rejects placeholder content", () => {
    const result = validatePayloadQuality({ title: "Valid Title", objectives: ["An objective"], body: STUB_BODY.replace("Students in Grade X", "Students in Grade X TODO fix this") });
    expect(result.passed).toBe(false); expect(result.reason).toBe("placeholder_content");
  });
  it("rejects body missing worked examples", () => {
    const bodyNoEx = "## Objective\nUnderstand fractions. This lesson introduces fractions to students in Liberia. The teacher explains what a fraction is using Liberian market examples like sharing cassava. Students will practice identifying numerators and denominators in everyday items from Monrovia. The lesson connects to prior knowledge of counting and division from earlier grades in school.";
    const result = validatePayloadQuality({ title: "Valid Title", objectives: ["An objective"], body: bodyNoEx });
    expect(result.passed).toBe(false); expect(result.reason).toBe("missing_worked_examples");
  });
});

describe("buildGenerationPlan", () => {
  it("returns entries for all national grade/subject combos when no filter", () => {
    const plan = buildGenerationPlan({});
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.some(e => e.subject === "PE")).toBe(true);
    expect(plan.some(e => e.subject === "BIOLOGY")).toBe(true);
    expect(plan.filter(e => e.subject === "ECONOMICS").every(e => e.grade >= 11)).toBe(true);
  });
  it("filters by grade", () => {
    const plan = buildGenerationPlan({ grade: 2 });
    expect(plan.every(e => e.grade === 2)).toBe(true);
    expect(plan.some(e => e.subject === "BIOLOGY")).toBe(false);
  });
  it("filters by subject", () => {
    const plan = buildGenerationPlan({ subject: "BIOLOGY" });
    expect(plan.every(e => e.subject === "BIOLOGY")).toBe(true);
    expect(plan.every(e => e.grade >= 10)).toBe(true);
  });
  it("reports zero estimated cost (deterministic generation)", () => {
    expect(buildGenerationPlan({}).every(e => e.estimatedCostUsd === 0)).toBe(true);
  });
  it("targets 40 lessons per combo (8 units x 5 lessons)", () => {
    expect(buildGenerationPlan({ grade: 5, subject: "MATH" })[0]?.totalLessonsToGenerate).toBe(40);
  });
  it("NATIONAL_LESSON_TARGET equals 108", () => {
    expect(NATIONAL_LESSON_TARGET).toBe(108);
  });
});

describe("auditNationalCoverage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns critical severity when DB is empty", async () => {
    mockFindMany.mockResolvedValue([]);
    const report = await auditNationalCoverage();
    expect(report.criticalGaps.length).toBeGreaterThan(0);
    expect(report.totals.approved).toBe(0);
  });
  it("counts approved and pending lessons correctly", async () => {
    mockFindMany.mockResolvedValue([
      { grade: 2, subject: "MATH", status: "published" },
      { grade: 2, subject: "MATH", status: "published" },
      { grade: 2, subject: "MATH", status: "pending_approval" },
    ]);
    const report = await auditNationalCoverage();
    const mathG2 = report.entries.find(e => e.grade === 2 && e.subject === "MATH");
    expect(mathG2?.approved).toBe(2); expect(mathG2?.pending).toBe(1);
  });
  it("marks grade/subject as adequate when approved > 20", async () => {
    mockFindMany.mockResolvedValue(Array.from({ length: 25 }, () => ({ grade: 5, subject: "SCIENCE", status: "published" })));
    const report = await auditNationalCoverage();
    expect(report.entries.find(e => e.grade === 5 && e.subject === "SCIENCE")?.severity).toBe("adequate");
  });
  it("marks grade/subject as complete when approved >= factoryTarget (40)", async () => {
    mockFindMany.mockResolvedValue(Array.from({ length: 40 }, () => ({ grade: 7, subject: "CIVICS", status: "published" })));
    const report = await auditNationalCoverage();
    expect(report.entries.find(e => e.grade === 7 && e.subject === "CIVICS")?.severity).toBe("complete");
  });
  it("reports quickWinPending entries with pending but few approved", async () => {
    mockFindMany.mockResolvedValue([
      { grade: 9, subject: "MATH", status: "pending_approval" },
      { grade: 9, subject: "MATH", status: "pending_approval" },
    ]);
    const report = await auditNationalCoverage();
    expect(report.quickWinPending.some(e => e.grade === 9 && e.subject === "MATH")).toBe(true);
  });
  it("entries are sorted by grade then subject", async () => {
    mockFindMany.mockResolvedValue([]);
    const report = await auditNationalCoverage();
    for (let i = 1; i < report.entries.length; i++) {
      const prev = report.entries[i - 1]!; const curr = report.entries[i]!;
      expect(curr.grade >= prev.grade).toBe(true);
      if (curr.grade === prev.grade) expect(curr.subject >= prev.subject).toBe(true);
    }
  });
});

describe("generateNationalBatch", () => {
  beforeEach(() => { vi.clearAllMocks(); mockFindMany.mockResolvedValue([]); mockCreate.mockResolvedValue({ id: "new-lesson" }); });

  it("dry_run returns items without writing to DB", async () => {
    const summary = await generateNationalBatch({ grade: 1, subject: "MATH", batchSize: 2, dryRun: true });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(summary.totalSaved).toBeGreaterThan(0);
    expect(summary.batches[0]?.status).toBe("dry_run");
    expect(summary.batches[0]?.items.every(i => i.outcome === "dry_run")).toBe(true);
  });
  it("saves lessons to DB when dryRun is false", async () => {
    const summary = await generateNationalBatch({ grade: 1, subject: "MATH", batchSize: 2, dryRun: false });
    expect(mockCreate).toHaveBeenCalled();
    expect(summary.totalSaved).toBeGreaterThan(0);
  });
  it("respects batchSize limit", async () => {
    const summary = await generateNationalBatch({ grade: 2, subject: "LITERACY", batchSize: 1, dryRun: true });
    expect(summary.batches[0]?.attempted).toBeLessThanOrEqual(1);
  });
  it("skips duplicate contentIds already in DB", async () => {
    mockFindMany.mockResolvedValueOnce([{ contentId: "math-g3-1-unit-one-foundations" }, { contentId: "math-g3-1-unit-one-core-concept" }]).mockResolvedValueOnce([]);
    const summary = await generateNationalBatch({ grade: 3, subject: "MATH", batchSize: 10, dryRun: false });
    expect(summary.batches[0]?.skippedDuplicates).toBeGreaterThan(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
  it("treats unique constraint DB error as duplicate (not failure)", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockRejectedValue(new Error("Unique constraint failed on fields: contentId P2002"));
    const summary = await generateNationalBatch({ grade: 4, subject: "SCIENCE", batchSize: 2, dryRun: false });
    expect(summary.totalFailed).toBe(0);
  });
  it("reports zero cost for deterministic generation", async () => {
    const summary = await generateNationalBatch({ grade: 5, subject: "PE", batchSize: 3, dryRun: true });
    expect(summary.estimatedCostUsd).toBe(0);
    expect(summary.batches.every(b => b.estimatedCostUsd === 0)).toBe(true);
  });
  it("generates PE (non-catalog subject) without error", async () => {
    const summary = await generateNationalBatch({ grade: 6, subject: "PE", batchSize: 5, dryRun: true });
    expect(summary.batches.length).toBe(1);
    expect(summary.batches[0]!.items.every(i => i.outcome === "dry_run" || i.outcome === "quality_failed")).toBe(true);
  });
  it("generates BIOLOGY (senior secondary) without error", async () => {
    const summary = await generateNationalBatch({ grade: 10, subject: "BIOLOGY", batchSize: 5, dryRun: true });
    expect(summary.batches.length).toBe(1);
  });
  it("ECONOMICS only generates for grades 11-12", async () => {
    const g10 = await generateNationalBatch({ grade: 10, subject: "ECONOMICS", batchSize: 5, dryRun: true });
    const g11 = await generateNationalBatch({ grade: 11, subject: "ECONOMICS", batchSize: 5, dryRun: true });
    expect(g10.batches.length).toBe(0);
    expect(g11.batches.length).toBe(1);
  });
  it("returns provided sessionId in summary", async () => {
    const summary = await generateNationalBatch({ grade: 7, subject: "CIVICS", batchSize: 2, dryRun: true, sessionId: "test-session-abc" });
    expect(summary.sessionId).toBe("test-session-abc");
  });
  it("saved DB records use FACTORY_STATUS", async () => {
    await generateNationalBatch({ grade: 8, subject: "PE", batchSize: 2, dryRun: false });
    for (const [callArgs] of mockCreate.mock.calls) expect(callArgs.data.status).toBe(FACTORY_STATUS);
  });
  it("saved DB records include FACTORY_SOURCE in metadata", async () => {
    await generateNationalBatch({ grade: 9, subject: "CIVICS", batchSize: 2, dryRun: false });
    for (const [callArgs] of mockCreate.mock.calls) expect((callArgs.data.payload as any).metadata.source).toBe(FACTORY_SOURCE);
  });
});

describe("national-factory API route", () => {
  beforeEach(() => { vi.clearAllMocks(); mockFindMany.mockResolvedValue([]); mockCreate.mockResolvedValue({ id: "created" }); });
  it("GET returns audit and plan", async () => {
    const { GET } = await import("@/app/api/admin/curriculum/national-factory/route");
    const res = await GET();
    const json = await res.json();
    expect(json.audit).toBeDefined();
    expect(json.plan).toBeDefined();
    expect(Array.isArray(json.plan)).toBe(true);
  });
});
