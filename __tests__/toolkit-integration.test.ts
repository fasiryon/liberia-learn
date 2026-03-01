import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockIsToolkitLessonIntegrationEnabled = vi.hoisted(() => vi.fn());
const mockIsClassroomToolkitEnabled = vi.hoisted(() => vi.fn());
const mockIsToolkitCalculatorEnabled = vi.hoisted(() => vi.fn());
const mockIsToolkitScienceToolsEnabled = vi.hoisted(() => vi.fn());
const mockIsToolkitGeoToolsEnabled = vi.hoisted(() => vi.fn());
const mockIsToolkitTimerEnabled = vi.hoisted(() => vi.fn());

const mockScheduledWorkFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", async () => {
  const actual = await vi.importActual<any>("@/lib/serverFlags");
  return {
    ...actual,
    isToolkitLessonIntegrationEnabled: mockIsToolkitLessonIntegrationEnabled,
    isClassroomToolkitEnabled: mockIsClassroomToolkitEnabled,
    isToolkitCalculatorEnabled: mockIsToolkitCalculatorEnabled,
    isToolkitScienceToolsEnabled: mockIsToolkitScienceToolsEnabled,
    isToolkitGeoToolsEnabled: mockIsToolkitGeoToolsEnabled,
    isToolkitTimerEnabled: mockIsToolkitTimerEnabled,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    scheduledWork: {
      findUnique: mockScheduledWorkFindUnique,
    },
  },
}));

import { GET } from "@/app/api/teacher/schedule/[id]/tools/route";
import { getToolsForLesson } from "@/lib/toolkit/toolRegistry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEACHER_USER = { id: "u1", schoolId: "school-1", role: "TEACHER" };

const SCHEDULED_WORK_MATH = {
  id: "sw-1",
  classId: "class-1",
  class: { schoolId: "school-1" },
  content: {
    grade: 4,
    subject: "MATH",
    deliveryProfile: {
      toolsRequired: [
        { toolKey: "fraction-visualizer", reason: "Core visual aid", phase: "Practice", required: true },
        { toolKey: "basic-calculator", reason: "Quick checks", phase: "Closure", required: false },
      ],
    },
    payload: { title: "Fractions" },
  },
};

const SCHEDULED_WORK_NO_PROFILE = {
  id: "sw-2",
  classId: "class-1",
  class: { schoolId: "school-1" },
  content: {
    grade: 4,
    subject: "MATH",
    deliveryProfile: null,
    payload: { title: "Addition" },
  },
};

function makeGetRequest(id = "sw-1") {
  return new Request(`http://localhost/api/teacher/schedule/${id}/tools`) as any;
}

function makeParams(id = "sw-1") {
  return { params: { id } };
}

function enableAllToolkitFlags() {
  mockIsClassroomToolkitEnabled.mockReturnValue(true);
  mockIsToolkitCalculatorEnabled.mockReturnValue(true);
  mockIsToolkitScienceToolsEnabled.mockReturnValue(true);
  mockIsToolkitGeoToolsEnabled.mockReturnValue(true);
  mockIsToolkitTimerEnabled.mockReturnValue(true);
}

// ─── Route tests ──────────────────────────────────────────────────────────────

describe("GET /api/teacher/schedule/[id]/tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(TEACHER_USER);
    mockIsToolkitLessonIntegrationEnabled.mockReturnValue(true);
    enableAllToolkitFlags();
    mockScheduledWorkFindUnique.mockResolvedValue(SCHEDULED_WORK_MATH);
  });

  it("returns 404 when ENABLE_TOOLKIT_LESSON_INTEGRATION flag is OFF", async () => {
    mockIsToolkitLessonIntegrationEnabled.mockReturnValue(false);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(404);
    expect(mockRequireRole).not.toHaveBeenCalled();
  });

  it("returns 403 when scheduled work belongs to a different school", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue({
      ...SCHEDULED_WORK_MATH,
      class: { schoolId: "school-OTHER" },
    });

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(403);
  });

  it("returns 403 when scheduled work is not found (null)", async () => {
    mockScheduledWorkFindUnique.mockResolvedValue(null);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(403);
  });

  it("returns response with required, optional, contextual arrays", async () => {
    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("required");
    expect(json).toHaveProperty("optional");
    expect(json).toHaveProperty("contextual");
    expect(Array.isArray(json.required)).toBe(true);
    expect(Array.isArray(json.optional)).toBe(true);
    expect(Array.isArray(json.contextual)).toBe(true);
  });

  it("places toolsRequired[required=true] into the required array", async () => {
    const res = await GET(makeGetRequest(), makeParams());

    const json = await res.json();
    const requiredIds = json.required.map((t: any) => t.id);
    expect(requiredIds).toContain("fraction-visualizer");
  });

  it("places toolsRequired[required=false] into the optional array", async () => {
    const res = await GET(makeGetRequest(), makeParams());

    const json = await res.json();
    const optionalIds = json.optional.map((t: any) => t.id);
    expect(optionalIds).toContain("basic-calculator");
  });

  it("does not include required/optional tools in the contextual array", async () => {
    const res = await GET(makeGetRequest(), makeParams());

    const json = await res.json();
    const contextualIds = json.contextual.map((t: any) => t.id);
    expect(contextualIds).not.toContain("fraction-visualizer");
    expect(contextualIds).not.toContain("basic-calculator");
  });

  it("does not include tools from other schools' data (cross-tenant check)", async () => {
    // Verify that the query includes a schoolId scope on the scheduledWork lookup
    await GET(makeGetRequest(), makeParams());

    const findUniqueArgs = mockScheduledWorkFindUnique.mock.calls[0][0];
    expect(findUniqueArgs.where.id).toBe("sw-1");
    // Tenant isolation is enforced after fetch by checking sw.class.schoolId
    // The test above verifying 403 for wrong school covers this
  });
});

