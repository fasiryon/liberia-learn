# Manager Loop Sub-project 1 — Core Durable Mission/Phase Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the durable persistence, state machine, Manager/Implementer protocol, and
governance-gate integration for Manager Loop's core mission/phase loop, extending
`lib/autonomous/` rather than duplicating it, and prove it end-to-end on one real bounded
dogfood phase.

**Architecture:** Extend `WorkflowRun` (nullable mission fields) and add two new tables,
`WorkflowPhase` and `WorkflowChecklistItem`, under `lib/autonomous/`. A pure state-machine
module enforces legal phase transitions. A repository module wraps all reads/writes
(dependency-injected `PrismaClient`, no hidden singleton). A gate-evaluation module re-derives
governance/quality verdicts live rather than trusting self-reports. Eight thin CLI scripts under
`scripts/manager-loop/` are the entire Manager/Implementer interface — Manager and Implementer
are Claude Code sessions invoking these scripts against the DB, not a new agent runtime.

**Tech Stack:** TypeScript, Prisma (Postgres), Vitest, tsx (CLI execution), Next.js repo
conventions already established in `lib/autonomous/`.

**Spec:** `docs/superpowers/specs/2026-09-04-manager-loop-core-design.md`

## Global Constraints

- All new Prisma columns/tables are additive only. No existing table, column, row, route, or
  cron is renamed, removed, or behaviorally changed.
- Every mission-scoped `WorkflowRun` row has `workflowType` starting with `"mission."` — every
  other `workflowType` (detector/optimization) is completely unaffected by these changes.
- Phase status vocabulary is exactly `NOT_STARTED | IN_PROGRESS | BLOCKED | VERIFYING |
  COMPLETE | FAILED`. Every write goes through `assertLegalPhaseTransition` — no code path
  bypasses it.
- Mission/phase completion is judged exclusively from `WorkflowPhase`/`WorkflowChecklistItem`
  status. `AgentGoal.status` must never be read by any function in this plan.
- All evidence is a `Json` pointer (file path, gate-report id, test-run summary path, PR link),
  never inlined content.
- The Manager path (`review-phase.ts`, `accept-phase.ts`) must always re-derive gate verdicts
  live — never trust a stored claim of "this passed."
- Every commit in this plan ends with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
  ```
- Mandatory code gate before declaring the plan done: `npx prisma generate`, `npx tsc
  --noEmit`, `npx vitest run`, `npm run build` — all green.
- No new sandboxed coding-agent runtime, no always-on server, no Mission Control UI, no
  parallel-worker system, no stall-policy engine, no fix to the `AUTONOMOUS_WORKFLOW_RUN`
  SQS/worker no-op (irrelevant to this design). Per the spec, these are explicitly out of
  scope for this plan.

---

## File Structure

```
prisma/schema.prisma                                    (modify — additive)
prisma/migrations/20260904_000001_manager_loop_phase_checklist/migration.sql   (create)

lib/autonomous/missionLoop/types.ts                      (create)
lib/autonomous/missionLoop/phaseStateMachine.ts           (create)
lib/autonomous/missionLoop/missionRepository.ts           (create)
lib/autonomous/missionLoop/gateEvaluation.ts               (create)

scripts/manager-loop/create-mission.ts                    (create)
scripts/manager-loop/plan-phases.ts                       (create)
scripts/manager-loop/dispatch-phase.ts                     (create)
scripts/manager-loop/status.ts                             (create)
scripts/manager-loop/report-phase.ts                       (create)
scripts/manager-loop/review-phase.ts                       (create)
scripts/manager-loop/accept-phase.ts                        (create)
scripts/manager-loop/reject-phase.ts                        (create)

__tests__/autonomous/missionLoop.phaseStateMachine.test.ts  (create)
__tests__/autonomous/missionLoop.missionRepository.test.ts  (create)
__tests__/autonomous/missionLoop.gateEvaluation.test.ts     (create)
__tests__/autonomous/missionLoop.createPlan.test.ts          (create)
__tests__/autonomous/missionLoop.dispatchStatus.test.ts      (create)
__tests__/autonomous/missionLoop.reportPhase.test.ts          (create)
__tests__/autonomous/missionLoop.reviewAcceptReject.test.ts    (create)
__tests__/autonomous/missionLoop.agentGoalBoundary.test.ts      (create)
__tests__/autonomous/missionLoop.restartResume.test.ts          (create)

docs/ai/MANAGER_LOOP.md                                   (create)

scripts/manager-loop/mission-000001-p7c-remediation/phases.json  (create, dogfood mission input)
```

---

### Task 1: Prisma schema — extend WorkflowRun/WorkflowStep/AgentRun, add WorkflowPhase/WorkflowChecklistItem

**Files:**
- Modify: `prisma/schema.prisma:1675-1919` (WorkflowRun, WorkflowStep, AgentRun blocks; insert two new models after `ExecutionTrace` at line 1919)
- Create: `prisma/migrations/20260904_000001_manager_loop_phase_checklist/migration.sql`

**Interfaces:**
- Produces: Prisma models `WorkflowPhase`, `WorkflowChecklistItem`; new nullable fields
  `WorkflowRun.objective/scope/constraints/acceptanceCriteria/dependsOnRunIds`; new optional
  fields `WorkflowStep.workflowPhaseId`, `AgentRun.workflowPhaseId`. All later tasks depend on
  these exact field names.

This is a pure schema change — there is no behavior to TDD yet. Verification is `npx prisma
generate` + `npx tsc --noEmit` succeeding, per this repo's own gate convention for DDL-only
changes.

- [ ] **Step 1: Add the five nullable columns to `WorkflowRun`**

In `prisma/schema.prisma`, inside the `WorkflowRun` model, add these fields immediately after
`version Int @default(1)` (line 1715) and before the blank line preceding `@@index`:

```prisma
  objective          String?
  scope              Json?
  constraints        Json?
  acceptanceCriteria Json?
  dependsOnRunIds    Json?
```

- [ ] **Step 2: Add `workflowPhaseId` to `WorkflowStep`**

Inside the `WorkflowStep` model, add immediately after `workflowRunId String` (line 1732):

```prisma
  workflowPhaseId   String?
```

And add this index alongside the existing `@@index` lines in that model:

```prisma
  @@index([workflowPhaseId])
```

- [ ] **Step 3: Add `workflowPhaseId` to `AgentRun`**

Inside the `AgentRun` model, add immediately after `workflowRunId String` (line 1782):

```prisma
  workflowPhaseId   String?
```

And add this index alongside the existing `@@index` lines in that model:

```prisma
  @@index([workflowPhaseId])
```

- [ ] **Step 4: Insert the two new models after `ExecutionTrace`**

Immediately after the closing `}` of the `ExecutionTrace` model (line 1919) and before the
`/// / ===== Curriculum Feedback` comment (line 1921), insert:

```prisma
/// Manager Loop Sub-project 1: a bounded, human-reviewable unit of work within a mission
/// WorkflowRun. Distinct from WorkflowStep (a flat atomic-retry unit used by detectors) —
/// a Phase has a title/objective/acceptance-criteria/checklist container concept that
/// WorkflowStep does not.
model WorkflowPhase {
  id                 String    @id @default(cuid())
  workflowRunId      String
  sequence           Int
  title              String
  objective          String
  acceptanceCriteria Json
  status             String    @default("NOT_STARTED")
  dependsOnPhaseIds  Json      @default("[]")
  attempt            Int       @default(0)
  lastProgressAt     DateTime?
  blockedReason      String?
  startedAt          DateTime?
  completedAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@index([workflowRunId, sequence])
  @@index([workflowRunId, status])
}

/// Manager Loop Sub-project 1: a single checklist item within a WorkflowPhase.
model WorkflowChecklistItem {
  id              String    @id @default(cuid())
  workflowPhaseId String
  label           String
  required        Boolean   @default(true)
  status          String    @default("PENDING")
  evidenceRef     Json?
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([workflowPhaseId, status])
}
```

- [ ] **Step 5: Write the migration SQL**

Create `prisma/migrations/20260904_000001_manager_loop_phase_checklist/migration.sql`:

```sql
-- Manager Loop Sub-project 1: extend the Autonomous OS Phase 1 workflow schema with
-- Mission/Phase/Checklist concepts. All changes additive; no existing table, column,
-- or row is altered, renamed, or dropped.

ALTER TABLE "WorkflowRun" ADD COLUMN "objective" TEXT;
ALTER TABLE "WorkflowRun" ADD COLUMN "scope" JSONB;
ALTER TABLE "WorkflowRun" ADD COLUMN "constraints" JSONB;
ALTER TABLE "WorkflowRun" ADD COLUMN "acceptanceCriteria" JSONB;
ALTER TABLE "WorkflowRun" ADD COLUMN "dependsOnRunIds" JSONB;

ALTER TABLE "WorkflowStep" ADD COLUMN "workflowPhaseId" TEXT;
ALTER TABLE "AgentRun" ADD COLUMN "workflowPhaseId" TEXT;

CREATE TABLE "WorkflowPhase" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "acceptanceCriteria" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "dependsOnPhaseIds" JSONB NOT NULL DEFAULT '[]',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "lastProgressAt" TIMESTAMP(3),
  "blockedReason" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowPhase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowPhase_workflowRunId_sequence_idx" ON "WorkflowPhase"("workflowRunId", "sequence");
CREATE INDEX "WorkflowPhase_workflowRunId_status_idx" ON "WorkflowPhase"("workflowRunId", "status");

CREATE TABLE "WorkflowChecklistItem" (
  "id" TEXT NOT NULL,
  "workflowPhaseId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "evidenceRef" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowChecklistItem_workflowPhaseId_status_idx" ON "WorkflowChecklistItem"("workflowPhaseId", "status");

CREATE INDEX "WorkflowStep_workflowPhaseId_idx" ON "WorkflowStep"("workflowPhaseId");
CREATE INDEX "AgentRun_workflowPhaseId_idx" ON "AgentRun"("workflowPhaseId");
```

- [ ] **Step 6: Verify**

Run: `npx prisma generate`
Expected: succeeds with no errors, regenerates `@prisma/client` types including `WorkflowPhase`
and `WorkflowChecklistItem`.

Run: `npx tsc --noEmit`
Expected: no new errors (existing baseline errors, if any, are unaffected — this step only
must not introduce new ones).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260904_000001_manager_loop_phase_checklist
git commit -m "$(cat <<'EOF'
feat: add WorkflowPhase/WorkflowChecklistItem schema for Manager Loop

Extends lib/autonomous/'s WorkflowRun with nullable mission fields and
adds two new tables. Purely additive - no existing table, column, or
row is changed; every non-mission workflowType is unaffected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 2: State machine (`phaseStateMachine.ts`)

**Files:**
- Create: `lib/autonomous/missionLoop/types.ts`
- Create: `lib/autonomous/missionLoop/phaseStateMachine.ts`
- Test: `__tests__/autonomous/missionLoop.phaseStateMachine.test.ts`

**Interfaces:**
- Produces: `PhaseStatus`, `MissionStatus`, `ChecklistItemStatus`, `AcceptanceCriterion`,
  `CriterionResult`, `ChecklistItemInput`, `PhaseInput`, `ChecklistItemDetail`, `PhaseDetail`,
  `MissionDetail` (all from `types.ts`); `IllegalPhaseTransitionError`,
  `assertLegalPhaseTransition(from: PhaseStatus, to: PhaseStatus): void`,
  `deriveMissionStatus(phaseStatuses: PhaseStatus[]): MissionStatus` (from
  `phaseStateMachine.ts`). Every later task imports types from `types.ts` and the two
  functions from `phaseStateMachine.ts`.

- [ ] **Step 1: Write `types.ts`**

