import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    class: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
    curriculumContent: { count: vi.fn() },
    scheduledWork: { groupBy: vi.fn(), count: vi.fn() },
    studentProgress: { count: vi.fn() },
    enrollment: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    studentGuardian: { groupBy: vi.fn() },
    school: { findUnique: vi.fn() },
    user: { count: vi.fn() },
    pilotChecklistItem: { count: vi.fn() },
    pilotChecklistStatus: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("computePilotScore checklist integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (prisma.class.findMany as any).mockResolvedValue([]);
    (prisma.meeting.findMany as any).mockResolvedValue([]);
    (prisma.curriculumContent.count as any).mockResolvedValue(0);
    (prisma.scheduledWork.groupBy as any).mockResolvedValue([]);
    (prisma.scheduledWork.count as any).mockResolvedValue(0);
    (prisma.studentProgress.count as any).mockResolvedValue(0);
    (prisma.enrollment.count as any).mockResolvedValue(0);
    (prisma.enrollment.findMany as any).mockResolvedValue([]);
    (prisma.enrollment.groupBy as any).mockResolvedValue([]);
    (prisma.studentGuardian.groupBy as any).mockResolvedValue([]);
    (prisma.school.findUnique as any).mockResolvedValue({ primaryHex: null, logoUrl: null, onboardingStep: 0 });
    (prisma.user.count as any).mockResolvedValue(0);
  });

  it("uses checklist completion when feature flag is enabled", async () => {
    process.env.PILOT_CHECKLIST_ENABLED = "true";
    (prisma.pilotChecklistItem.count as any).mockResolvedValue(4);
    (prisma.pilotChecklistStatus.count as any).mockResolvedValue(2);

    const { computePilotScore } = await import("@/lib/pilot-score");
    const result = await computePilotScore("school-1");

    const setup = result.components.find((c) => c.name === "Platform Setup");
    expect(setup?.score).toBe(10);
    expect(setup?.detail).toContain("2/4");
  });
});
