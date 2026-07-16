import { describe, it, expect, vi, beforeEach } from "vitest";

const classFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { class: { findMany: (...a: unknown[]) => classFindMany(...a) } },
}));

import { getDeliveryComplianceForSchool } from "@/lib/moe/deliveryCompliance";

describe("getDeliveryComplianceForSchool (Sprint 6.3, new)", () => {
  beforeEach(() => {
    classFindMany.mockReset();
  });

  it("computes compliance percentage across all of a school's classes", async () => {
    classFindMany.mockResolvedValue([
      { scheduledWork: [{ id: "sw1", isDelivered: true }, { id: "sw2", isDelivered: false }] },
      { scheduledWork: [{ id: "sw3", isDelivered: true }] },
    ]);

    const result = await getDeliveryComplianceForSchool("school-1");

    expect(classFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: "school-1" } })
    );
    expect(result).toEqual({
      schoolId: "school-1",
      scheduledWorkTotal: 3,
      scheduledWorkDelivered: 2,
      compliancePct: 66.67,
    });
  });

  it("returns null compliancePct when the school has no scheduled work at all", async () => {
    classFindMany.mockResolvedValue([]);
    const result = await getDeliveryComplianceForSchool("empty-school");
    expect(result.compliancePct).toBeNull();
    expect(result.scheduledWorkTotal).toBe(0);
  });

  it("returns 100 when every scheduled item was delivered", async () => {
    classFindMany.mockResolvedValue([{ scheduledWork: [{ id: "sw1", isDelivered: true }] }]);
    const result = await getDeliveryComplianceForSchool("school-2");
    expect(result.compliancePct).toBe(100);
  });
});