```typescript
// lib/autonomous/missionLoop/types.ts
export type PhaseStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "VERIFYING"
  | "COMPLETE"
  | "FAILED";

export type MissionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE" | "FAILED";

export type ChecklistItemStatus = "PENDING" | "DONE" | "SKIPPED" | "BLOCKED";

export type AcceptanceCriterion =
  | { type: "command"; label: string; command: string }
  | { type: "approval_resolved"; approvalRequestId: string }
  | { type: "review_task_resolved"; qualityReviewTaskId: string };

export type CriterionResult = {
  criterion: AcceptanceCriterion;
  passed: boolean;
  detail: string;
};

export type ChecklistItemInput = {
  label: string;
  required?: boolean;
};

export type PhaseInput = {
  sequence: number;
  title: string;
  objective: string;
  acceptanceCriteria: AcceptanceCriterion[];
  dependsOnPhaseIds?: string[];
  checklist: ChecklistItemInput[];
};

export type ChecklistItemDetail = {
  id: string;
  label: string;
  required: boolean;
  status: ChecklistItemStatus;
  evidenceRef: unknown;
  completedAt: Date | null;
};

export type PhaseDetail = {
  id: string;
  workflowRunId: string;
  sequence: number;
  title: string;
  objective: string;
  acceptanceCriteria: AcceptanceCriterion[];
  status: PhaseStatus;
  dependsOnPhaseIds: string[];
  attempt: number;
  lastProgressAt: Date | null;
  blockedReason: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  checklist: ChecklistItemDetail[];
};

export type MissionDetail = {
  id: string;
  objective: string;
  scope: unknown;
  constraints: unknown;
  acceptanceCriteria: AcceptanceCriterion[];
  dependsOnRunIds: string[];
  status: MissionStatus;
  phases: PhaseDetail[];
};
```

- [ ] **Step 2: Write the failing test for the state machine**

```typescript
// __tests__/autonomous/missionLoop.phaseStateMachine.test.ts
import { describe, expect, it } from "vitest";
import {
  IllegalPhaseTransitionError,
  assertLegalPhaseTransition,
  deriveMissionStatus,
} from "@/lib/autonomous/missionLoop/phaseStateMachine";
import type { PhaseStatus } from "@/lib/autonomous/missionLoop/types";

describe("assertLegalPhaseTransition", () => {
  const legalPairs: Array<[PhaseStatus, PhaseStatus]> = [
    ["NOT_STARTED", "IN_PROGRESS"],
    ["IN_PROGRESS", "BLOCKED"],
    ["IN_PROGRESS", "VERIFYING"],
    ["IN_PROGRESS", "FAILED"],
    ["BLOCKED", "IN_PROGRESS"],
    ["BLOCKED", "FAILED"],
    ["VERIFYING", "COMPLETE"],
    ["VERIFYING", "IN_PROGRESS"],
    ["VERIFYING", "FAILED"],
  ];

  it.each(legalPairs)("allows %s -> %s", (from, to) => {
    expect(() => assertLegalPhaseTransition(from, to)).not.toThrow();
  });

  const illegalPairs: Array<[PhaseStatus, PhaseStatus]> = [
    ["NOT_STARTED", "COMPLETE"],
    ["NOT_STARTED", "VERIFYING"],
    ["COMPLETE", "IN_PROGRESS"],
    ["FAILED", "IN_PROGRESS"],
    ["IN_PROGRESS", "NOT_STARTED"],
    ["BLOCKED", "COMPLETE"],
    ["BLOCKED", "VERIFYING"],
    ["VERIFYING", "BLOCKED"],
  ];

  it.each(illegalPairs)("rejects %s -> %s", (from, to) => {
    expect(() => assertLegalPhaseTransition(from, to)).toThrow(IllegalPhaseTransitionError);
  });
});

describe("deriveMissionStatus", () => {
  it("returns NOT_STARTED for an empty phase list", () => {
    expect(deriveMissionStatus([])).toBe("NOT_STARTED");
  });

  it("returns NOT_STARTED when every phase is NOT_STARTED", () => {
    expect(deriveMissionStatus(["NOT_STARTED", "NOT_STARTED"])).toBe("NOT_STARTED");
  });

  it("returns COMPLETE when every phase is COMPLETE", () => {
    expect(deriveMissionStatus(["COMPLETE", "COMPLETE"])).toBe("COMPLETE");
  });

  it("returns FAILED when any phase is FAILED, even if others are COMPLETE", () => {
    expect(deriveMissionStatus(["COMPLETE", "FAILED"])).toBe("FAILED");
  });

  it("returns IN_PROGRESS when phases are mixed and none FAILED", () => {
    expect(deriveMissionStatus(["COMPLETE", "IN_PROGRESS"])).toBe("IN_PROGRESS");
    expect(deriveMissionStatus(["NOT_STARTED", "VERIFYING"])).toBe("IN_PROGRESS");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/autonomous/missionLoop.phaseStateMachine.test.ts`
Expected: FAIL — `phaseStateMachine` module not found.

- [ ] **Step 4: Implement `phaseStateMachine.ts`**

```typescript
// lib/autonomous/missionLoop/phaseStateMachine.ts
import type { MissionStatus, PhaseStatus } from "@/lib/autonomous/missionLoop/types";

export class IllegalPhaseTransitionError extends Error {
  readonly from: PhaseStatus;
  readonly to: PhaseStatus;

  constructor(from: PhaseStatus, to: PhaseStatus) {
    super(`Illegal phase transition: ${from} -> ${to}`);
    this.name = "IllegalPhaseTransitionError";
    this.from = from;
    this.to = to;
  }
}

const LEGAL_TRANSITIONS: Record<PhaseStatus, PhaseStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["BLOCKED", "VERIFYING", "FAILED"],
  BLOCKED: ["IN_PROGRESS", "FAILED"],
  VERIFYING: ["COMPLETE", "IN_PROGRESS", "FAILED"],
  COMPLETE: [],
  FAILED: [],
};

export function assertLegalPhaseTransition(from: PhaseStatus, to: PhaseStatus): void {
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw new IllegalPhaseTransitionError(from, to);
  }
}

export function deriveMissionStatus(phaseStatuses: PhaseStatus[]): MissionStatus {
  if (phaseStatuses.length === 0) return "NOT_STARTED";
  if (phaseStatuses.every((status) => status === "COMPLETE")) return "COMPLETE";
  if (phaseStatuses.some((status) => status === "FAILED")) return "FAILED";
  if (phaseStatuses.every((status) => status === "NOT_STARTED")) return "NOT_STARTED";
  return "IN_PROGRESS";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.phaseStateMachine.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 6: Commit**

```bash
git add lib/autonomous/missionLoop/types.ts lib/autonomous/missionLoop/phaseStateMachine.ts __tests__/autonomous/missionLoop.phaseStateMachine.test.ts
git commit -m "$(cat <<'EOF'
feat: add Manager Loop phase state machine

Pure legal-transition enforcement for WorkflowPhase.status plus
mission-level status derivation from aggregate phase state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 3: Repository layer (`missionRepository.ts`)

**Files:**
- Create: `lib/autonomous/missionLoop/missionRepository.ts`
- Test: `__tests__/autonomous/missionLoop.missionRepository.test.ts`

**Interfaces:**
- Consumes: `assertLegalPhaseTransition`, `deriveMissionStatus` (Task 2); `PhaseStatus`,
  `MissionStatus`, `ChecklistItemStatus`, `AcceptanceCriterion`, `PhaseInput`, `PhaseDetail`,
  `MissionDetail` (Task 2's `types.ts`).
- Produces: `createMission(input, db)`, `planPhases(missionId, phases, db)`,
  `getMissionDetail(missionId, db)`, `getPhaseDetail(phaseId, db)`, `listOpenMissions(db)`,
  `transitionPhase(phaseId, to, opts, db)`, `updateChecklistItem(itemId, status, evidenceRef,
  db)`, `writeCheckpoint(params, db)`, `recordPhaseDecision(params, db)` — every function's
  last parameter is a required `PrismaClient`-shaped `db` (no default, no hidden singleton
  import). Every CLI script (Tasks 5-8) calls these exact functions.

Every function accepts `db` as a plain object matching the Prisma model-client shape it uses
(`workflowRun`, `workflowPhase`, `workflowChecklistItem`, `workflowCheckpoint`,
`agentDecision`) — tests pass a hand-built fake object, no `vi.mock` needed for this module.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/autonomous/missionLoop.missionRepository.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMission,
  getMissionDetail,
  getPhaseDetail,
  listOpenMissions,
  planPhases,
  recordPhaseDecision,
  transitionPhase,
  updateChecklistItem,
  writeCheckpoint,
} from "@/lib/autonomous/missionLoop/missionRepository";
import { IllegalPhaseTransitionError } from "@/lib/autonomous/missionLoop/phaseStateMachine";

function makeFakeDb() {
  return {
    workflowRun: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    workflowPhase: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workflowChecklistItem: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workflowCheckpoint: {
      create: vi.fn(),
      count: vi.fn(),
    },
    agentDecision: {
      create: vi.fn(),
    },
  };
}

type FakeDb = ReturnType<typeof makeFakeDb>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createMission", () => {
  it("creates a WorkflowRun namespaced mission.<slug>", async () => {
    const db = makeFakeDb();
    db.workflowRun.create.mockResolvedValue({ id: "run-1" });
    const result = await createMission(
      { slug: "p7c-remediation", objective: "Finish stashed P7C work" },
      db as unknown as Parameters<typeof createMission>[1],
    );
    expect(result).toEqual({ id: "run-1" });
    expect(db.workflowRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowType: "mission.p7c-remediation",
          objective: "Finish stashed P7C work",
        }),
      }),
    );
  });
});

describe("planPhases", () => {
  it("creates phases in order with their checklist items", async () => {
    const db = makeFakeDb();
    db.workflowPhase.create
      .mockResolvedValueOnce({ id: "phase-1" })
      .mockResolvedValueOnce({ id: "phase-2" });
    db.workflowChecklistItem.create.mockResolvedValue({ id: "item-1" });
    const result = await planPhases(
      "run-1",
      [
        {
          sequence: 1,
          title: "Triage",
          objective: "Inventory the stashed work",
          acceptanceCriteria: [],
          checklist: [{ label: "Diff reviewed" }],
        },
        {
          sequence: 2,
          title: "Fix",
          objective: "Apply the fixes",
          acceptanceCriteria: [],
          checklist: [],
        },
      ],
      db as unknown as Parameters<typeof planPhases>[2],
    );
    expect(result.phaseIds).toEqual(["phase-1", "phase-2"]);
    expect(db.workflowChecklistItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workflowPhaseId: "phase-1", label: "Diff reviewed" }),
      }),
    );
  });
});

describe("getMissionDetail / getPhaseDetail", () => {
  it("returns null for a mission that does not exist", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue(null);
    const result = await getMissionDetail("missing", db as unknown as Parameters<typeof getMissionDetail>[1]);
    expect(result).toBeNull();
  });

  it("assembles a mission with its phases and checklist items, deriving mission status", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue({
      id: "run-1",
      objective: "Finish stashed P7C work",
      scope: null,
      constraints: null,
      acceptanceCriteria: [],
      dependsOnRunIds: [],
    });
    db.workflowPhase.findMany.mockResolvedValue([
      {
        id: "phase-1",
        workflowRunId: "run-1",
        sequence: 1,
        title: "Triage",
        objective: "Inventory",
        acceptanceCriteria: [],
        status: "COMPLETE",
        dependsOnPhaseIds: [],
        attempt: 1,
        lastProgressAt: null,
        blockedReason: null,
        startedAt: null,
        completedAt: null,
      },
    ]);
    db.workflowChecklistItem.findMany.mockResolvedValue([
      { id: "item-1", label: "Diff reviewed", required: true, status: "DONE", evidenceRef: null, completedAt: null },
    ]);
    const result = await getMissionDetail("run-1", db as unknown as Parameters<typeof getMissionDetail>[1]);
    expect(result?.status).toBe("COMPLETE");
    expect(result?.phases[0].checklist[0].label).toBe("Diff reviewed");
  });

  it("returns null for a phase that does not exist", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue(null);
    const result = await getPhaseDetail("missing", db as unknown as Parameters<typeof getPhaseDetail>[1]);
    expect(result).toBeNull();
  });
});

