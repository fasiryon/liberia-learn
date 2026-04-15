import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInterventionChainCreate = vi.hoisted(() => vi.fn());
const mockInterventionChainUpdate = vi.hoisted(() => vi.fn());
const mockInterventionChainFindMany = vi.hoisted(() => vi.fn());
const mockInterventionCreate = vi.hoisted(() => vi.fn());
const mockLogLearningEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    interventionChain: {
      create: mockInterventionChainCreate,
      update: mockInterventionChainUpdate,
      findMany: mockInterventionChainFindMany,
    },
    intervention: {
      create: mockInterventionCreate,
    },
  },
}));

vi.mock("@/lib/events/logLearningEvent", () => ({
  logLearningEvent: mockLogLearningEvent,
}));

import {
  advanceInterventionChainStage,
  listOpenInterventionChains,
  openInterventionChain,
} from "@/lib/interventions/interventionChains";

describe("intervention chain services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInterventionChainCreate.mockResolvedValue({ id: "chain-1" });
    mockInterventionCreate.mockResolvedValue({ id: "intervention-1" });
    mockInterventionChainUpdate.mockResolvedValue({ id: "chain-1", currentStage: "intervention" });
    mockInterventionChainFindMany.mockResolvedValue([{ id: "chain-1", openedByUserId: "teacher-1" }]);
    mockLogLearningEvent.mockResolvedValue({ id: "evt-1" });
  });

  it("opens an intervention chain with attribution", async () => {
    await openInterventionChain({
      schoolId: "school-1",
      studentId: "student-1",
      openedByUserId: "teacher-1",
      openedByRole: "TEACHER",
      attributionSource: "teacher_referral",
    });

    expect(mockInterventionChainCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          openedByUserId: "teacher-1",
          openedByRole: "TEACHER",
          attributionSource: "teacher_referral",
        }),
      })
    );
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "intervention.chain.opened",
      })
    );
  });

  it("advances a chain stage and links a normalized intervention record", async () => {
    const result = await advanceInterventionChainStage({
      chainId: "chain-1",
      stage: "intervention",
      schoolId: "school-1",
      studentId: "student-1",
      userId: "teacher-1",
      attributionSource: "teacher_referral",
      intervention: {
        interventionType: "small_group_support",
        sourceAttemptId: "attempt-1",
      },
    });

    expect(mockInterventionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chainId: "chain-1",
          chainStage: "intervention",
          sourceAttemptId: "attempt-1",
        }),
      })
    );
    expect(mockInterventionChainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "chain-1" },
        data: expect.objectContaining({
          currentStage: "intervention",
          latestInterventionId: "intervention-1",
        }),
      })
    );
    expect(result.interventionId).toBe("intervention-1");
    expect(mockLogLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "intervention.chain.stage_changed",
      })
    );
  });

  it("lists only open chains with attribution fields for query consumers", async () => {
    await listOpenInterventionChains({ schoolId: "school-1", attributionSource: "teacher_referral" });

    expect(mockInterventionChainFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "open",
          schoolId: "school-1",
          attributionSource: "teacher_referral",
        }),
        select: expect.objectContaining({
          openedByUserId: true,
          openedByRole: true,
          attributionSource: true,
        }),
      })
    );
  });

  it("does not create orphaned intervention records when no intervention payload is supplied", async () => {
    await advanceInterventionChainStage({
      chainId: "chain-1",
      stage: "outcome",
      schoolId: "school-1",
      studentId: "student-1",
      userId: "teacher-1",
    });

    expect(mockInterventionCreate).not.toHaveBeenCalled();
    expect(mockInterventionChainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          latestInterventionId: "intervention-1",
        }),
      })
    );
  });
});
