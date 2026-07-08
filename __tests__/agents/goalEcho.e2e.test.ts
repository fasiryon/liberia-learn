import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory AgentGoal store so the lifecycle persists across advance calls.
const store = new Map<string, Record<string, unknown>>();
let idSeq = 0;

vi.mock("@/lib/db", () => ({
  prisma: {
    agentGoal: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `goal-${++idSeq}`;
        const row = {
          id,
          pauseReason: null,
          pauseUntil: null,
          humanReviewRequired: false,
          stepCount: 0,
          lastError: null,
          completedAt: null,
          ...data,
        };
        store.set(id, row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...store.get(where.id), ...data };
        store.set(where.id, row);
        return row;
      }),
    },
  },
}));

import "@/lib/agents/goals/goalEcho";
import { createGoal } from "@/lib/agents/goals/goalStore";
import { advanceGoal, resumeGoal } from "@/lib/agents/goals/goalRunner";

describe("goal-echo lifecycle (end to end)", () => {
  beforeEach(() => {
    store.clear();
    idSeq = 0;
  });

  it("walks OPEN → IN_PROGRESS → PAUSED_FOR_HUMAN → resume → PAUSED_FOR_SCHEDULE → COMPLETED", async () => {
    const goal = await createGoal({
      agentName: "goal-echo",
      initiatedBy: "admin-1",
      goalDescription: "demo the goal lifecycle",
    });
    expect(goal.status).toBe("OPEN");

    // step 0 → continue
    let r = await advanceGoal(goal.id);
    expect(r.status).toBe("IN_PROGRESS");

    // step 1 → pause for human
    r = await advanceGoal(goal.id);
    expect(r.status).toBe("PAUSED_FOR_HUMAN");
    expect(store.get(goal.id)!.humanReviewRequired).toBe(true);

    // cannot advance while awaiting a human
    const blocked = await advanceGoal(goal.id);
    expect(blocked.advanced).toBe(false);
    expect(blocked.reason).toBe("awaiting_human");

    // human resumes → schedules a follow-up
    r = await resumeGoal(goal.id, { guardianPhone: "+231770000111" });
    expect(r.status).toBe("PAUSED_FOR_SCHEDULE");

    // not due yet
    const notDue = await advanceGoal(goal.id, { now: new Date(Date.now() - 5000) });
    expect(notDue.advanced).toBe(false);
    expect(notDue.reason).toBe("not_due");

    // after the wake time → completes
    r = await advanceGoal(goal.id, { now: new Date(Date.now() + 5000) });
    expect(r.status).toBe("COMPLETED");
    expect(store.get(goal.id)!.completedAt).toBeInstanceOf(Date);
    expect((store.get(goal.id)!.state as { done?: boolean }).done).toBe(true);
  });
});
