import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEnqueueEscalation } = vi.hoisted(() => ({ mockEnqueueEscalation: vi.fn() }));
vi.mock("@/lib/agents/escalation", () => ({ enqueueEscalation: mockEnqueueEscalation }));

import { safeguardingEscalateTool } from "@/lib/agents/tools/safeguarding.tools";

describe("safeguarding.escalate", () => {
  beforeEach(() => {
    mockEnqueueEscalation.mockReset();
    mockEnqueueEscalation.mockResolvedValue({ id: "esc-1" });
  });

  it("creates an EscalationQueue entry with invocationId null (fires mid-loop)", async () => {
    const result = await safeguardingEscalateTool.handler(
      { studentId: "student-1", reason: "guardian reports child was hit by teacher", priority: "HIGH" },
      { agentName: "liberialearn-family", userId: "guardian-1", traceId: "trace-1", schoolId: "school-1" }
    );

    expect(result).toEqual({ escalationId: "esc-1", assignedTo: null });
    expect(mockEnqueueEscalation).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: "liberialearn-family",
        invocationId: null,
        userId: "guardian-1",
        priority: "HIGH",
        traceId: "trace-1",
        schoolId: "school-1",
      })
    );
  });

  it("includes the studentId in the escalation reason for traceability", async () => {
    await safeguardingEscalateTool.handler(
      { studentId: "student-42", reason: "distress language", priority: "MEDIUM" },
      { agentName: "liberialearn-family", userId: null }
    );
    const call = mockEnqueueEscalation.mock.calls[0][0];
    expect(call.reason).toContain("student-42");
    expect(call.reason).toContain("distress language");
  });

  it("is allowed for any role (requiresAuth includes every AgentRole)", () => {
    expect(safeguardingEscalateTool.requiresAuth).toEqual(
      expect.arrayContaining(["student", "teacher", "principal", "guardian", "moe", "admin", "system"])
    );
  });
});