describe("transitionPhase", () => {
  it("increments attempt each time the phase enters IN_PROGRESS", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", status: "NOT_STARTED", attempt: 0, startedAt: null, completedAt: null });
    await transitionPhase("phase-1", "IN_PROGRESS", {}, db as unknown as Parameters<typeof transitionPhase>[3]);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IN_PROGRESS", attempt: 1 }) }),
    );
  });

  it("throws IllegalPhaseTransitionError and does not write when the transition is illegal", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", status: "COMPLETE", attempt: 1, startedAt: null, completedAt: null });
    await expect(
      transitionPhase("phase-1", "IN_PROGRESS", {}, db as unknown as Parameters<typeof transitionPhase>[3]),
    ).rejects.toBeInstanceOf(IllegalPhaseTransitionError);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });

  it("records blockedReason when transitioning to BLOCKED", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", status: "IN_PROGRESS", attempt: 1, startedAt: new Date(), completedAt: null });
    await transitionPhase("phase-1", "BLOCKED", { blockedReason: "waiting on DB access" }, db as unknown as Parameters<typeof transitionPhase>[3]);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED", blockedReason: "waiting on DB access" }) }),
    );
  });
});

describe("updateChecklistItem", () => {
  it("updates status and bumps the parent phase's lastProgressAt", async () => {
    const db = makeFakeDb();
    db.workflowChecklistItem.findUnique.mockResolvedValue({ id: "item-1", workflowPhaseId: "phase-1", status: "PENDING", evidenceRef: null });
    await updateChecklistItem("item-1", "DONE", { path: "evidence.json" }, db as unknown as Parameters<typeof updateChecklistItem>[3]);
    expect(db.workflowChecklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DONE" }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "phase-1" }, data: expect.objectContaining({ lastProgressAt: expect.any(Date) }) }),
    );
  });

  it("is a no-op (does not touch lastProgressAt) when status is unchanged", async () => {
    const db = makeFakeDb();
    db.workflowChecklistItem.findUnique.mockResolvedValue({ id: "item-1", workflowPhaseId: "phase-1", status: "DONE", evidenceRef: null });
    await updateChecklistItem("item-1", "DONE", null, db as unknown as Parameters<typeof updateChecklistItem>[3]);
    expect(db.workflowChecklistItem.update).not.toHaveBeenCalled();
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });
});

describe("writeCheckpoint", () => {
  it("computes the next sequence number and bumps lastProgressAt", async () => {
    const db = makeFakeDb();
    db.workflowCheckpoint.count.mockResolvedValue(2);
    db.workflowCheckpoint.create.mockResolvedValue({ id: "checkpoint-3" });
    const result = await writeCheckpoint(
      { phaseId: "phase-1", workflowRunId: "run-1", checkpointKey: "triage.complete" },
      db as unknown as Parameters<typeof writeCheckpoint>[1],
    );
    expect(result).toEqual({ id: "checkpoint-3" });
    expect(db.workflowCheckpoint.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sequence: 3 }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "phase-1" } }),
    );
  });
});

describe("recordPhaseDecision", () => {
  it("writes an AgentDecision with decisionType phase_acceptance", async () => {
    const db = makeFakeDb();
    db.agentDecision.create.mockResolvedValue({ id: "decision-1" });
    const result = await recordPhaseDecision(
      { phaseId: "phase-1", workflowRunId: "run-1", outcome: "ACCEPT" },
      db as unknown as Parameters<typeof recordPhaseDecision>[1],
    );
    expect(result).toEqual({ id: "decision-1" });
    expect(db.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decisionType: "phase_acceptance" }) }),
    );
  });
});

describe("listOpenMissions", () => {
  it("filters workflowType by the mission. prefix", async () => {
    const db = makeFakeDb();
    db.workflowRun.findMany.mockResolvedValue([{ id: "run-1" }]);
    db.workflowRun.findUnique.mockResolvedValue({
      id: "run-1",
      objective: "Finish stashed P7C work",
      scope: null,
      constraints: null,
      acceptanceCriteria: [],
      dependsOnRunIds: [],
    });
    db.workflowPhase.findMany.mockResolvedValue([]);
    const result = await listOpenMissions(db as unknown as Parameters<typeof listOpenMissions>[0]);
    expect(db.workflowRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workflowType: { startsWith: "mission." } } }),
    );
    expect(result).toEqual([{ id: "run-1", objective: "Finish stashed P7C work", status: "NOT_STARTED" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/autonomous/missionLoop.missionRepository.test.ts`
Expected: FAIL — `missionRepository` module not found.

- [ ] **Step 3: Implement `missionRepository.ts`**

```typescript
// lib/autonomous/missionLoop/missionRepository.ts
import type { PrismaClient } from "@prisma/client";
import {
  assertLegalPhaseTransition,
  deriveMissionStatus,
} from "@/lib/autonomous/missionLoop/phaseStateMachine";
import type {
  AcceptanceCriterion,
  ChecklistItemStatus,
  MissionDetail,
  MissionStatus,
  PhaseDetail,
  PhaseInput,
  PhaseStatus,
} from "@/lib/autonomous/missionLoop/types";

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toCriteria(value: unknown): AcceptanceCriterion[] {
  return Array.isArray(value) ? (value as AcceptanceCriterion[]) : [];
}

type RawPhase = {
  id: string;
  workflowRunId: string;
  sequence: number;
  title: string;
  objective: string;
  acceptanceCriteria: unknown;
  status: string;
  dependsOnPhaseIds: unknown;
  attempt: number;
  lastProgressAt: Date | null;
  blockedReason: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

type RawChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  status: string;
  evidenceRef: unknown;
  completedAt: Date | null;
};

function toPhaseDetail(phase: RawPhase, checklist: RawChecklistItem[]): PhaseDetail {
  return {
    id: phase.id,
    workflowRunId: phase.workflowRunId,
    sequence: phase.sequence,
    title: phase.title,
    objective: phase.objective,
    acceptanceCriteria: toCriteria(phase.acceptanceCriteria),
    status: phase.status as PhaseStatus,
    dependsOnPhaseIds: toStringArray(phase.dependsOnPhaseIds),
    attempt: phase.attempt,
    lastProgressAt: phase.lastProgressAt,
    blockedReason: phase.blockedReason,
    startedAt: phase.startedAt,
    completedAt: phase.completedAt,
    checklist: checklist.map((item) => ({
      id: item.id,
      label: item.label,
      required: item.required,
      status: item.status as ChecklistItemStatus,
      evidenceRef: item.evidenceRef,
      completedAt: item.completedAt,
    })),
  };
}

export async function createMission(
  input: {
    slug: string;
    objective: string;
    scope?: unknown;
    constraints?: unknown;
    acceptanceCriteria?: AcceptanceCriterion[];
    dependsOnRunIds?: string[];
  },
  db: PrismaClient,
): Promise<{ id: string }> {
  const traceId = `mission-${input.slug}-${Date.now()}`;
  const run = await db.workflowRun.create({
    data: {
      workflowType: `mission.${input.slug}`,
      partitionKey: `mission:${input.slug}`,
      traceId,
      correlationId: traceId,
      status: "pending",
      objective: input.objective,
      scope: input.scope ?? null,
      constraints: input.constraints ?? null,
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      dependsOnRunIds: input.dependsOnRunIds ?? [],
    },
  });
  return { id: run.id };
}

export async function planPhases(
  missionId: string,
  phases: PhaseInput[],
  db: PrismaClient,
): Promise<{ phaseIds: string[] }> {
  const phaseIds: string[] = [];
  for (const phase of phases) {
    const created = await db.workflowPhase.create({
      data: {
        workflowRunId: missionId,
        sequence: phase.sequence,
        title: phase.title,
        objective: phase.objective,
        acceptanceCriteria: phase.acceptanceCriteria,
        status: "NOT_STARTED",
        dependsOnPhaseIds: phase.dependsOnPhaseIds ?? [],
      },
    });
    phaseIds.push(created.id);
    for (const item of phase.checklist) {
      await db.workflowChecklistItem.create({
        data: {
          workflowPhaseId: created.id,
          label: item.label,
          required: item.required ?? true,
          status: "PENDING",
        },
      });
    }
  }
  return { phaseIds };
}

export async function getMissionDetail(missionId: string, db: PrismaClient): Promise<MissionDetail | null> {
  const run = await db.workflowRun.findUnique({ where: { id: missionId } });
  if (!run) return null;
  const phases = (await db.workflowPhase.findMany({
    where: { workflowRunId: missionId },
    orderBy: { sequence: "asc" },
  })) as RawPhase[];
  const phaseDetails: PhaseDetail[] = [];
  for (const phase of phases) {
    const checklist = (await db.workflowChecklistItem.findMany({
      where: { workflowPhaseId: phase.id },
      orderBy: { createdAt: "asc" },
    })) as RawChecklistItem[];
    phaseDetails.push(toPhaseDetail(phase, checklist));
  }
  return {
    id: run.id,
    objective: run.objective ?? "",
    scope: run.scope,
    constraints: run.constraints,
    acceptanceCriteria: toCriteria(run.acceptanceCriteria),
    dependsOnRunIds: toStringArray(run.dependsOnRunIds),
    status: deriveMissionStatus(phaseDetails.map((phase) => phase.status)),
    phases: phaseDetails,
  };
}

export async function getPhaseDetail(phaseId: string, db: PrismaClient): Promise<PhaseDetail | null> {
  const phase = (await db.workflowPhase.findUnique({ where: { id: phaseId } })) as RawPhase | null;
  if (!phase) return null;
  const checklist = (await db.workflowChecklistItem.findMany({
    where: { workflowPhaseId: phase.id },
    orderBy: { createdAt: "asc" },
  })) as RawChecklistItem[];
  return toPhaseDetail(phase, checklist);
}

export async function listOpenMissions(
  db: PrismaClient,
): Promise<Array<{ id: string; objective: string; status: MissionStatus }>> {
  const runs = await db.workflowRun.findMany({ where: { workflowType: { startsWith: "mission." } } });
  const result: Array<{ id: string; objective: string; status: MissionStatus }> = [];
  for (const run of runs) {
    const detail = await getMissionDetail(run.id, db);
    if (detail) result.push({ id: detail.id, objective: detail.objective, status: detail.status });
  }
  return result;
}

export async function transitionPhase(
  phaseId: string,
  to: PhaseStatus,
  opts: { blockedReason?: string },
  db: PrismaClient,
): Promise<void> {
  const phase = (await db.workflowPhase.findUnique({ where: { id: phaseId } })) as
    | { id: string; status: string; attempt: number; startedAt: Date | null; completedAt: Date | null }
    | null;
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const from = phase.status as PhaseStatus;
  assertLegalPhaseTransition(from, to);
  const now = new Date();
  await db.workflowPhase.update({
    where: { id: phaseId },
    data: {
      status: to,
      attempt: to === "IN_PROGRESS" ? phase.attempt + 1 : phase.attempt,
      blockedReason: to === "BLOCKED" ? opts.blockedReason ?? null : null,
      startedAt: to === "IN_PROGRESS" && !phase.startedAt ? now : phase.startedAt,
      completedAt: to === "COMPLETE" || to === "FAILED" ? now : phase.completedAt,
    },
  });
}

export async function updateChecklistItem(
  itemId: string,
  status: ChecklistItemStatus,
  evidenceRef: unknown,
  db: PrismaClient,
): Promise<void> {
  const item = (await db.workflowChecklistItem.findUnique({ where: { id: itemId } })) as
    | { id: string; workflowPhaseId: string; status: string; evidenceRef: unknown }
    | null;
  if (!item) throw new Error(`Checklist item not found: ${itemId}`);
  if (item.status === status) return;
  await db.workflowChecklistItem.update({
    where: { id: itemId },
    data: {
      status,
      evidenceRef: evidenceRef ?? item.evidenceRef,
      completedAt: status === "DONE" || status === "SKIPPED" ? new Date() : null,
    },
  });
  await db.workflowPhase.update({
    where: { id: item.workflowPhaseId },
    data: { lastProgressAt: new Date() },
  });
}

export async function writeCheckpoint(
  params: {
    phaseId: string;
    workflowRunId: string;
    checkpointKey: string;
    state?: unknown;
    evidenceRefs?: unknown;
  },
  db: PrismaClient,
): Promise<{ id: string }> {
  const existingCount = await db.workflowCheckpoint.count({ where: { workflowRunId: params.workflowRunId } });
  const checkpoint = await db.workflowCheckpoint.create({
    data: {
      workflowRunId: params.workflowRunId,
      checkpointKey: params.checkpointKey,
      sequence: existingCount + 1,
      state: params.state ?? null,
      evidenceRefs: params.evidenceRefs ?? null,
    },
  });
  await db.workflowPhase.update({
    where: { id: params.phaseId },
    data: { lastProgressAt: new Date() },
  });
  return { id: checkpoint.id };
}

export async function recordPhaseDecision(
  params: {
    phaseId: string;
    workflowRunId: string;
    outcome: "ACCEPT" | "REJECT" | "BLOCK";
    reason?: string;
    evidenceRefs?: unknown;
  },
  db: PrismaClient,
): Promise<{ id: string }> {
  const decision = await db.agentDecision.create({
    data: {
      workflowRunId: params.workflowRunId,
      decisionType: "phase_acceptance",
      status: params.outcome === "ACCEPT" ? "accepted" : params.outcome === "REJECT" ? "rejected" : "blocked",
      decision: { phaseId: params.phaseId, outcome: params.outcome, reason: params.reason ?? null },
      evidenceRefs: params.evidenceRefs ?? null,
    },
  });
  return { id: decision.id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.missionRepository.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/autonomous/missionLoop/missionRepository.ts __tests__/autonomous/missionLoop.missionRepository.test.ts
git commit -m "$(cat <<'EOF'
feat: add Manager Loop mission repository layer

Dependency-injected PrismaClient throughout - no hidden singleton
import - so every function is directly testable with a fake db.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 4: Gate evaluation (`gateEvaluation.ts`)

**Files:**
- Create: `lib/autonomous/missionLoop/gateEvaluation.ts`
- Test: `__tests__/autonomous/missionLoop.gateEvaluation.test.ts`

**Interfaces:**
- Consumes: `AcceptanceCriterion`, `CriterionResult` (Task 2's `types.ts`).
- Produces: `CommandRunner` type, `defaultCommandRunner(command): {exitCode, output}`,
  `evaluateAcceptanceCriteria(criteria, db, runCommand?): Promise<{passed, results}>`. Tasks 8
  and 13 call `evaluateAcceptanceCriteria`.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/autonomous/missionLoop.gateEvaluation.test.ts
import { describe, expect, it, vi } from "vitest";
import { evaluateAcceptanceCriteria } from "@/lib/autonomous/missionLoop/gateEvaluation";
import type { AcceptanceCriterion } from "@/lib/autonomous/missionLoop/types";

function makeFakeDb() {
  return {
    approvalRequest: { findUnique: vi.fn() },
    qualityReviewTask: { findUnique: vi.fn() },
  };
}

describe("evaluateAcceptanceCriteria — command", () => {
  it("passes when the command exits 0", async () => {
    const criteria: AcceptanceCriterion[] = [{ type: "command", label: "tests", command: "true" }];
    const runCommand = vi.fn().mockReturnValue({ exitCode: 0, output: "ok" });
    const result = await evaluateAcceptanceCriteria(criteria, makeFakeDb() as any, runCommand);
    expect(result.passed).toBe(true);
    expect(runCommand).toHaveBeenCalledWith("true");
  });

  it("fails when the command exits nonzero", async () => {
    const criteria: AcceptanceCriterion[] = [{ type: "command", label: "tests", command: "false" }];
    const runCommand = vi.fn().mockReturnValue({ exitCode: 1, output: "boom" });
    const result = await evaluateAcceptanceCriteria(criteria, makeFakeDb() as any, runCommand);
    expect(result.passed).toBe(false);
    expect(result.results[0].detail).toContain("boom");
  });
});

describe("evaluateAcceptanceCriteria — approval_resolved", () => {
  it("passes only when ApprovalRequest.status is APPROVED", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue({ status: "APPROVED" });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "approval_resolved", approvalRequestId: "approval-1" }],
      db as any,
    );
    expect(result.passed).toBe(true);
  });

  it("fails when the approval is still PENDING", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue({ status: "PENDING" });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "approval_resolved", approvalRequestId: "approval-1" }],
      db as any,
    );
    expect(result.passed).toBe(false);
  });

  it("fails when the approval does not exist", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue(null);
    const result = await evaluateAcceptanceCriteria(
      [{ type: "approval_resolved", approvalRequestId: "missing" }],
      db as any,
    );
    expect(result.passed).toBe(false);
  });
});