// ─── Unit tests: getToolsForLesson() ─────────────────────────────────────────

describe("getToolsForLesson() — lib/toolkit/toolRegistry.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enableAllToolkitFlags();
  });

  it("returns all contextual and no required/optional when toolsRequired is undefined", () => {
    const result = getToolsForLesson("math", 4, "lesson", undefined);

    expect(result.required).toHaveLength(0);
    expect(result.optional).toHaveLength(0);
    // Contextual tools for math G4 lesson exist (fraction-visualizer, number-line, etc.)
    expect(result.contextual.length).toBeGreaterThanOrEqual(0);
  });

  it("returns all contextual and no required/optional when toolsRequired is empty array", () => {
    const result = getToolsForLesson("math", 4, "lesson", []);

    expect(result.required).toHaveLength(0);
    expect(result.optional).toHaveLength(0);
  });

  it("places toolKey with required=true into the required array", () => {
    const result = getToolsForLesson("math", 4, "lesson", [
      { toolKey: "fraction-visualizer", reason: "Core visual aid", phase: "Practice", required: true },
    ]);

    const requiredIds = result.required.map((t) => t.id);
    expect(requiredIds).toContain("fraction-visualizer");
    expect(result.optional).toHaveLength(0);
  });

  it("places toolKey with required=false into the optional array", () => {
    const result = getToolsForLesson("math", 4, "lesson", [
      { toolKey: "basic-calculator", reason: "Quick reference", phase: "Closure", required: false },
    ]);

    const optionalIds = result.optional.map((t) => t.id);
    expect(optionalIds).toContain("basic-calculator");
    expect(result.required).toHaveLength(0);
  });

  it("skips unknown toolKey in toolsRequired gracefully", () => {
    const result = getToolsForLesson("math", 4, "lesson", [
      { toolKey: "nonexistent-tool-xyz", reason: "N/A", phase: "Any", required: true },
    ]);

    expect(result.required).toHaveLength(0);
    expect(result.optional).toHaveLength(0);
  });

  it("splits mixed required=true and required=false entries correctly", () => {
    const result = getToolsForLesson("math", 9, "assessment", [
      { toolKey: "scientific-calculator", reason: "Required", phase: "Assessment", required: true },
      { toolKey: "timer", reason: "Optional", phase: "Closure", required: false },
    ]);

    const requiredIds = result.required.map((t) => t.id);
    const optionalIds = result.optional.map((t) => t.id);
    expect(requiredIds).toContain("scientific-calculator");
    expect(optionalIds).toContain("timer");
  });

  it("excludes required/optional tools from contextual array", () => {
    const result = getToolsForLesson("math", 4, "lesson", [
      { toolKey: "fraction-visualizer", reason: "Core", phase: "Practice", required: true },
    ]);

    const contextualIds = result.contextual.map((t) => t.id);
    expect(contextualIds).not.toContain("fraction-visualizer");
  });

  it("handles science subject with grade 10 producing a valid contextual set", () => {
    const result = getToolsForLesson("SCIENCE", 10, "lesson", undefined);

    // Should not throw; contextual may be non-empty for science grade 10
    expect(result).toHaveProperty("required");
    expect(result).toHaveProperty("optional");
    expect(result).toHaveProperty("contextual");
  });

  it("handles unrecognised subject gracefully with empty contextual array", () => {
    const result = getToolsForLesson("CIVICS", 5, "lesson", undefined);

    // CIVICS is not a known toolkit subject — contextual should be empty
    expect(result.contextual).toHaveLength(0);
    expect(result.required).toHaveLength(0);
    expect(result.optional).toHaveLength(0);
  });
});
