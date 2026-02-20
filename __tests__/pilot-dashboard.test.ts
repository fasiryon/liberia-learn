import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    school: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/pilot-score", () => ({
  computePilotScoresForSchools: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { computePilotScoresForSchools } from "@/lib/pilot-score";
import { getPilotDashboardRows } from "@/lib/pilot-dashboard";

describe("pilot dashboard data", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns only pilot schools", async () => {
    (prisma.school.findMany as any).mockResolvedValue([
      {
        id: "s1",
        name: "Pilot One",
        county: "Montserrado",
        onboardingStep: 3,
        pilotStatus: "ACTIVE",
        pilotCohort: "2026-A",
        contactEmailVerified: true,
        contactPhoneVerified: false,
        primaryHex: null,
        logoUrl: null,
      },
      {
        id: "s2",
        name: "Not Pilot",
        county: "Bong",
        onboardingStep: 2,
        pilotStatus: null,
        pilotCohort: null,
        contactEmailVerified: false,
        contactPhoneVerified: false,
        primaryHex: null,
        logoUrl: null,
      },
    ]);

    (computePilotScoresForSchools as any).mockResolvedValue({
      s1: { total: 82, components: [], grade: "B" },
    });

    const rows = await getPilotDashboardRows();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("s1");
    expect(computePilotScoresForSchools).toHaveBeenCalledWith([
      expect.objectContaining({ id: "s1" }),
    ]);
  });
});