describe("evaluateAcceptanceCriteria — review_task_resolved", () => {
  it("passes only when status is DECIDED and outcome is PASS", async () => {
    const db = makeFakeDb();
    db.qualityReviewTask.findUnique.mockResolvedValue({ status: "DECIDED", assessment: { outcome: "PASS" } });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "review_task_resolved", qualityReviewTaskId: "task-1" }],
      db as any,
    );
    expect(result.passed).toBe(true);
  });

  it("fails when the outcome is FAIL", async () => {
    const db = makeFakeDb();
    db.qualityReviewTask.findUnique.mockResolvedValue({ status: "DECIDED", assessment: { outcome: "FAIL" } });
    const result = await evaluateAcceptanceCriteria(
      [{ type: "review_task_resolved", qualityReviewTaskId: "task-1" }],
      db as any,
    );
    expect(result.passed).toBe(false);
  });
});

describe("evaluateAcceptanceCriteria — multiple criteria", () => {
  it("passes only when every criterion passes", async () => {
    const db = makeFakeDb();
    db.approvalRequest.findUnique.mockResolvedValue({ status: "APPROVED" });
    const runCommand = vi.fn().mockReturnValue({ exitCode: 1, output: "fail" });
    const result = await evaluateAcceptanceCriteria(
      [
        { type: "approval_resolved", approvalRequestId: "approval-1" },
        { type: "command", label: "build", command: "npm run build" },
      ],
      db as any,
      runCommand,
    );
    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/autonomous/missionLoop.gateEvaluation.test.ts`
Expected: FAIL — `gateEvaluation` module not found.

- [ ] **Step 3: Implement `gateEvaluation.ts`**

```typescript
// lib/autonomous/missionLoop/gateEvaluation.ts
import { execSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";
import type { AcceptanceCriterion, CriterionResult } from "@/lib/autonomous/missionLoop/types";

export type CommandRunner = (command: string) => { exitCode: number; output: string };

export function defaultCommandRunner(command: string): { exitCode: number; output: string } {
  try {
    const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { exitCode: 0, output };
  } catch (error) {
    const execError = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const output = `${execError.stdout ?? ""}${execError.stderr ?? ""}`;
    return { exitCode: execError.status ?? 1, output };
  }
}

async function evaluateOne(
  criterion: AcceptanceCriterion,
  db: PrismaClient,
  runCommand: CommandRunner,
): Promise<CriterionResult> {
  if (criterion.type === "command") {
    const { exitCode, output } = runCommand(criterion.command);
    return {
      criterion,
      passed: exitCode === 0,
      detail:
        exitCode === 0
          ? `"${criterion.label}" passed`
          : `"${criterion.label}" failed (exit ${exitCode}): ${output.slice(-500)}`,
    };
  }
  if (criterion.type === "approval_resolved") {
    const approval = await db.approvalRequest.findUnique({ where: { id: criterion.approvalRequestId } });
    const passed = approval?.status === "APPROVED";
    return {
      criterion,
      passed,
      detail: approval
        ? `ApprovalRequest ${criterion.approvalRequestId} status is ${approval.status}`
        : `ApprovalRequest ${criterion.approvalRequestId} not found`,
    };
  }
  const task = await db.qualityReviewTask.findUnique({
    where: { id: criterion.qualityReviewTaskId },
    include: { assessment: true },
  });
  const passed = task?.status === "DECIDED" && task.assessment?.outcome === "PASS";
  return {
    criterion,
    passed,
    detail: task
      ? `QualityReviewTask ${criterion.qualityReviewTaskId} status ${task.status}, outcome ${task.assessment?.outcome ?? "none"}`
      : `QualityReviewTask ${criterion.qualityReviewTaskId} not found`,
  };
}

export async function evaluateAcceptanceCriteria(
  criteria: AcceptanceCriterion[],
  db: PrismaClient,
  runCommand: CommandRunner = defaultCommandRunner,
): Promise<{ passed: boolean; results: CriterionResult[] }> {
  const results: CriterionResult[] = [];
  for (const criterion of criteria) {
    results.push(await evaluateOne(criterion, db, runCommand));
  }
  return { passed: results.every((result) => result.passed), results };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.gateEvaluation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/autonomous/missionLoop/gateEvaluation.ts __tests__/autonomous/missionLoop.gateEvaluation.test.ts
git commit -m "$(cat <<'EOF'
feat: add Manager Loop gate evaluation (live re-derivation, not self-report)

command criteria re-run the named check live; approval_resolved and
review_task_resolved read the actual ApprovalRequest/QualityReviewTask
state. No criterion type trusts a stored claim of "this passed."

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 5: `create-mission.ts` + `plan-phases.ts`

**Files:**
- Create: `scripts/manager-loop/create-mission.ts`
- Create: `scripts/manager-loop/plan-phases.ts`
- Test: `__tests__/autonomous/missionLoop.createPlan.test.ts`

**Interfaces:**
- Consumes: `createMission`, `planPhases` (Task 3).
- Produces: exported `main(argv: string[], prisma: PrismaClient): Promise<void>` from each
  script, called by the `require.main === module` block with a real `PrismaClient` and by
  tests with a fake one.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/autonomous/missionLoop.createPlan.test.ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main as createMissionMain } from "@/scripts/manager-loop/create-mission";
import { main as planPhasesMain } from "@/scripts/manager-loop/plan-phases";

function makeFakeDb() {
  return {
    workflowRun: { create: vi.fn() },
    workflowPhase: { create: vi.fn() },
    workflowChecklistItem: { create: vi.fn() },
  };
}

describe("create-mission.ts main()", () => {
  it("creates a mission from --slug and --objective", async () => {
    const db = makeFakeDb();
    db.workflowRun.create.mockResolvedValue({ id: "run-1" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createMissionMain(["--slug", "p7c-remediation", "--objective", "Finish stashed work"], db as any);
    expect(db.workflowRun.create).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("run-1"));
    logSpy.mockRestore();
  });

  it("throws a usage error when required flags are missing", async () => {
    const db = makeFakeDb();
    await expect(createMissionMain([], db as any)).rejects.toThrow(/Usage/);
  });
});

describe("plan-phases.ts main()", () => {
  it("reads a phases JSON file and persists phases + checklist", async () => {
    const db = makeFakeDb();
    db.workflowPhase.create.mockResolvedValue({ id: "phase-1" });
    const dir = mkdtempSync(join(tmpdir(), "manager-loop-test-"));
    const phasesFile = join(dir, "phases.json");
    writeFileSync(
      phasesFile,
      JSON.stringify([
        { sequence: 1, title: "Triage", objective: "Inventory", acceptanceCriteria: [], checklist: [{ label: "Diff reviewed" }] },
      ]),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await planPhasesMain(["--mission", "run-1", "--phases-file", phasesFile], db as any);
    expect(db.workflowPhase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workflowRunId: "run-1", title: "Triage" }) }),
    );
    logSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/autonomous/missionLoop.createPlan.test.ts`
Expected: FAIL — scripts not found.

- [ ] **Step 3: Implement `create-mission.ts`**

```typescript
// scripts/manager-loop/create-mission.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { createMission } from "@/lib/autonomous/missionLoop/missionRepository";
import type { AcceptanceCriterion } from "@/lib/autonomous/missionLoop/types";

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      args.set(token.slice(2), argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const args = parseArgs(argv);
  const slug = args.get("slug");
  const objective = args.get("objective");
  if (!slug || !objective) {
    throw new Error(
      'Usage: create-mission.ts --slug <slug> --objective "<text>" [--scope <json>] [--constraints <json>] [--acceptance-criteria <json>]',
    );
  }
  const scope = args.has("scope") ? JSON.parse(args.get("scope")!) : undefined;
  const constraints = args.has("constraints") ? JSON.parse(args.get("constraints")!) : undefined;
  const acceptanceCriteria: AcceptanceCriterion[] | undefined = args.has("acceptance-criteria")
    ? JSON.parse(args.get("acceptance-criteria")!)
    : undefined;
  const result = await createMission({ slug, objective, scope, constraints, acceptanceCriteria }, prisma);
  console.log(`Created mission ${result.id} (workflowType mission.${slug})`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 4: Implement `plan-phases.ts`**

```typescript
// scripts/manager-loop/plan-phases.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { planPhases } from "@/lib/autonomous/missionLoop/missionRepository";
import type { PhaseInput } from "@/lib/autonomous/missionLoop/types";

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      args.set(token.slice(2), argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const args = parseArgs(argv);
  const missionId = args.get("mission");
  const phasesFile = args.get("phases-file");
  if (!missionId || !phasesFile) {
    throw new Error("Usage: plan-phases.ts --mission <id> --phases-file <path-to-json>");
  }
  const phases = JSON.parse(readFileSync(phasesFile, "utf8")) as PhaseInput[];
  const result = await planPhases(missionId, phases, prisma);
  console.log(`Created ${result.phaseIds.length} phase(s): ${result.phaseIds.join(", ")}`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.createPlan.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/manager-loop/create-mission.ts scripts/manager-loop/plan-phases.ts __tests__/autonomous/missionLoop.createPlan.test.ts
git commit -m "$(cat <<'EOF'
feat: add Manager Loop create-mission and plan-phases CLI scripts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 6: `dispatch-phase.ts` + `status.ts`

**Files:**
- Create: `scripts/manager-loop/dispatch-phase.ts`
- Create: `scripts/manager-loop/status.ts`
- Test: `__tests__/autonomous/missionLoop.dispatchStatus.test.ts`

**Interfaces:**
- Consumes: `getMissionDetail`, `getPhaseDetail`, `listOpenMissions`, `transitionPhase` (Task 3).
- Produces: exported `main(argv, prisma)` from each script (same pattern as Task 5). `status.ts`
  is read-only — it never calls `transitionPhase` or any other mutating repository function.

`dispatch-phase.ts` only auto-transitions a `NOT_STARTED` phase to `IN_PROGRESS`. It does not
attempt to un-block a `BLOCKED` phase — that is a deliberate retry decision, explicitly out of
scope for Sub-project 1 (owned by the future stall controller). Calling it against any other
status just re-prints the brief.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/autonomous/missionLoop.dispatchStatus.test.ts
import { describe, expect, it, vi } from "vitest";
import { main as dispatchPhaseMain } from "@/scripts/manager-loop/dispatch-phase";
import { main as statusMain } from "@/scripts/manager-loop/status";

const phaseNotStarted = {
  id: "phase-1",
  workflowRunId: "run-1",
  sequence: 1,
  title: "Triage",
  objective: "Inventory the stashed work",
  acceptanceCriteria: [{ type: "command", label: "tests", command: "true" }],
  status: "NOT_STARTED",
  dependsOnPhaseIds: [],
  attempt: 0,
  lastProgressAt: null,
  blockedReason: null,
  startedAt: null,
  completedAt: null,
  checklist: [{ id: "item-1", label: "Diff reviewed", required: true, status: "PENDING", evidenceRef: null, completedAt: null }],
};

const mission = {
  id: "run-1",
  objective: "Finish stashed P7C work",
  scope: null,
  constraints: null,
  acceptanceCriteria: [],
  dependsOnRunIds: [],
  status: "IN_PROGRESS",
  phases: [phaseNotStarted],
};

function makeFakeDb() {
  return {
    workflowRun: { findUnique: vi.fn(), findMany: vi.fn() },
    workflowPhase: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    workflowChecklistItem: { findMany: vi.fn() },
  };
}

describe("dispatch-phase.ts main()", () => {
  it("transitions a NOT_STARTED phase to IN_PROGRESS and prints the brief", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue(phaseNotStarted);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await dispatchPhaseMain(["phase-1"], db as any);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IN_PROGRESS" }) }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Triage"));
    logSpy.mockRestore();
  });

  it("does not transition a BLOCKED phase", async () => {
    const blocked = { ...phaseNotStarted, status: "BLOCKED", blockedReason: "waiting" };
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue(blocked);
    db.workflowChecklistItem.findMany.mockResolvedValue(blocked.checklist);
    db.workflowRun.findUnique.mockResolvedValue(mission);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await dispatchPhaseMain(["phase-1"], db as any);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

describe("status.ts main()", () => {
  it("prints mission list when no missionId is given", async () => {
    const db = makeFakeDb();
    db.workflowRun.findMany.mockResolvedValue([{ id: "run-1" }]);
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await statusMain([], db as any);
    expect(db.workflowRun.findMany).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("prints full mission detail including the exact next action for a NOT_STARTED phase", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await statusMain(["run-1"], db as any);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("dispatch-phase.ts phase-1"));
    logSpy.mockRestore();
  });

  it("never calls any mutating repository function", async () => {
    const db = makeFakeDb();
    db.workflowRun.findUnique.mockResolvedValue(mission);
    db.workflowPhase.findMany.mockResolvedValue([phaseNotStarted]);
    db.workflowChecklistItem.findMany.mockResolvedValue(phaseNotStarted.checklist);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await statusMain(["run-1", "--json"], db as any);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/autonomous/missionLoop.dispatchStatus.test.ts`
Expected: FAIL — scripts not found.

- [ ] **Step 3: Implement `dispatch-phase.ts`**

```typescript
// scripts/manager-loop/dispatch-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getMissionDetail, getPhaseDetail, transitionPhase } from "@/lib/autonomous/missionLoop/missionRepository";
import type { MissionDetail, PhaseDetail } from "@/lib/autonomous/missionLoop/types";

const GOVERNING_AUTHORITIES = [
  "governedMeasurement (lib/measurement/governedMeasurement.ts)",
  "controlledExperiment (lib/experiments/controlledExperiment.ts)",
  "qualityOperations (lib/experiments/qualityOperations.ts)",
  "releaseGate (lib/quality/releaseGate.ts)",
  "calibration (lib/quality/calibration.ts)",
  "fixtureRegistry (lib/quality/fixtureRegistry.ts)",
  "reviewTasks (lib/quality/reviewTasks.ts)",
  "RBAC, tenant isolation, audit logging, cost controls (never weaken to pass a gate)",
];

function renderBrief(mission: MissionDetail, phase: PhaseDetail): string {
  const lines: string[] = [];
  lines.push(`=== Phase brief: ${phase.title} ===`);
  lines.push(`Mission objective: ${mission.objective}`);
  if (mission.scope) lines.push(`Mission scope: ${JSON.stringify(mission.scope)}`);
  if (mission.constraints) lines.push(`Mission constraints: ${JSON.stringify(mission.constraints)}`);
  lines.push(`Phase objective: ${phase.objective}`);
  lines.push(`Depends on phases: ${phase.dependsOnPhaseIds.length ? phase.dependsOnPhaseIds.join(", ") : "none"}`);
  lines.push("Acceptance criteria:");
  for (const criterion of phase.acceptanceCriteria) lines.push(`  - ${JSON.stringify(criterion)}`);
  lines.push("Checklist:");
  for (const item of phase.checklist) {
    lines.push(`  - [${item.status}] ${item.label}${item.required ? "" : " (optional)"}`);
  }
  lines.push("Governing authorities (never bypass, never self-authorize around a blocking result):");
  for (const authority of GOVERNING_AUTHORITIES) lines.push(`  - ${authority}`);
  lines.push("");
  lines.push("Complete this phase completely and extremely well. Work autonomously until every");
  lines.push("required checklist item and acceptance criterion is satisfied. Stay within this");
  lines.push("phase's scope unless another change is strictly required to satisfy it. When ready,");
  lines.push(`run: tsx scripts/manager-loop/report-phase.ts ${phase.id} --status VERIFYING --evidence <path-to-json>`);
  return lines.join("\n");
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const phaseId = argv[0];
  if (!phaseId) throw new Error("Usage: dispatch-phase.ts <phaseId>");
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const mission = await getMissionDetail(phase.workflowRunId, prisma);
  if (!mission) throw new Error(`Mission not found: ${phase.workflowRunId}`);
  if (phase.status === "NOT_STARTED") {
    await transitionPhase(phaseId, "IN_PROGRESS", {}, prisma);
  }
  console.log(renderBrief(mission, phase));
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 4: Implement `status.ts`**

```typescript
// scripts/manager-loop/status.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getMissionDetail, listOpenMissions } from "@/lib/autonomous/missionLoop/missionRepository";
import type { MissionDetail } from "@/lib/autonomous/missionLoop/types";

function findNextAction(mission: MissionDetail): string {
  const blockedPhase = mission.phases.find((phase) => phase.status === "BLOCKED");
  if (blockedPhase) return `Phase "${blockedPhase.title}" is BLOCKED: ${blockedPhase.blockedReason ?? "no reason recorded"}`;
  const verifyingPhase = mission.phases.find((phase) => phase.status === "VERIFYING");
  if (verifyingPhase) return `Phase "${verifyingPhase.title}" is awaiting Manager review: tsx scripts/manager-loop/review-phase.ts ${verifyingPhase.id}`;
  const inProgressPhase = mission.phases.find((phase) => phase.status === "IN_PROGRESS");
  if (inProgressPhase) return `Phase "${inProgressPhase.title}" is in progress: tsx scripts/manager-loop/dispatch-phase.ts ${inProgressPhase.id}`;
  const nextPhase = mission.phases.find((phase) => phase.status === "NOT_STARTED");
  if (nextPhase) return `Next: tsx scripts/manager-loop/dispatch-phase.ts ${nextPhase.id} ("${nextPhase.title}")`;
  if (mission.status === "COMPLETE") return "Mission complete.";
  return "No phase is ready; check dependsOnPhaseIds for the remaining NOT_STARTED phases.";
}

function formatMission(mission: MissionDetail): string {
  const lines: string[] = [];
  lines.push(`Mission ${mission.id}: ${mission.objective}`);
  lines.push(`Status: ${mission.status}`);
  for (const phase of mission.phases) {
    lines.push(
      `  Phase ${phase.sequence} [${phase.status}] ${phase.title} (attempt ${phase.attempt}, last progress ${phase.lastProgressAt?.toISOString() ?? "never"})`,
    );
    for (const item of phase.checklist) {
      lines.push(`    - [${item.status}] ${item.label}`);
    }
  }
  lines.push(`Next action: ${findNextAction(mission)}`);
  return lines.join("\n");
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const asJson = argv.includes("--json");
  const missionId = argv.find((token) => !token.startsWith("--"));
  if (!missionId) {
    const missions = await listOpenMissions(prisma);
    console.log(
      asJson
        ? JSON.stringify(missions, null, 2)
        : missions.map((mission) => `${mission.id} [${mission.status}] ${mission.objective}`).join("\n"),
    );
    return;
  }
  const mission = await getMissionDetail(missionId, prisma);
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  console.log(asJson ? JSON.stringify(mission, null, 2) : formatMission(mission));
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.dispatchStatus.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/manager-loop/dispatch-phase.ts scripts/manager-loop/status.ts __tests__/autonomous/missionLoop.dispatchStatus.test.ts
git commit -m "$(cat <<'EOF'
feat: add Manager Loop dispatch-phase and status CLI scripts

status.ts is read-only by construction (asserted in tests) - it is
the resume mechanism a fresh session uses to reconstruct mission
state with no prior chat transcript.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 7: `report-phase.ts`

**Files:**
- Create: `scripts/manager-loop/report-phase.ts`
- Test: `__tests__/autonomous/missionLoop.reportPhase.test.ts`

**Interfaces:**
- Consumes: `getPhaseDetail`, `transitionPhase`, `updateChecklistItem`, `writeCheckpoint` (Task 3).
- Produces: exported `main(argv, prisma)`.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/autonomous/missionLoop.reportPhase.test.ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { main as reportPhaseMain } from "@/scripts/manager-loop/report-phase";

function makeFakeDb() {
  return {
    workflowPhase: { findUnique: vi.fn(), update: vi.fn() },
    workflowChecklistItem: { findUnique: vi.fn(), update: vi.fn() },
    workflowCheckpoint: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({ id: "checkpoint-1" }) },
  };
}

function writeEvidenceFile(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "manager-loop-test-"));
  const path = join(dir, "evidence.json");
  writeFileSync(path, JSON.stringify(content));
  return path;
}

describe("report-phase.ts main()", () => {
  it("updates checklist items, writes a checkpoint, and moves the phase to VERIFYING", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", workflowRunId: "run-1", status: "IN_PROGRESS", attempt: 1, startedAt: new Date(), completedAt: null });
    db.workflowChecklistItem.findUnique.mockResolvedValue({ id: "item-1", workflowPhaseId: "phase-1", status: "PENDING", evidenceRef: null });
    const evidencePath = writeEvidenceFile({
      checklist: [{ itemId: "item-1", status: "DONE", evidenceRef: { path: "stash-inventory.md" } }],
      checkpointKey: "triage.complete",
      state: { insight: "two threads found, one broken" },
    });
    await reportPhaseMain(["phase-1", "--status", "VERIFYING", "--evidence", evidencePath], db as any);
    expect(db.workflowChecklistItem.update).toHaveBeenCalled();
    expect(db.workflowCheckpoint.create).toHaveBeenCalled();
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "VERIFYING" }) }),
    );
  });

  it("rejects a --status value other than VERIFYING or BLOCKED", async () => {
    const db = makeFakeDb();
    const evidencePath = writeEvidenceFile({ checkpointKey: "x" });
    await expect(
      reportPhaseMain(["phase-1", "--status", "COMPLETE", "--evidence", evidencePath], db as any),
    ).rejects.toThrow(/may only set VERIFYING or BLOCKED/);
  });

  it("records blockedReason when reporting BLOCKED", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({ id: "phase-1", workflowRunId: "run-1", status: "IN_PROGRESS", attempt: 1, startedAt: new Date(), completedAt: null });
    const evidencePath = writeEvidenceFile({ checkpointKey: "x", blockedReason: "missing lib/ops/operationalSnapshot.ts" });
    await reportPhaseMain(["phase-1", "--status", "BLOCKED", "--evidence", evidencePath], db as any);
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED", blockedReason: "missing lib/ops/operationalSnapshot.ts" }) }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/autonomous/missionLoop.reportPhase.test.ts`
Expected: FAIL — script not found.

- [ ] **Step 3: Implement `report-phase.ts`**

```typescript
// scripts/manager-loop/report-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  getPhaseDetail,
  transitionPhase,
  updateChecklistItem,
  writeCheckpoint,
} from "@/lib/autonomous/missionLoop/missionRepository";
import type { ChecklistItemStatus, PhaseStatus } from "@/lib/autonomous/missionLoop/types";

type EvidenceFile = {
  checklist?: Array<{ itemId: string; status: ChecklistItemStatus; evidenceRef?: unknown }>;
  checkpointKey: string;
  state?: unknown;
  evidenceRefs?: unknown;
  blockedReason?: string;
};

function parseArgs(argv: string[]): { args: Map<string, string>; positionals: string[] } {
  const args = new Map<string, string>();
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      args.set(token.slice(2), argv[i + 1]);
      i += 1;
    } else {
      positionals.push(token);
    }
  }
  return { args, positionals };
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const { args, positionals } = parseArgs(argv);
  const phaseId = positionals[0];
  const status = args.get("status") as PhaseStatus | undefined;
  const evidencePath = args.get("evidence");
  if (!phaseId || !status || !evidencePath) {
    throw new Error("Usage: report-phase.ts <phaseId> --status VERIFYING|BLOCKED --evidence <path-to-json>");
  }
  if (status !== "VERIFYING" && status !== "BLOCKED") {
    throw new Error(`report-phase.ts may only set VERIFYING or BLOCKED, got ${status}`);
  }
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as EvidenceFile;
  for (const item of evidence.checklist ?? []) {
    await updateChecklistItem(item.itemId, item.status, item.evidenceRef, prisma);
  }
  await writeCheckpoint(
    {
      phaseId,
      workflowRunId: phase.workflowRunId,
      checkpointKey: evidence.checkpointKey,
      state: evidence.state,
      evidenceRefs: evidence.evidenceRefs,
    },
    prisma,
  );
  await transitionPhase(
    phaseId,
    status,
    status === "BLOCKED" ? { blockedReason: evidence.blockedReason ?? "blocked" } : {},
    prisma,
  );
  console.log(`Phase ${phaseId} reported as ${status}.`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.reportPhase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/manager-loop/report-phase.ts __tests__/autonomous/missionLoop.reportPhase.test.ts
git commit -m "$(cat <<'EOF'
feat: add Manager Loop report-phase CLI script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 8: `review-phase.ts` + `accept-phase.ts` + `reject-phase.ts`

**Files:**
- Create: `scripts/manager-loop/review-phase.ts`
- Create: `scripts/manager-loop/accept-phase.ts`
- Create: `scripts/manager-loop/reject-phase.ts`
- Test: `__tests__/autonomous/missionLoop.reviewAcceptReject.test.ts`

**Interfaces:**
- Consumes: `getPhaseDetail`, `recordPhaseDecision`, `transitionPhase` (Task 3);
  `evaluateAcceptanceCriteria` (Task 4).
- Produces: exported `main(argv, prisma)` from each. `accept-phase.ts` re-derives gate
  verdicts itself (does not trust an earlier `review-phase.ts` run) — this is the concrete
  test for "Manager Loop cannot self-authorize around a blocking gate."

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/autonomous/missionLoop.reviewAcceptReject.test.ts
import { describe, expect, it, vi } from "vitest";
import { main as reviewPhaseMain } from "@/scripts/manager-loop/review-phase";
import { main as acceptPhaseMain } from "@/scripts/manager-loop/accept-phase";
import { main as rejectPhaseMain } from "@/scripts/manager-loop/reject-phase";

const doneChecklist = [{ id: "item-1", label: "Diff reviewed", required: true, status: "DONE", evidenceRef: null, completedAt: new Date() }];

function makeFakeDb() {
  return {
    workflowPhase: { findUnique: vi.fn(), update: vi.fn() },
    workflowChecklistItem: { findMany: vi.fn().mockResolvedValue(doneChecklist) },
    agentDecision: { create: vi.fn().mockResolvedValue({ id: "decision-1" }) },
    approvalRequest: { findUnique: vi.fn() },
    qualityReviewTask: { findUnique: vi.fn() },
  };
}

describe("review-phase.ts main()", () => {
  it("reports READY TO ACCEPT when the phase is VERIFYING, checklist complete, and gate passes", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      // node -e is used instead of a POSIX builtin (true/false) so this runs
      // identically on Windows (execSync's default shell is cmd.exe there,
      // which has no "true" command) and on Linux CI.
      acceptanceCriteria: [{ type: "command", label: "tests", command: 'node -e "process.exit(0)"' }],
      status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1, lastProgressAt: new Date(),
      blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const result = await reviewPhaseMain(["phase-1"], db as any);
    expect(result.readyToAccept).toBe(true);
    logSpy.mockRestore();
  });
});

describe("accept-phase.ts main() — the gate-block test", () => {
  it("refuses to accept when a required checklist item is incomplete, even if the phase says VERIFYING", async () => {
    const db = makeFakeDb();
    db.workflowChecklistItem.findMany.mockResolvedValue([{ ...doneChecklist[0], status: "PENDING" }]);
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [], status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1,
      lastProgressAt: new Date(), blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await expect(acceptPhaseMain(["phase-1"], db as any)).rejects.toThrow(/required checklist item/);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });

  it("refuses to accept when a named acceptance-criterion command fails live, even with checklist complete", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [{ type: "command", label: "tsc", command: 'node -e "process.exit(1)"' }],
      status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1, lastProgressAt: new Date(),
      blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await expect(acceptPhaseMain(["phase-1"], db as any)).rejects.toThrow(/acceptance criteria failed/);
    expect(db.workflowPhase.update).not.toHaveBeenCalled();
  });

  it("accepts and marks COMPLETE when checklist is done and every criterion passes", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [{ type: "command", label: "tests", command: 'node -e "process.exit(0)"' }],
      status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1, lastProgressAt: new Date(),
      blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await acceptPhaseMain(["phase-1"], db as any);
    expect(db.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decisionType: "phase_acceptance" }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETE" }) }),
    );
  });

  it("refuses to accept a phase that is not VERIFYING", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [], status: "IN_PROGRESS", dependsOnPhaseIds: [], attempt: 1,
      lastProgressAt: new Date(), blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await expect(acceptPhaseMain(["phase-1"], db as any)).rejects.toThrow(/not VERIFYING/);
  });
});

describe("reject-phase.ts main()", () => {
  it("records a REJECT decision and returns the phase to IN_PROGRESS", async () => {
    const db = makeFakeDb();
    db.workflowPhase.findUnique.mockResolvedValue({
      id: "phase-1", workflowRunId: "run-1", sequence: 1, title: "Triage", objective: "x",
      acceptanceCriteria: [], status: "VERIFYING", dependsOnPhaseIds: [], attempt: 1,
      lastProgressAt: new Date(), blockedReason: null, startedAt: new Date(), completedAt: null,
    });
    await rejectPhaseMain(["phase-1", "--reason", "checklist evidence is thin"], db as any);
    expect(db.agentDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decisionType: "phase_acceptance", status: "rejected" }) }),
    );
    expect(db.workflowPhase.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "IN_PROGRESS" }) }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/autonomous/missionLoop.reviewAcceptReject.test.ts`
Expected: FAIL — scripts not found.

- [ ] **Step 3: Implement `review-phase.ts`**

```typescript
// scripts/manager-loop/review-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getPhaseDetail } from "@/lib/autonomous/missionLoop/missionRepository";
import { evaluateAcceptanceCriteria } from "@/lib/autonomous/missionLoop/gateEvaluation";

export async function main(argv: string[], prisma: PrismaClient): Promise<{ readyToAccept: boolean }> {
  const phaseId = argv[0];
  if (!phaseId) throw new Error("Usage: review-phase.ts <phaseId>");
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const requiredIncomplete = phase.checklist.filter(
    (item) => item.required && item.status !== "DONE" && item.status !== "SKIPPED",
  );
  const gate = await evaluateAcceptanceCriteria(phase.acceptanceCriteria, prisma);
  console.log(`Phase ${phaseId} (${phase.title}) - status ${phase.status}`);
  console.log(`Required checklist items incomplete: ${requiredIncomplete.length}`);
  for (const item of requiredIncomplete) console.log(`  - ${item.label}`);
  console.log("Acceptance criteria:");
  for (const result of gate.results) console.log(`  - ${result.passed ? "PASS" : "FAIL"}: ${result.detail}`);
  const readyToAccept = phase.status === "VERIFYING" && requiredIncomplete.length === 0 && gate.passed;
  console.log(readyToAccept ? "READY TO ACCEPT" : "NOT READY");
  return { readyToAccept };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 4: Implement `accept-phase.ts`**

```typescript
// scripts/manager-loop/accept-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getPhaseDetail, recordPhaseDecision, transitionPhase } from "@/lib/autonomous/missionLoop/missionRepository";
import { evaluateAcceptanceCriteria } from "@/lib/autonomous/missionLoop/gateEvaluation";

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const phaseId = argv[0];
  if (!phaseId) throw new Error("Usage: accept-phase.ts <phaseId>");
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  if (phase.status !== "VERIFYING") {
    throw new Error(`Phase ${phaseId} is ${phase.status}, not VERIFYING - cannot accept`);
  }
  const requiredIncomplete = phase.checklist.filter(
    (item) => item.required && item.status !== "DONE" && item.status !== "SKIPPED",
  );
  if (requiredIncomplete.length > 0) {
    throw new Error(`Cannot accept: ${requiredIncomplete.length} required checklist item(s) incomplete`);
  }
  const gate = await evaluateAcceptanceCriteria(phase.acceptanceCriteria, prisma);
  if (!gate.passed) {
    throw new Error(
      `Cannot accept: acceptance criteria failed - ${gate.results
        .filter((result) => !result.passed)
        .map((result) => result.detail)
        .join("; ")}`,
    );
  }
  await recordPhaseDecision(
    { phaseId, workflowRunId: phase.workflowRunId, outcome: "ACCEPT", evidenceRefs: gate.results },
    prisma,
  );
  await transitionPhase(phaseId, "COMPLETE", {}, prisma);
  console.log(`Phase ${phaseId} ACCEPTED and marked COMPLETE.`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 5: Implement `reject-phase.ts`**

```typescript
// scripts/manager-loop/reject-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getPhaseDetail, recordPhaseDecision, transitionPhase } from "@/lib/autonomous/missionLoop/missionRepository";

function parseArgs(argv: string[]): { args: Map<string, string>; positionals: string[] } {
  const args = new Map<string, string>();
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      args.set(token.slice(2), argv[i + 1]);
      i += 1;
    } else {
      positionals.push(token);
    }
  }
  return { args, positionals };
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const { args, positionals } = parseArgs(argv);
  const phaseId = positionals[0];
  const reason = args.get("reason");
  if (!phaseId || !reason) throw new Error('Usage: reject-phase.ts <phaseId> --reason "..."');
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  if (phase.status !== "VERIFYING") {
    throw new Error(`Phase ${phaseId} is ${phase.status}, not VERIFYING - cannot reject`);
  }
  await recordPhaseDecision({ phaseId, workflowRunId: phase.workflowRunId, outcome: "REJECT", reason }, prisma);
  await transitionPhase(phaseId, "IN_PROGRESS", {}, prisma);
  console.log(`Phase ${phaseId} REJECTED (${reason}) and returned to IN_PROGRESS.`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.reviewAcceptReject.test.ts`
Expected: PASS, including both gate-block cases.

- [ ] **Step 7: Commit**

```bash
git add scripts/manager-loop/review-phase.ts scripts/manager-loop/accept-phase.ts scripts/manager-loop/reject-phase.ts __tests__/autonomous/missionLoop.reviewAcceptReject.test.ts
git commit -m "$(cat <<'EOF'
feat: add Manager Loop review/accept/reject CLI scripts

accept-phase.ts re-derives gate verdicts itself rather than trusting
an earlier review-phase.ts run - a phase cannot reach COMPLETE with
an incomplete required checklist item or a failing named criterion,
regardless of call order.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 9: `AgentGoal` boundary test

**Files:**
- Test: `__tests__/autonomous/missionLoop.agentGoalBoundary.test.ts`

**Interfaces:**
- Consumes: source text of every file under `lib/autonomous/missionLoop/` and
  `scripts/manager-loop/` (this test greps the actual source, it does not call any function).

- [ ] **Step 1: Write the test**

```typescript
// __tests__/autonomous/missionLoop.agentGoalBoundary.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("AgentGoal boundary", () => {
  it("no Manager Loop source file reads AgentGoal.status or queries the AgentGoal model", () => {
    const files = [
      ...collectFiles(join(process.cwd(), "lib/autonomous/missionLoop")),
      ...collectFiles(join(process.cwd(), "scripts/manager-loop")),
    ];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} must not reference AgentGoal`).not.toMatch(/AgentGoal/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.agentGoalBoundary.test.ts`
Expected: PASS (no prior task ever referenced `AgentGoal`, so this should already be green;
if it fails, it means an earlier task leaked a reference and must be fixed before continuing).

- [ ] **Step 3: Commit**

```bash
git add __tests__/autonomous/missionLoop.agentGoalBoundary.test.ts
git commit -m "$(cat <<'EOF'
test: assert Manager Loop never reads AgentGoal for completion state

Enforces the canonical boundary: an Implementer's own continuation
may use AgentGoal, but phase/mission completion is judged solely
from WorkflowPhase/WorkflowChecklistItem status.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 10: Simulated restart/resume test

**Files:**
- Test: `__tests__/autonomous/missionLoop.restartResume.test.ts`

**Interfaces:**
- Consumes: `createMission`, `planPhases`, `getMissionDetail` (Task 3); `main` from
  `dispatch-phase.ts`, `report-phase.ts` (Tasks 6-7).

This test proves the §3.1 resume criterion: create a mission, dispatch and partially complete
a phase using one fake `db` object standing in for "session 1," discard all local variables,
then call `getMissionDetail` again with a **fresh** fake `db` object built from the same
underlying data to simulate "a brand-new session with no chat history reconstructing state
from the database alone."

- [ ] **Step 1: Write the test**

```typescript
// __tests__/autonomous/missionLoop.restartResume.test.ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createMission, getMissionDetail, planPhases } from "@/lib/autonomous/missionLoop/missionRepository";
import { main as dispatchPhaseMain } from "@/scripts/manager-loop/dispatch-phase";
import { main as reportPhaseMain } from "@/scripts/manager-loop/report-phase";

// A minimal in-memory fake standing in for Postgres across this test, so the
// same rows are visible whether accessed via the "session 1" or "session 2" db handle.
function makeSharedStore() {
  const runs = new Map<string, any>();
  const phases = new Map<string, any>();
  const checklistItems = new Map<string, any>();
  const checkpoints: any[] = [];
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${(idCounter += 1)}`;

  const db = {
    workflowRun: {
      create: vi.fn(async ({ data }: any) => {
        const run = { id: nextId("run"), ...data };
        runs.set(run.id, run);
        return run;
      }),
      findUnique: vi.fn(async ({ where }: any) => runs.get(where.id) ?? null),
    },
    workflowPhase: {
      create: vi.fn(async ({ data }: any) => {
        const phase = { id: nextId("phase"), status: "NOT_STARTED", attempt: 0, lastProgressAt: null, blockedReason: null, startedAt: null, completedAt: null, ...data };
        phases.set(phase.id, phase);
        return phase;
      }),
      findUnique: vi.fn(async ({ where }: any) => phases.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }: any) =>
        [...phases.values()].filter((phase) => phase.workflowRunId === where.workflowRunId).sort((a, b) => a.sequence - b.sequence),
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const phase = { ...phases.get(where.id), ...data };
        phases.set(where.id, phase);
        return phase;
      }),
    },
    workflowChecklistItem: {
      create: vi.fn(async ({ data }: any) => {
        const item = { id: nextId("item"), status: "PENDING", evidenceRef: null, completedAt: null, ...data };
        checklistItems.set(item.id, item);
        return item;
      }),
      findUnique: vi.fn(async ({ where }: any) => checklistItems.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }: any) => [...checklistItems.values()].filter((item) => item.workflowPhaseId === where.workflowPhaseId)),
      update: vi.fn(async ({ where, data }: any) => {
        const item = { ...checklistItems.get(where.id), ...data };
        checklistItems.set(where.id, item);
        return item;
      }),
    },
    workflowCheckpoint: {
      count: vi.fn(async () => checkpoints.length),
      create: vi.fn(async ({ data }: any) => {
        const checkpoint = { id: nextId("checkpoint"), ...data };
        checkpoints.push(checkpoint);
        return checkpoint;
      }),
    },
  };
  return db;
}

describe("restart/resume", () => {
  it("a fresh session reconstructs mission/phase/checklist/next-action from the DB alone", async () => {
    const sharedDb = makeSharedStore();

    // "Session 1": create the mission, plan one phase, dispatch it, partially complete it.
    const mission = await createMission({ slug: "resume-test", objective: "Prove resume works" }, sharedDb as any);
    await planPhases(
      mission.id,
      [
        {
          sequence: 1,
          title: "Triage",
          objective: "Inventory the work",
          acceptanceCriteria: [],
          checklist: [{ label: "Diff reviewed" }, { label: "Missing modules identified" }],
        },
      ],
      sharedDb as any,
    );
    const beforeRestart = await getMissionDetail(mission.id, sharedDb as any);
    const phaseId = beforeRestart!.phases[0].id;
    const firstItemId = beforeRestart!.phases[0].checklist[0].id;

    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await dispatchPhaseMain([phaseId], sharedDb as any);

    const dir = mkdtempSync(join(tmpdir(), "manager-loop-resume-test-"));
    const evidencePath = join(dir, "evidence.json");
    writeFileSync(
      evidencePath,
      JSON.stringify({
        checklist: [{ itemId: firstItemId, status: "DONE", evidenceRef: { note: "diff reviewed, two threads found" } }],
        checkpointKey: "triage.partial",
        state: { note: "one checklist item done, one remains" },
      }),
    );
    await reportPhaseMain([phaseId, "--status", "BLOCKED", "--evidence", evidencePath], sharedDb as any);

    // "Session 2": a brand-new call with no access to any variable from session 1
    // except the mission id (which is all §3.1 requires) - simulate this by
    // reconstructing purely from getMissionDetail again.
    const afterRestart = await getMissionDetail(mission.id, sharedDb as any);

    expect(afterRestart?.objective).toBe("Prove resume works");
    expect(afterRestart?.phases[0].status).toBe("BLOCKED");
    expect(afterRestart?.phases[0].blockedReason).toBe("blocked");
    expect(afterRestart?.phases[0].attempt).toBe(1);
    expect(afterRestart?.phases[0].checklist.find((item) => item.id === firstItemId)?.status).toBe("DONE");
    expect(afterRestart?.phases[0].checklist.find((item) => item.label === "Missing modules identified")?.status).toBe("PENDING");
    expect(afterRestart?.phases[0].lastProgressAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run __tests__/autonomous/missionLoop.restartResume.test.ts`
Expected: PASS. If it fails, the failure will point at exactly which piece of state (status,
checklist, attempt, lastProgressAt) did not survive the simulated restart — fix the repository
function responsible before moving on.

- [ ] **Step 3: Commit**

```bash
git add __tests__/autonomous/missionLoop.restartResume.test.ts
git commit -m "$(cat <<'EOF'
test: prove Manager Loop restart/resume from DB state alone

Simulates a fresh session with no prior chat transcript reconstructing
full mission/phase/checklist/attempt/progress state via getMissionDetail
after another session dispatched and partially completed a phase.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 11: Documentation

**Files:**
- Create: `docs/ai/MANAGER_LOOP.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Write the documentation**

```markdown
# Manager Loop — Sub-project 1

Durable Mission/Phase/Checklist orchestration extending `lib/autonomous/`. Full design:
`docs/superpowers/specs/2026-09-04-manager-loop-core-design.md`. This doc is the operational
how-to.

## Why this exists

Long-horizon work run by a single continuous session either drifts into unnecessary local
optimization or loses coherent state across restarts. Manager Loop makes "complete this phase
completely and extremely well, then move on" a database fact instead of a chat claim: a phase
can only reach `COMPLETE` once its checklist, acceptance criteria, and any named governance
gate are all satisfied, re-derived live at the moment of acceptance.

## Runtime model

Manager and Implementer are Claude Code sessions, not a new agent runtime. `lib/autonomous/`
does not gain filesystem/shell/git authority — sessions that already have it drive the CLI in
`scripts/manager-loop/`. Persisted state (`WorkflowRun`/`WorkflowPhase`/`WorkflowChecklistItem`/
`WorkflowCheckpoint`), not chat history, is what carries continuity between sessions.

`AgentGoal` (the separate `lib/agents/` harness) may be used by an Implementer's own
multi-step continuation, but phase/mission completion is judged exclusively from
`WorkflowPhase`/`WorkflowChecklistItem` status — never from `AgentGoal.status`.

## Creating and running a mission

```bash
# 1. Manager creates the mission
tsx scripts/manager-loop/create-mission.ts --slug my-mission --objective "Do the thing"

# 2. Manager writes its phase decomposition to a JSON file (see
#    scripts/manager-loop/mission-000001-p7c-remediation/phases.json for a real example),
#    matching this shape per phase:
#    { "sequence": 1, "title": "...", "objective": "...",
#      "acceptanceCriteria": [{ "type": "command", "label": "...", "command": "..." }],
#      "checklist": [{ "label": "..." }] }
tsx scripts/manager-loop/plan-phases.ts --mission <missionId> --phases-file phases.json

# 3. Manager (or Implementer) dispatches the first ready phase
tsx scripts/manager-loop/dispatch-phase.ts <phaseId>

# 4. Implementer does the work, then reports evidence (evidence.json shape:
#    { "checklist": [{ "itemId": "...", "status": "DONE", "evidenceRef": {...} }],
#      "checkpointKey": "...", "state": {...}, "blockedReason"?: "..." })
tsx scripts/manager-loop/report-phase.ts <phaseId> --status VERIFYING --evidence evidence.json

# 5. Manager reviews (read-only) then accepts or rejects
tsx scripts/manager-loop/review-phase.ts <phaseId>
tsx scripts/manager-loop/accept-phase.ts <phaseId>
# or: tsx scripts/manager-loop/reject-phase.ts <phaseId> --reason "..."
```

## Resuming with no prior chat history

A new session (interactive, or later a scheduled headless run via `/loop`/`CronCreate`) runs:

```bash
tsx scripts/manager-loop/status.ts                # list open missions
tsx scripts/manager-loop/status.ts <missionId>     # full detail + exact next action
tsx scripts/manager-loop/status.ts <missionId> --json
```

`status.ts` is read-only by construction — it is safe to run at any time and is the resume
mechanism this design is built around.

## Acceptance criteria types

- `{ "type": "command", "label": "...", "command": "..." }` — re-run live at review/accept
  time; must exit 0. Covers named tests, `npx tsc --noEmit`, `npx prisma generate`, `npm run
  build`, or a one-line wrapper script around any existing gate (release gate, quality
  operations, etc.) that exits nonzero on a blocking verdict.
- `{ "type": "approval_resolved", "approvalRequestId": "..." }` — passes only when that
  `ApprovalRequest.status` is `APPROVED`.
- `{ "type": "review_task_resolved", "qualityReviewTaskId": "..." }` — passes only when that
  `QualityReviewTask.status` is `DECIDED` and its `QualityReviewAssessment.outcome` is `PASS`.

`accept-phase.ts` always re-derives every criterion itself before allowing `COMPLETE` — it
never trusts an earlier `review-phase.ts` run or an Implementer's self-report.

## What's out of scope here (see the spec for the full sub-project breakdown)

No stall-policy engine (only the `attempt`/`lastProgressAt` data surface for one), no Mission
Control UI, no bounded-parallel-worker system, no curriculum-specific mission templates, no
new sandboxed coding-agent runtime, no always-on orchestration server, no fix to the
`AUTONOMOUS_WORKFLOW_RUN` SQS/worker no-op (irrelevant here — resume is DB-driven).
```

- [ ] **Step 2: Commit**

```bash
git add docs/ai/MANAGER_LOOP.md
git commit -m "$(cat <<'EOF'
docs: add Manager Loop operational guide

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

### Task 12: Full mandatory gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full mandatory gate**

Run: `npx prisma generate`
Expected: succeeds.

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this plan (compare against the pre-plan baseline if the
repo already has known pre-existing errors).

Run: `npx vitest run`
Expected: full suite green, including every new test file from Tasks 2-10.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 2: If any gate step fails, fix the root cause and re-run this task from Step 1**

Do not weaken RBAC, tenant isolation, audit logging, or cost controls to pass a gate — none of
this plan's tasks should touch any of those, so a failure here means something in Tasks 1-11
needs a real fix, not a workaround.

---

### Task 13: Dogfood mission — real end-to-end phase run

**Files:**
- Create: `scripts/manager-loop/mission-000001-p7c-remediation/phases.json`

**Interfaces:** none new — this task exercises Tasks 1-8 as a real user would.

This is the Definition of Done proof: create the real mission, dispatch its first real phase,
actually do the work, and carry it through review/accept. The mission's remaining phases
(implementing the quality-operations fixes, building the missing `lib/ops/operationalSnapshot.ts`
and `lib/ops/operationalSources.ts`, running the full gate, preparing a PR) are real follow-on
Manager Loop work for a later session — this task proves the loop, it does not have to finish
the entire P7C remediation itself.

- [ ] **Step 1: Recover the stashed work into a scratch location (do not apply it to the working tree yet)**

```bash
git stash show -p stash@{0} > /tmp/manager-loop-dogfood/p7c-remediation-diff.patch
git show <untracked-files-commit-from-the-stash>:docs/audits/AUDIT_SYNTHESIS_2026-09.md > /tmp/manager-loop-dogfood/AUDIT_SYNTHESIS_2026-09.md
```

(Use the exact stash reference and untracked-files commit hash recorded in
`docs/superpowers/specs/2026-09-04-manager-loop-core-design.md` §11 and in this session's
memory file `project_manager_loop_core.md` — re-verify with `git stash list` first, since the
stash index can shift if anything else was stashed in the meantime.)

- [ ] **Step 2: Create the mission**

```bash
tsx scripts/manager-loop/create-mission.ts \
  --slug p7c-remediation \
  --objective "Finish the stashed P7C quality-operations statistical fixes and the unified ops-readiness dashboard refactor" \
  --scope '{"branch":"feat/p7c-pr122-remediation","stashRef":"the exact stash@{N} recovered in Step 1"}' \
  --constraints '{"neverWeaken":["RBAC","tenant isolation","audit logging","cost controls"]}'
```

Record the printed mission id for the next steps.

- [ ] **Step 2: Write the real phase decomposition**

Create `scripts/manager-loop/mission-000001-p7c-remediation/phases.json` with at least this
first phase (the Manager may add more phases for the remaining work — those are follow-on,
not required for this task):

```json
[
  {
    "sequence": 1,
    "title": "Triage the stashed P7C work",
    "objective": "Produce an evidence-backed inventory of exactly what the stashed diff changes, which parts are complete, and which are broken or missing, so later phases have a precise scope instead of a re-discovery cost.",
    "acceptanceCriteria": [
      { "type": "command", "label": "inventory file exists and is non-empty", "command": "node -e \"const fs=require('fs'); const p='docs/ops/p7c-remediation-stash-inventory.md'; process.exit(fs.existsSync(p) && fs.statSync(p).size > 0 ? 0 : 1)\"" }
    ],
    "checklist": [
      { "label": "Diff against main reviewed file-by-file" },
      { "label": "Statistical-correctness changes in lib/experiments/qualityOperations.ts documented with before/after behavior" },
      { "label": "Confirmed lib/ops/operationalSnapshot.ts and lib/ops/operationalSources.ts do not exist anywhere in the repo" },
      { "label": "docs/audits/AUDIT_SYNTHESIS_2026-09.md content summarized and cross-checked against docs/roadmaps/CONSOLIDATED_BACKLOG.md" }
    ]
  }
]
```

- [ ] **Step 3: Plan and dispatch the phase**

```bash
tsx scripts/manager-loop/plan-phases.ts --mission <missionId> --phases-file scripts/manager-loop/mission-000001-p7c-remediation/phases.json
tsx scripts/manager-loop/dispatch-phase.ts <phaseId>
```

- [ ] **Step 4: Do the actual triage work (as Implementer)**

Write `docs/ops/p7c-remediation-stash-inventory.md` covering: a file-by-file summary of the
stashed diff (from Step 1's patch file), the specific statistical-correctness behavior changes
in `lib/experiments/qualityOperations.ts` (per-metric directionality, per-metric comparisons,
corrected z-values, NaN-date guard, replay-key fix — verify each against the actual patch
content, don't just restate the spec's summary), confirmation that
`lib/ops/operationalSnapshot.ts`/`lib/ops/operationalSources.ts` are genuinely absent (`git log
--all --full-history -- lib/ops/operationalSnapshot.ts lib/ops/operationalSources.ts` returning
nothing), and a short cross-check of `docs/audits/AUDIT_SYNTHESIS_2026-09.md` against
`docs/roadmaps/CONSOLIDATED_BACKLOG.md`'s current content.

- [ ] **Step 5: Report the phase**

Write an evidence file recording each checklist item as `DONE` with an `evidenceRef` pointing
at `docs/ops/p7c-remediation-stash-inventory.md` (and specific section anchors), then:

```bash
tsx scripts/manager-loop/report-phase.ts <phaseId> --status VERIFYING --evidence <path>
```

- [ ] **Step 6: Review and accept**

```bash
tsx scripts/manager-loop/review-phase.ts <phaseId>
# Expect: READY TO ACCEPT (all 4 checklist items DONE, inventory file exists and is non-empty)
tsx scripts/manager-loop/accept-phase.ts <phaseId>
```

- [ ] **Step 7: Verify durability**

```bash
tsx scripts/manager-loop/status.ts <missionId> --json
```

Expected: shows phase 1 as `COMPLETE`, the inventory doc referenced in its checklist evidence,
and mission status `IN_PROGRESS` (since only phase 1 exists so far and further phases are
follow-on work, not part of this task).

- [ ] **Step 8: Commit**

```bash
git add scripts/manager-loop/mission-000001-p7c-remediation/phases.json docs/ops/p7c-remediation-stash-inventory.md
git commit -m "$(cat <<'EOF'
feat: run Manager Loop's first real mission phase (P7C remediation triage)

Phase 1 of the p7c-remediation mission ran end-to-end through the
real protocol: dispatch -> work -> evidence -> checkpoint -> review
-> accept -> COMPLETE, verified durable via status.ts after a fresh
read. Remaining phases (implementing the fixes, building the missing
ops-dashboard data layer, gate, PR) are real follow-on work for a
later Manager Loop session - proving resume, not required here.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YakReJ7D3G7zvyPnBV1AzH
EOF
)"
```

---

## Self-review notes (for the plan author, resolved before handoff)

1. **Spec coverage**: §3 runtime model -> Tasks 5-8 (CLI scripts, no new runtime). §3.1 resume
   -> Task 10. §4 schema -> Task 1. §5 AgentGoal boundary -> Task 9. §6 state machine -> Task
   2. §7 governance integration -> Task 4 + Task 8's gate-block tests. §8 protocol -> Tasks
   5-8. §9 evidence/checkpoints -> Task 3's `writeCheckpoint`. §10 testing plan -> Tasks 2-4,
   9, 10, and Task 8's gate-block cases cover every named test category. §11 dogfood -> Task
   13. §12 out-of-scope -> reflected in Global Constraints and Task 11's doc.
2. **Placeholder scan**: no TBD/TODO; every step has real code or a real shell command.
3. **Type consistency**: `PhaseStatus`/`ChecklistItemStatus`/`AcceptanceCriterion` defined once
   in Task 2 and imported identically everywhere; `db: PrismaClient` is the last parameter in
   every repository/gate function across all tasks; `main(argv, prisma)` signature is
   consistent across all eight CLI scripts.
