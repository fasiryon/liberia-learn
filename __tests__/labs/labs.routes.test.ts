import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStateForTests } from "@/lib/rateLimit";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/serverFlags", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/serverFlags")>();
  return {
    ...original,
    isAiLabsEnabled: () => true,
  };
});

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: mockLogLearningEvent,
}));

import { POST as postPlan } from "@/app/api/labs/[labId]/plan/route";

function requestFor(labId: string) {
  return new NextRequest(`http://localhost/api/labs/${labId}/plan`, {
    method: "POST",
    body: JSON.stringify({ message: "start", state: {} }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("lab API routes", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetRateLimitStateForTests();
    mockLogLearningEvent.mockResolvedValue(null);
  });

  it("/api/labs/unknown-lab/plan returns 404", async () => {
    mockRequireRole.mockResolvedValue({
      id: "student-1",
      role: "STUDENT",
      schoolId: "school-1",
    });

    const response = await postPlan(requestFor("unknown-lab"), {
      params: { labId: "unknown-lab" },
    });

    expect(response.status).toBe(404);
  });

  it("/api/labs/[labId]/plan returns 401 without auth", async () => {
    mockRequireRole.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }));

    const response = await postPlan(requestFor("gravity-explorer"), {
      params: { labId: "gravity-explorer" },
    });

    expect(response.status).toBe(401);
  });

  it("rate limits after 20 calls per hour", async () => {
    mockRequireRole.mockResolvedValue({
      id: "student-rate-limit",
      role: "STUDENT",
      schoolId: "school-1",
    });

    let response = await postPlan(requestFor("unknown-lab"), {
      params: { labId: "unknown-lab" },
    });
    for (let index = 1; index < 21; index += 1) {
      response = await postPlan(requestFor("unknown-lab"), {
        params: { labId: "unknown-lab" },
      });
    }

    expect(response.status).toBe(429);
  });
});
