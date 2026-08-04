# Curriculum Risk-Triage Implementation Plan

**Status:** Implemented and validated on `feat/curriculum-risk-triage` on
2026-08-04. The task checkboxes below preserve the original execution plan;
the authoritative closeout evidence is recorded in
`docs/roadmaps/CURRENT_EXECUTION_STATE.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace silent script-driven curriculum auto-approval with a risk-scored
triage layer that flags the highest-risk automatically-generated lessons for real
human/MOE review, under a bounded weekly budget, while auto-approving everything
else with a full audit trail for the first time.

**Architecture:** A new pure-scoring function (`computeRiskScore`) plus a DB-backed
orchestrator (`triageAndApprove`) sit in `lib/curriculum/riskTriage.ts`, called only
from automated/script-driven approval paths - never from the human-driven
approve/reject routes NR-11 fixed. Flagged lessons get `status: "NEEDS_REVIEW"`
(already fail-closed to students per NR-10) instead of an approved status. A
sibling module (`lib/curriculum/riskTriageNotify.ts`) emails everyone holding
`PERMISSIONS.CURRICULUM_APPROVE` when something is flagged.

**Tech Stack:** TypeScript, Prisma (PostgreSQL - JSON path filters via
`payload: { path: [...], equals: ... }` are already proven in this codebase, see
`lib/ops/cronHeartbeat.ts:48`), Vitest, Next.js API routes, Resend (`lib/email.ts`).

**Design source:** `docs/superpowers/specs/2026-08-03-curriculum-risk-triage-design.md`

## Global Constraints

- No schema changes. Everything reuses `CurriculumContent.status` (existing values
  only: `"NEEDS_REVIEW"`, `"published"`, `"APPROVED"`) and the existing `payload`
  Json column, matching the convention already used by
  `app/api/admin/curriculum/approve/route.ts`.
- `triageAndApprove` and its helpers must never be imported by
  `app/api/admin/curriculum/approve/route.ts`, `app/api/admin/curriculum/reject/route.ts`,
  or `app/api/admin/ops/curriculum-review/route.ts` - those are the human-driven
  routes NR-11 fixed and are out of scope for this change.
- Notification failures (email provider down) must never block an approval/flagging
  decision - log a warning and continue, matching the existing best-effort pattern
  in `lib/agents/safeguarding/notify.ts`.
- Budget-check failures (a DB error while counting the trailing-7-day flagged rows)
  must fail closed to flagging, not to silent auto-approval.
- Every new DB-backed function lives behind `@/lib/db`'s `prisma` singleton - no
  new ad-hoc `PrismaClient` instances (this plan also removes the one in
  `scripts/bulk-approve-published.ts` for consistency, since it must call into
  `lib/curriculum/riskTriage.ts` which itself uses the shared singleton).
- Run the full gate (`npx prisma generate`, `npx tsc --noEmit`, `npx vitest run`,
  `npm run build`) after the final task, per `CLAUDE.md`. Stop on any failure.

---

## File Structure

- **Create** `lib/curriculum/riskTriage.ts` - risk scoring, first-of-kind lookup,
  weekly budget check, backlog count for the review-page badge, and the
  `triageAndApprove` orchestrator. All DB access via `@/lib/db`'s `prisma`.
- **Create** `lib/curriculum/riskTriageNotify.ts` - emails every user holding
  `PERMISSIONS.CURRICULUM_APPROVE` (or `isPlatformAdmin`) when a lesson is flagged.
  Separate file because it has its own concern (recipient lookup + email sending)
  and its own mocking surface in tests.
- **Modify** `lib/curriculum/coverageShared.ts` - add one shared constant,
  `APPROVED_STATUSES`, so `riskTriage.ts`'s first-of-kind query and the existing
  coverage matrix never drift on what "approved" means.
- **Modify** `scripts/bulk-approve-published.ts` - call `triageAndApprove` instead
  of writing `status: "published"` directly; preview mode (`--dry-run`) uses the
  read-only pieces (`computeRiskScore`, `isFirstOfKindCell`, `getFlaggedCountInWindow`)
  so it still makes zero writes.
- **Modify** `scripts/promote-enriched-lessons.ts` - same wiring, using
  `approvedStatus: "APPROVED"` (its existing convention) instead of `"published"`.
- **Modify** `app/api/admin/ops/curriculum-review/route.ts` - `GET` response gains
  one extra field, `riskFlaggedAwaitingReview` (a live count), no behavior change
  to auth or the existing `drafts` payload.
- **Modify** `app/admin/ops/curriculum-review/page.tsx` - render that count as a
  small badge in the page header.
- **Create** `__tests__/curriculum-risk-triage/risk-score.test.ts`,
  `db-helpers.test.ts`, `notify.test.ts`, `triage-and-approve.test.ts`,
  `human-routes-untouched.test.ts`.

---

## Task 1: Shared approved-status constant + pure risk scoring

**Files:**
- Modify: `lib/curriculum/coverageShared.ts`
- Create: `lib/curriculum/riskTriage.ts`
- Test: `__tests__/curriculum-risk-triage/risk-score.test.ts`

**Interfaces:**
- Produces: `APPROVED_STATUSES: string[]` (from `coverageShared.ts`), and from
  `riskTriage.ts`: `gradeBandOf(grade: number): "G1_3" | "G4_6" | "G7_PLUS"`,
  `computeRiskScore(input: RiskFactorInput): RiskScoreResult`,
  `isWorthFlagging(score: number): boolean`, plus exported constants
  `GRADE_BAND_RISK`, `SENSITIVE_SUBJECTS`, `SUBJECT_SENSITIVITY_SCORE`,
  `FIRST_OF_KIND_SCORE`, `GATE_MARGIN_THRESHOLD`, `GATE_MARGIN_SCORE`,
  `FLAG_THRESHOLD`.
- Types: `RiskFactorInput = { grade: number; subject: string; isFirstOfKind: boolean; wordCount: number; minWordCount: number }`,
  `RiskScoreResult = { score: number; reasons: string[] }`.

- [ ] **Step 1: Add the shared `APPROVED_STATUSES` constant**

Add to `lib/curriculum/coverageShared.ts` (after the existing `NATIONAL_GATE` line):

```ts
// The two status strings that mean "approved and visible to students" across
// both approval pipelines (published = human/legacy convention, APPROVED =
// promotion-pass-2b convention). Kept here so any query that needs "is this
// grade x subject cell already covered" uses the same definition as the
// coverage matrix below, instead of a second, driftable copy.
export const APPROVED_STATUSES: string[] = ["published", "APPROVED"];
```

- [ ] **Step 2: Write the failing test for `computeRiskScore` and `gradeBandOf`**

Create `__tests__/curriculum-risk-triage/risk-score.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeRiskScore,
  gradeBandOf,
  isWorthFlagging,
  FLAG_THRESHOLD,
} from "@/lib/curriculum/riskTriage";

describe("gradeBandOf", () => {
  it("classifies G1-G3 as G1_3", () => {
    expect(gradeBandOf(1)).toBe("G1_3");
    expect(gradeBandOf(3)).toBe("G1_3");
  });
  it("classifies G4-G6 as G4_6", () => {
    expect(gradeBandOf(4)).toBe("G4_6");
    expect(gradeBandOf(6)).toBe("G4_6");
  });
  it("classifies G7+ as G7_PLUS", () => {
    expect(gradeBandOf(7)).toBe("G7_PLUS");
    expect(gradeBandOf(12)).toBe("G7_PLUS");
  });
});

describe("computeRiskScore", () => {
  it("scores a low-risk candidate (older grade, non-sensitive subject, not first-of-kind, comfortably passing) as zero", () => {
    const result = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("adds grade-band risk for G1-G3", () => {
    const result = computeRiskScore({
      grade: 2,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 400,
    });
    expect(result.reasons).toContain("grade_band_g1_3");
    expect(result.score).toBeGreaterThan(0);
  });

  it("adds sensitivity risk for CIVICS and SOCIAL_STUDIES", () => {
    const civics = computeRiskScore({
      grade: 9,
      subject: "CIVICS",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(civics.reasons).toContain("sensitive_subject_civics");

    const social = computeRiskScore({
      grade: 9,
      subject: "social_studies",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(social.reasons).toContain("sensitive_subject_social_studies");
  });

  it("adds first-of-kind risk", () => {
    const result = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: true,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(result.reasons).toContain("first_of_kind_cell");
  });

  it("adds gate-margin risk when word count is within 15% of the minimum", () => {
    const borderline = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 850, // 800 * 1.0625, inside the 1.15 threshold
      minWordCount: 800,
    });
    expect(borderline.reasons).toContain("borderline_quality_gate_margin");

    const comfortable = computeRiskScore({
      grade: 9,
      subject: "MATH",
      isFirstOfKind: false,
      wordCount: 2000,
      minWordCount: 800,
    });
    expect(comfortable.reasons).not.toContain("borderline_quality_gate_margin");
  });

  it("stacks all four factors for the worst case (G2 SOCIAL_STUDIES, first-of-kind, borderline words)", () => {
    const result = computeRiskScore({
      grade: 2,
      subject: "SOCIAL_STUDIES",
      isFirstOfKind: true,
      wordCount: 410,
      minWordCount: 400,
    });
    expect(result.reasons).toEqual([
      "grade_band_g1_3",
      "sensitive_subject_social_studies",
      "first_of_kind_cell",
      "borderline_quality_gate_margin",
    ]);
    expect(result.score).toBeGreaterThanOrEqual(FLAG_THRESHOLD);
  });
});

describe("isWorthFlagging", () => {
  it("is false below FLAG_THRESHOLD and true at/above it", () => {
    expect(isWorthFlagging(FLAG_THRESHOLD - 1)).toBe(false);
    expect(isWorthFlagging(FLAG_THRESHOLD)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run __tests__/curriculum-risk-triage/risk-score.test.ts`
Expected: FAIL - `Cannot find module '@/lib/curriculum/riskTriage'` (file doesn't exist yet).

- [ ] **Step 4: Create `lib/curriculum/riskTriage.ts` with the scoring functions**

```ts
// lib/curriculum/riskTriage.ts
//
// Risk-based triage between the existing mechanical quality gates
// (regenerationQualityGate.ts / promotionPass.ts / the inline gate in
// bulk-approve-published.ts) and a final approval status. Only called from
// automated/script-driven approval paths - never from the human-driven
// approve/reject routes (app/api/admin/curriculum/approve|reject/route.ts,
// app/api/admin/ops/curriculum-review/route.ts). See
// docs/superpowers/specs/2026-08-03-curriculum-risk-triage-design.md.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { APPROVED_STATUSES } from "@/lib/curriculum/coverageShared";
import { notifyRiskReviewers } from "@/lib/curriculum/riskTriageNotify";

export type GradeBand = "G1_3" | "G4_6" | "G7_PLUS";

export const GRADE_BAND_RISK: Record<GradeBand, number> = {
  G1_3: 3,
  G4_6: 2,
  G7_PLUS: 0,
};

// Subjects scored as sensitive. Deliberately limited to the two subjects that
// actually exist in CurriculumContent.subject values today (see
// lib/curriculum/coverageShared.ts SUBJECTS) - CIVICS and SOCIAL_STUDIES.
export const SENSITIVE_SUBJECTS = new Set(["CIVICS", "SOCIAL_STUDIES"]);
export const SUBJECT_SENSITIVITY_SCORE = 2;
export const FIRST_OF_KIND_SCORE = 3;
// A candidate scores gate-margin risk when its word count is within this
// multiple of the pipeline's own minimum (e.g. 800 * 1.15 = 920).
export const GATE_MARGIN_THRESHOLD = 1.15;
export const GATE_MARGIN_SCORE = 2;
// Minimum total score to be worth flagging for human review at all.
export const FLAG_THRESHOLD = 4;
// Global rolling weekly cap on flagged lessons, enforced platform-wide (not
// per script/run) so this stays realistic once multiple pipelines call in.
export const WEEKLY_REVIEW_BUDGET = 8;
export const BUDGET_WINDOW_DAYS = 7;

export function gradeBandOf(grade: number): GradeBand {
  if (grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  return "G7_PLUS";
}

export type RiskFactorInput = {
  grade: number;
  subject: string;
  isFirstOfKind: boolean;
  wordCount: number;
  minWordCount: number;
};

export type RiskScoreResult = {
  score: number;
  reasons: string[];
};

/** Pure, deterministic, no I/O - see design doc's computeRiskScore section. */
export function computeRiskScore(input: RiskFactorInput): RiskScoreResult {
  let score = 0;
  const reasons: string[] = [];

  const band = gradeBandOf(input.grade);
  const gradeRisk = GRADE_BAND_RISK[band];
  if (gradeRisk > 0) {
    score += gradeRisk;
    reasons.push(`grade_band_${band.toLowerCase()}`);
  }

  const subjectKey = input.subject.trim().toUpperCase();
  if (SENSITIVE_SUBJECTS.has(subjectKey)) {
    score += SUBJECT_SENSITIVITY_SCORE;
    reasons.push(`sensitive_subject_${subjectKey.toLowerCase()}`);
  }

  if (input.isFirstOfKind) {
    score += FIRST_OF_KIND_SCORE;
    reasons.push("first_of_kind_cell");
  }

  if (input.minWordCount > 0 && input.wordCount <= input.minWordCount * GATE_MARGIN_THRESHOLD) {
    score += GATE_MARGIN_SCORE;
    reasons.push("borderline_quality_gate_margin");
  }

  return { score, reasons };
}

export function isWorthFlagging(score: number): boolean {
  return score >= FLAG_THRESHOLD;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run __tests__/curriculum-risk-triage/risk-score.test.ts`
Expected: PASS (all cases). Note this step will still fail to *import* cleanly
until Task 4 creates `riskTriageNotify.ts` - if so, temporarily stub it by
creating an empty `export async function notifyRiskReviewers() {}` in
`lib/curriculum/riskTriageNotify.ts` now; Task 4 replaces it with the real
implementation. Confirm the stub file exists before running this step.

- [ ] **Step 6: Commit**

```bash
git add lib/curriculum/coverageShared.ts lib/curriculum/riskTriage.ts lib/curriculum/riskTriageNotify.ts __tests__/curriculum-risk-triage/risk-score.test.ts
git commit -m "feat: curriculum risk-triage scoring (computeRiskScore, gradeBandOf)"
```

---

## Task 2: DB-backed helpers - first-of-kind lookup, budget count, backlog count

**Files:**
- Modify: `lib/curriculum/riskTriage.ts`
- Test: `__tests__/curriculum-risk-triage/db-helpers.test.ts`

**Interfaces:**
- Consumes: `APPROVED_STATUSES` (Task 1, `coverageShared.ts`).
- Produces: `isFirstOfKindCell(grade: number, subject: string): Promise<boolean>`,
  `getFlaggedCountInWindow(): Promise<number>`,
  `countRiskFlaggedAwaitingReview(): Promise<number>`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/curriculum-risk-triage/db-helpers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      count: mockCount,
    },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/curriculum/riskTriageNotify", () => ({ notifyRiskReviewers: vi.fn(async () => {}) }));

import {
  isFirstOfKindCell,
  getFlaggedCountInWindow,
  countRiskFlaggedAwaitingReview,
  BUDGET_WINDOW_DAYS,
} from "@/lib/curriculum/riskTriage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isFirstOfKindCell", () => {
  it("returns true when zero approved rows exist for the grade x subject cell", async () => {
    mockCount.mockResolvedValue(0);
    await expect(isFirstOfKindCell(2, "social_studies")).resolves.toBe(true);
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        contentType: "lesson",
        grade: 2,
        subject: "SOCIAL_STUDIES",
        status: { in: ["published", "APPROVED"] },
      },
    });
  });

  it("returns false when at least one approved row already exists", async () => {
    mockCount.mockResolvedValue(3);
    await expect(isFirstOfKindCell(9, "MATH")).resolves.toBe(false);
  });
});

describe("getFlaggedCountInWindow", () => {
  it("counts payload.riskFlagged=true rows updated within the budget window", async () => {
    mockCount.mockResolvedValue(5);
    await expect(getFlaggedCountInWindow()).resolves.toBe(5);
    const callArgs = mockCount.mock.calls[0][0];
    expect(callArgs.where.payload).toEqual({ path: ["riskFlagged"], equals: true });
    expect(callArgs.where.updatedAt.gte).toBeInstanceOf(Date);
    const daysAgo = (Date.now() - callArgs.where.updatedAt.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeCloseTo(BUDGET_WINDOW_DAYS, 1);
  });
});

describe("countRiskFlaggedAwaitingReview", () => {
  it("counts current NEEDS_REVIEW rows with payload.riskFlagged=true, no time window", async () => {
    mockCount.mockResolvedValue(2);
    await expect(countRiskFlaggedAwaitingReview()).resolves.toBe(2);
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        status: "NEEDS_REVIEW",
        payload: { path: ["riskFlagged"], equals: true },
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/curriculum-risk-triage/db-helpers.test.ts`
Expected: FAIL - the three functions are not exported yet.

- [ ] **Step 3: Add the DB-backed helpers to `lib/curriculum/riskTriage.ts`**

Append (after the `isWorthFlagging` function):

```ts
export async function isFirstOfKindCell(grade: number, subject: string): Promise<boolean> {
  const count = await prisma.curriculumContent.count({
    where: {
      contentType: "lesson",
      grade,
      subject: subject.trim().toUpperCase(),
      status: { in: APPROVED_STATUSES },
    },
  });
  return count === 0;
}

export async function getFlaggedCountInWindow(): Promise<number> {
  const since = new Date(Date.now() - BUDGET_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return prisma.curriculumContent.count({
    where: {
      payload: { path: ["riskFlagged"], equals: true },
      updatedAt: { gte: since },
    },
  });
}

/** Live backlog count for the "N lessons awaiting your review" page badge. */
export async function countRiskFlaggedAwaitingReview(): Promise<number> {
  return prisma.curriculumContent.count({
    where: {
      status: "NEEDS_REVIEW",
      payload: { path: ["riskFlagged"], equals: true },
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/curriculum-risk-triage/db-helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/curriculum/riskTriage.ts __tests__/curriculum-risk-triage/db-helpers.test.ts
git commit -m "feat: curriculum risk-triage DB helpers (first-of-kind, budget, backlog count)"
```

---

## Task 3: Reviewer notification

**Files:**
- Create (replace stub from Task 1 Step 5): `lib/curriculum/riskTriageNotify.ts`
- Test: `__tests__/curriculum-risk-triage/notify.test.ts`

**Interfaces:**
- Consumes: `PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission` from `@/lib/permissions`;
  `sendEmail` from `@/lib/email` (envelope shape: `{ to, subject, html, text, type, recipientRole, transactional }`).
- Produces: `notifyRiskReviewers(contentId: string, riskScore: number, riskReasons: string[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/curriculum-risk-triage/notify.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn(async () => ({ ok: true, id: "email-1" })));
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: { user: { findMany: mockFindMany } },
}));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));

import { notifyRiskReviewers } from "@/lib/curriculum/riskTriageNotify";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyRiskReviewers", () => {
  it("queries users by role-holds-CURRICULUM_APPROVE OR isPlatformAdmin, and emails each", async () => {
    mockFindMany.mockResolvedValue([{ email: "moe@example.com" }, { email: "admin@example.com" }]);

    await notifyRiskReviewers("content-42", 6, ["grade_band_g1_3", "first_of_kind_cell"]);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.OR[0].role.in).toEqual(
      expect.arrayContaining(["ADMIN", "MOE_OFFICIAL", "MOE_SUPER_ADMIN"])
    );
    expect(callArgs.where.OR[0].role.in).not.toEqual(expect.arrayContaining(["TEACHER", "STUDENT", "GUARDIAN"]));
    expect(callArgs.where.OR[1]).toEqual({ isPlatformAdmin: true });

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    const firstEmail = mockSendEmail.mock.calls[0][0];
    expect(firstEmail.to).toBe("moe@example.com");
    expect(firstEmail.subject).toContain("flagged for review");
    expect(firstEmail.text).toContain("content-42");
    expect(firstEmail.text).toContain("grade_band_g1_3");
    expect(firstEmail.type).toBe("curriculum_risk_flagged");
    expect(firstEmail.transactional).toBe(true);
  });

  it("logs a warning and does not throw when there are zero recipients", async () => {
    mockFindMany.mockResolvedValue([]);
    await expect(notifyRiskReviewers("content-1", 4, ["first_of_kind_cell"])).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("does not throw when one recipient's email send fails", async () => {
    mockFindMany.mockResolvedValue([{ email: "a@example.com" }, { email: "b@example.com" }]);
    mockSendEmail.mockRejectedValueOnce(new Error("resend down")).mockResolvedValueOnce({ ok: true });
    await expect(notifyRiskReviewers("content-1", 4, ["first_of_kind_cell"])).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/curriculum-risk-triage/notify.test.ts`
Expected: FAIL - stub `notifyRiskReviewers` doesn't match this behavior.

- [ ] **Step 3: Implement `lib/curriculum/riskTriageNotify.ts`**

Replace the Task-1 stub entirely with:

```ts
// lib/curriculum/riskTriageNotify.ts
//
// Emails every user who holds PERMISSIONS.CURRICULUM_APPROVE (queried live via
// hasPermission/ROLE_PERMISSIONS, not a hardcoded contact list - so ADMIN,
// MOE_OFFICIAL, MOE_SUPER_ADMIN, and any future role granted the permission are
// covered automatically) plus platform admins, when riskTriage.ts flags a
// lesson for review. Best-effort: failures here must never block the
// approval/flagging decision in riskTriage.ts.
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission } from "@/lib/permissions";

function reviewUrl(): string {
  const base = process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app";
  return `${base}/admin/ops/curriculum-review?status=NEEDS_REVIEW`;
}

export async function notifyRiskReviewers(
  contentId: string,
  riskScore: number,
  riskReasons: string[]
): Promise<void> {
  const rolesWithApprove = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((role) =>
    hasPermission({ role }, PERMISSIONS.CURRICULUM_APPROVE)
  );

  const recipients = await prisma.user.findMany({
    where: {
      OR: [{ role: { in: rolesWithApprove } }, { isPlatformAdmin: true }],
    },
    select: { email: true },
  });

  if (recipients.length === 0) {
    logger.warn("[riskTriage.notify] no recipients hold CURRICULUM_APPROVE", { contentId });
    return;
  }

  const text = `A lesson was flagged for review by the curriculum risk-triage layer.\n\nContent ID: ${contentId}\nRisk score: ${riskScore}\nReasons: ${riskReasons.join(", ")}\n\nReview: ${reviewUrl()}`;

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendEmail({
          to: recipient.email,
          subject: "Curriculum lesson flagged for review",
          html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
          text,
          type: "curriculum_risk_flagged",
          recipientRole: "user",
          transactional: true,
        });
      } catch (error) {
        logger.warn("[riskTriage.notify] email failed for one recipient", { contentId, error });
      }
    })
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/curriculum-risk-triage/notify.test.ts`
Expected: PASS

- [ ] **Step 5: Re-run Task 1's test to confirm the real notify module still satisfies the import**

Run: `npx vitest run __tests__/curriculum-risk-triage/risk-score.test.ts __tests__/curriculum-risk-triage/db-helpers.test.ts`
Expected: PASS (both files still pass now that the stub is replaced with the real implementation).

- [ ] **Step 6: Commit**

```bash
git add lib/curriculum/riskTriageNotify.ts __tests__/curriculum-risk-triage/notify.test.ts
git commit -m "feat: curriculum risk-triage reviewer notification"
```

---

## Task 4: `triageAndApprove` orchestrator

**Files:**
- Modify: `lib/curriculum/riskTriage.ts`
- Test: `__tests__/curriculum-risk-triage/triage-and-approve.test.ts`

**Interfaces:**
- Consumes: `computeRiskScore`, `isWorthFlagging`, `isFirstOfKindCell`,
  `getFlaggedCountInWindow`, `WEEKLY_REVIEW_BUDGET` (this file, Tasks 1-2);
  `notifyRiskReviewers` (Task 3); `logAudit` (`@/lib/audit`); `prisma` (`@/lib/db`).
- Produces: `TriageCandidate`, `TriageResult` types and
  `triageAndApprove(candidate: TriageCandidate, actorLabel: string, approvedStatus: string): Promise<TriageResult>`
  - this is the exact signature Task 5/6 (script migrations) call.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/curriculum-risk-triage/triage-and-approve.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCount = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn(async (args: any) => ({ ...args })));
const mockLogAudit = vi.hoisted(() => vi.fn(async () => {}));
const mockNotify = vi.hoisted(() => vi.fn(async () => {}));
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      count: mockCount,
      update: mockUpdate,
    },
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/curriculum/riskTriageNotify", () => ({ notifyRiskReviewers: mockNotify }));

import { triageAndApprove, WEEKLY_REVIEW_BUDGET } from "@/lib/curriculum/riskTriage";

const LOW_RISK_CANDIDATE = {
  contentId: "content-low",
  grade: 9,
  subject: "MATH",
  payload: { existing: "field" },
  wordCount: 2000,
  minWordCount: 800,
};

const HIGH_RISK_CANDIDATE = {
  contentId: "content-high",
  grade: 2,
  subject: "SOCIAL_STUDIES",
  payload: { existing: "field" },
  wordCount: 410,
  minWordCount: 400,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("triageAndApprove", () => {
  it("auto-approves a low-risk candidate, stamping riskScore/riskReasons and audit-logging autoapproved", async () => {
    mockCount.mockResolvedValueOnce(0); // isFirstOfKindCell -> not first-of-kind path irrelevant here (low risk regardless)

    const result = await triageAndApprove(LOW_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("approved");
    expect(result.budgetExceeded).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-low" },
      data: {
        status: "published",
        payload: expect.objectContaining({ existing: "field", riskScore: 0, riskReasons: [] }),
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "curriculum.risk.autoapproved", resourceId: "content-low" })
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("flags a high-risk candidate under budget: NEEDS_REVIEW, audit-logged, notified", async () => {
    mockCount
      .mockResolvedValueOnce(0) // isFirstOfKindCell: zero approved rows -> first-of-kind true
      .mockResolvedValueOnce(WEEKLY_REVIEW_BUDGET - 1); // getFlaggedCountInWindow: under budget

    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("flagged");
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-high" },
      data: {
        status: "NEEDS_REVIEW",
        payload: expect.objectContaining({
          existing: "field",
          riskFlagged: true,
          riskScore: expect.any(Number),
          riskReasons: expect.arrayContaining(["grade_band_g1_3", "first_of_kind_cell"]),
        }),
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "curriculum.risk.flagged", resourceId: "content-high" })
    );
    expect(mockNotify).toHaveBeenCalledWith("content-high", expect.any(Number), expect.any(Array));
  });

  it("auto-approves a high-risk candidate when the weekly budget is exhausted, but still stamps risk data and marks budgetExceeded", async () => {
    mockCount
      .mockResolvedValueOnce(0) // first-of-kind
      .mockResolvedValueOnce(WEEKLY_REVIEW_BUDGET); // at/over budget

    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("approved");
    expect(result.budgetExceeded).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { contentId: "content-high" },
      data: {
        status: "published",
        payload: expect.objectContaining({ riskScore: expect.any(Number) }),
      },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "curriculum.risk.autoapproved",
        details: expect.objectContaining({ budgetExceeded: true }),
      })
    );
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(
      "[riskTriage] weekly review budget exhausted, auto-approving a high-risk candidate",
      expect.objectContaining({ contentId: "content-high" })
    );
  });

  it("fails closed to flagging when the budget check throws", async () => {
    mockCount
      .mockResolvedValueOnce(0) // first-of-kind
      .mockRejectedValueOnce(new Error("db down")); // getFlaggedCountInWindow throws

    const result = await triageAndApprove(HIGH_RISK_CANDIDATE, "system:bulk-approve-published", "published");

    expect(result.action).toBe("flagged");
    expect(mockWarn).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "NEEDS_REVIEW" }) })
    );
  });

  it("supports approvedStatus='APPROVED' for the promotion-pass-2b convention", async () => {
    mockCount.mockResolvedValueOnce(0);
    const result = await triageAndApprove(LOW_RISK_CANDIDATE, "system:promotion-pass-2b", "APPROVED");
    expect(result.action).toBe("approved");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/curriculum-risk-triage/triage-and-approve.test.ts`
Expected: FAIL - `triageAndApprove` is not exported yet.

- [ ] **Step 3: Implement `triageAndApprove`**

Append to `lib/curriculum/riskTriage.ts`:

```ts
export type TriageCandidate = {
  contentId: string;
  grade: number;
  subject: string;
  payload: Record<string, any>;
  wordCount: number;
  minWordCount: number;
};

export type TriageResult =
  | { action: "flagged"; contentId: string; riskScore: number; riskReasons: string[] }
  | {
      action: "approved";
      contentId: string;
      riskScore: number;
      riskReasons: string[];
      budgetExceeded: boolean;
    };

/**
 * Orchestrates one candidate through risk scoring, the weekly review budget,
 * and the final DB write. Called only from automated/script-driven approval
 * paths - see the module header comment. `approvedStatus` lets each caller
 * keep its own existing "approved" status string ("published" for
 * bulk-approve-published.ts, "APPROVED" for promote-enriched-lessons.ts).
 */
export async function triageAndApprove(
  candidate: TriageCandidate,
  actorLabel: string,
  approvedStatus: string
): Promise<TriageResult> {
  const isFirstOfKind = await isFirstOfKindCell(candidate.grade, candidate.subject);
  const { score, reasons } = computeRiskScore({
    grade: candidate.grade,
    subject: candidate.subject,
    isFirstOfKind,
    wordCount: candidate.wordCount,
    minWordCount: candidate.minWordCount,
  });

  const worthFlagging = isWorthFlagging(score);
  let overBudget = false;

  if (worthFlagging) {
    try {
      const flaggedCount = await getFlaggedCountInWindow();
      overBudget = flaggedCount >= WEEKLY_REVIEW_BUDGET;
    } catch (error) {
      logger.warn("[riskTriage] budget check failed, failing closed to flagged", {
        contentId: candidate.contentId,
        error,
      });
      overBudget = false;
    }
  }

  const shouldFlag = worthFlagging && !overBudget;

  if (worthFlagging && overBudget) {
    logger.warn("[riskTriage] weekly review budget exhausted, auto-approving a high-risk candidate", {
      contentId: candidate.contentId,
      riskScore: score,
      riskReasons: reasons,
    });
  }

  if (shouldFlag) {
    await prisma.curriculumContent.update({
      where: { contentId: candidate.contentId },
      data: {
        status: "NEEDS_REVIEW",
        payload: {
          ...candidate.payload,
          riskFlagged: true,
          riskScore: score,
          riskReasons: reasons,
          flaggedAt: new Date().toISOString(),
        },
      },
    });
    await logAudit({
      action: "curriculum.risk.flagged",
      resourceType: "curriculum",
      resourceId: candidate.contentId,
      details: { riskScore: score, riskReasons: reasons, actor: actorLabel },
    });
    await notifyRiskReviewers(candidate.contentId, score, reasons).catch((error) => {
      logger.warn("[riskTriage] reviewer notification failed", {
        contentId: candidate.contentId,
        error,
      });
    });
    return { action: "flagged", contentId: candidate.contentId, riskScore: score, riskReasons: reasons };
  }

  await prisma.curriculumContent.update({
    where: { contentId: candidate.contentId },
    data: {
      status: approvedStatus,
      payload: {
        ...candidate.payload,
        riskScore: score,
        riskReasons: reasons,
      },
    },
  });
  await logAudit({
    action: "curriculum.risk.autoapproved",
    resourceType: "curriculum",
    resourceId: candidate.contentId,
    details: { riskScore: score, riskReasons: reasons, actor: actorLabel, budgetExceeded: overBudget },
  });
  return {
    action: "approved",
    contentId: candidate.contentId,
    riskScore: score,
    riskReasons: reasons,
    budgetExceeded: overBudget,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/curriculum-risk-triage/triage-and-approve.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full risk-triage test folder together**

Run: `npx vitest run __tests__/curriculum-risk-triage/`
Expected: PASS (all 4 files so far)

- [ ] **Step 6: Commit**

```bash
git add lib/curriculum/riskTriage.ts __tests__/curriculum-risk-triage/triage-and-approve.test.ts
git commit -m "feat: curriculum risk-triage triageAndApprove orchestrator"
```

---

## Task 5: Regression test - human-driven routes stay untouched

**Files:**
- Test: `__tests__/curriculum-risk-triage/human-routes-untouched.test.ts`

**Interfaces:**
- Consumes: nothing new - reads source files as text.

- [ ] **Step 1: Write the test**

Create `__tests__/curriculum-risk-triage/human-routes-untouched.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Curriculum risk-triage (lib/curriculum/riskTriage.ts) must only ever be
// called from automated/script-driven approval paths. A human clicking
// Approve/Reject on these three routes already IS the review - triage must
// never intercept that path. This locks the boundary in as a regression
// guard, since a future edit adding an import here would silently reintroduce
// automated status changes on a human-driven route.
const HUMAN_ROUTES = [
  "app/api/admin/curriculum/approve/route.ts",
  "app/api/admin/curriculum/reject/route.ts",
  "app/api/admin/ops/curriculum-review/route.ts",
  "lib/curriculum/regenerationAdmin.ts",
];

describe("human-driven curriculum routes never import risk-triage", () => {
  it.each(HUMAN_ROUTES)("%s has no riskTriage import", (relativePath) => {
    const source = readFileSync(path.join(process.cwd(), relativePath), "utf8");
    expect(source).not.toMatch(/riskTriage/);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes immediately**

Run: `npx vitest run __tests__/curriculum-risk-triage/human-routes-untouched.test.ts`
Expected: PASS (nothing has touched these files yet - this test locks in the
current, correct state before Tasks 6-8 modify anything nearby).

- [ ] **Step 3: Commit**

```bash
git add __tests__/curriculum-risk-triage/human-routes-untouched.test.ts
git commit -m "test: lock human-driven curriculum routes out of risk-triage"
```

---

## Task 6: Migrate `scripts/bulk-approve-published.ts`

**Files:**
- Modify: `scripts/bulk-approve-published.ts`

**Interfaces:**
- Consumes: `triageAndApprove`, `computeRiskScore`, `isFirstOfKindCell`,
  `getFlaggedCountInWindow`, `isWorthFlagging`, `WEEKLY_REVIEW_BUDGET` from
  `@/lib/curriculum/riskTriage`.

- [ ] **Step 1: Replace the script's own PrismaClient with the shared singleton and wire in triage**

Rewrite `scripts/bulk-approve-published.ts` in full:

```ts
// Approves NEEDS_REVIEW lessons that meet quality thresholds.
//
// IMPORTANT (NR-11, 2026-08-02 -> risk-triage 2026-08-03): this used to be a
// pure automated content-quality gate with no human involvement at all. It
// now routes its highest-risk passing candidates to a real human/MOE
// reviewer instead of auto-approving silently - see
// docs/superpowers/specs/2026-08-03-curriculum-risk-triage-design.md and
// lib/curriculum/riskTriage.ts. Everything that still auto-approves is now
// audit-logged and risk-stamped for the first time (unlike the pre-triage
// behavior, where 712 of 1,089 APPROVED/published rows carried no approver
// identity at all).
//
// Quality gates (a lesson must pass ALL to be a triage candidate):
//   1. word count >= grade-band minimum:
//        G1-G3: 400 words  |  G4-G6: 600 words  |  G7-G12: 800 words
//   2. Has substantive content (text length >= 200 chars - filters empty shells)
//   3. Title is not a placeholder ("untitled", "test", "draft", etc.)
//
// Usage:
//   # Dry run (shows what would happen, changes nothing):
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts --dry-run
//
//   # Priority grades first (G5 and G7 have the most critical deserts):
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts --grades=5,7
//
//   # Run against all passing lessons:
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from "@/lib/db";
import {
  computeRiskScore,
  isFirstOfKindCell,
  isWorthFlagging,
  getFlaggedCountInWindow,
  triageAndApprove,
  WEEKLY_REVIEW_BUDGET,
} from "@/lib/curriculum/riskTriage";

const PLACEHOLDER_TITLES = [
  "untitled",
  "test",
  "draft",
  "placeholder",
  "todo",
  "tbd",
  "lesson title",
];

// Grade-band word minimums - these plain-text lessons (~700-900 words) use a
// different format than the block/standard lessons (which target 1200+).
const MIN_WORDS_BY_GRADE: Record<number, number> = {
  1: 400, 2: 400, 3: 400,
  4: 600, 5: 600, 6: 600,
  7: 800, 8: 800, 9: 800,
  10: 800, 11: 800, 12: 800,
};

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const p = payload as Record<string, unknown>;
  return (
    (typeof p.lessonContent === "string" ? p.lessonContent : "") ||
    (typeof p.content === "string" ? p.content : "") ||
    (typeof p.lessonBody === "string" ? p.lessonBody : "") ||
    (typeof p.body_block === "string" ? p.body_block : "") ||
    (typeof p.body_standard === "string" ? p.body_standard : "") ||
    (typeof p.body === "string" ? p.body : "")
  );
}

function wordCount(text: string): number {
  return text.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function getDepthWordCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const gen = p.generationMetadata;
  if (!gen || typeof gen !== "object" || Array.isArray(gen)) return null;
  const g = gen as Record<string, unknown>;
  return typeof g.depthWordCount === "number" ? g.depthWordCount : null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const gradesArg = args.find((a) => a.startsWith("--grades="));
  const gradeFilter = gradesArg
    ? gradesArg.replace("--grades=", "").split(",").map(Number).filter((n) => !isNaN(n))
    : null;

  const candidates = await prisma.curriculumContent.findMany({
    where: {
      status: "NEEDS_REVIEW",
      contentType: "lesson",
      ...(gradeFilter ? { grade: { in: gradeFilter } } : {}),
    },
    select: {
      id: true,
      contentId: true,
      grade: true,
      subject: true,
      title: true,
      payload: true,
    },
  });

  console.log(`\nFound ${candidates.length} NEEDS_REVIEW lessons to evaluate`);
  if (dryRun) console.log("DRY RUN - no changes will be made");
  if (gradeFilter) console.log(`Grade filter: G${gradeFilter.join(", G")}`);
  console.log();

  let approved = 0;
  let flagged = 0;
  let rejected = 0;
  const rejectReasons: string[] = [];

  for (const lesson of candidates) {
    const text = extractText(lesson.payload);
    const depthWords = getDepthWordCount(lesson.payload);
    const words = depthWords ?? wordCount(text);
    const minWords = MIN_WORDS_BY_GRADE[lesson.grade] ?? 400;
    const titleLower = (lesson.title ?? "").toLowerCase();

    const wordGate = words >= minWords;
    const contentGate = text.length >= 200;
    const titleGate = !PLACEHOLDER_TITLES.some((p) => titleLower.includes(p));

    if (!contentGate) {
      rejected++;
      rejectReasons.push(
        `[EMPTY]  G${lesson.grade} ${lesson.subject} - "${lesson.title ?? lesson.contentId}" - no body content`
      );
      continue;
    }
    if (!wordGate) {
      rejected++;
      rejectReasons.push(
        `[THIN]   G${lesson.grade} ${lesson.subject} - "${lesson.title ?? lesson.contentId}" - ${words} words (min ${minWords})`
      );
      continue;
    }
    if (!titleGate) {
      rejected++;
      rejectReasons.push(
        `[TITLE]  G${lesson.grade} ${lesson.subject} - placeholder title: "${lesson.title}"`
      );
      continue;
    }

    if (dryRun) {
      // Read-only preview: same scoring/budget logic triageAndApprove uses,
      // but no writes - mirrors what a real run would decide.
      const isFirstOfKind = await isFirstOfKindCell(lesson.grade, lesson.subject);
      const { score, reasons } = computeRiskScore({
        grade: lesson.grade,
        subject: lesson.subject,
        isFirstOfKind,
        wordCount: words,
        minWordCount: minWords,
      });
      const worthFlagging = isWorthFlagging(score);
      let wouldFlag = false;
      if (worthFlagging) {
        const flaggedCount = await getFlaggedCountInWindow().catch(() => WEEKLY_REVIEW_BUDGET);
        wouldFlag = flaggedCount < WEEKLY_REVIEW_BUDGET;
      }
      if (wouldFlag) {
        flagged++;
        process.stdout.write(
          `[WOULD FLAG] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (score ${score}: ${reasons.join(", ")})\n`
        );
      } else {
        approved++;
        process.stdout.write(
          `[WOULD APPROVE] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (${words}w, score ${score})\n`
        );
      }
      continue;
    }

    const result = await triageAndApprove(
      {
        contentId: lesson.contentId,
        grade: lesson.grade,
        subject: lesson.subject,
        payload: (lesson.payload as Record<string, unknown>) ?? {},
        wordCount: words,
        minWordCount: minWords,
      },
      "system:bulk-approve-published",
      "published"
    );

    if (result.action === "flagged") {
      flagged++;
      if (flagged <= 20) {
        process.stdout.write(
          `[FLAGGED FOR REVIEW] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (score ${result.riskScore}: ${result.riskReasons.join(", ")})\n`
        );
      }
    } else {
      approved++;
      if (approved <= 20 || approved % 50 === 0) {
        process.stdout.write(
          `[APPROVED] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (${words}w, score ${result.riskScore})\n`
        );
      } else if (approved === 21) {
        process.stdout.write("... (showing every 50th after first 20)\n");
      }
    }
  }

  console.log("\n========= SUMMARY =========");
  console.log(`${dryRun ? "Would approve" : "Approved"}: ${approved}`);
  console.log(`${dryRun ? "Would flag for review" : "Flagged for review"}: ${flagged}`);
  console.log(`Skipped (below quality gate): ${rejected}`);

  if (rejectReasons.length > 0) {
    console.log("\nSkipped lessons:");
    rejectReasons.slice(0, 30).forEach((r) => console.log(" ", r));
    if (rejectReasons.length > 30) {
      console.log(`  ... and ${rejectReasons.length - 30} more`);
    }
  }

  if (!dryRun && approved > 0) {
    console.log(
      "\nNote: Coverage cache will refresh automatically on next request (30-min TTL)."
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Type-check the script in isolation**

Run: `npx tsc --noEmit`
Expected: PASS - no type errors introduced (this also validates the whole
project still compiles, since a script-level path-alias mistake would surface
here).

- [ ] **Step 3: Re-run the full risk-triage and NR-11 test suites to confirm nothing else broke**

Run: `npx vitest run __tests__/curriculum-risk-triage/ __tests__/nr11/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/bulk-approve-published.ts
git commit -m "feat: wire bulk-approve-published.ts onto curriculum risk-triage"
```

---

## Task 7: Migrate `scripts/promote-enriched-lessons.ts`

**Files:**
- Modify: `scripts/promote-enriched-lessons.ts`

**Interfaces:**
- Consumes: `triageAndApprove` from `@/lib/curriculum/riskTriage`;
  `evaluatePromotionCandidate` from `@/lib/curriculum/promotionPass` (unchanged).

- [ ] **Step 1: Replace the direct status write with `triageAndApprove`**

Rewrite `scripts/promote-enriched-lessons.ts` in full:

```ts
// IMPORTANT (NR-11, 2026-08-02 -> risk-triage 2026-08-03): this used to
// promote generated content straight to APPROVED using an automated
// structural gate only, with no human involvement, no reviewer identity, and
// nothing written to AuditLog. It now routes its highest-risk passing
// candidates to a real human/MOE reviewer instead - see
// docs/superpowers/specs/2026-08-03-curriculum-risk-triage-design.md and
// lib/curriculum/riskTriage.ts. See bulk-approve-published.ts for the sibling
// script and the production evidence of how much live content was approved
// without review before this change.
import { config } from "dotenv";
import { prisma } from "@/lib/db";
import { evaluatePromotionCandidate } from "@/lib/curriculum/promotionPass";
import { triageAndApprove } from "@/lib/curriculum/riskTriage";

config({ path: ".env.local" });
config();

function numberArg(flag: string, fallback: number) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const batchSize = numberArg("--batch-size", 100);
  const approvedBy = "system:promotion-pass-2b";

  const candidates = await prisma.curriculumContent.findMany({
    where: {
      contentType: "lesson",
      status: "generated",
    },
    select: {
      id: true,
      contentId: true,
      grade: true,
      subject: true,
      status: true,
      payload: true,
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
  });

  let promoted = 0;
  let flagged = 0;
  let failed = 0;
  let promotedWords = 0;

  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);

    for (const row of batch) {
      const approvedAtIso = new Date().toISOString();
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, any>)
        : {};
      const decision = evaluatePromotionCandidate(
        {
          contentId: row.contentId,
          grade: row.grade,
          subject: row.subject,
          status: row.status,
          payload,
        },
        approvedAtIso,
        approvedBy
      );

      if (decision.action === "promote") {
        const result = await triageAndApprove(
          {
            contentId: row.contentId,
            grade: row.grade,
            subject: row.subject,
            payload: decision.normalizedPayload,
            wordCount: decision.words,
            minWordCount: 1200,
          },
          "system:promotion-pass-2b",
          "APPROVED"
        );

        if (result.action === "flagged") {
          flagged += 1;
          console.log(`Flagged for review: ${row.subject} Grade ${row.grade} - ${decision.words} words (score ${result.riskScore})`);
        } else {
          promoted += 1;
          promotedWords += decision.words;
          console.log(`Promoted: ${row.subject} Grade ${row.grade} - ${decision.words} words (score ${result.riskScore})`);
        }
        continue;
      }

      if (decision.gate != null) {
        failed += 1;
        console.log(`FAILED Gate ${decision.gate}: ${row.subject} Grade ${row.grade} - ${decision.reason}`);
      } else {
        console.log(`SKIPPED: ${row.subject} Grade ${row.grade} - ${decision.reason}`);
      }
    }
  }

  const totalApproved = await prisma.curriculumContent.count({
    where: {
      contentType: "lesson",
      status: "APPROVED",
    },
  });

  console.log("Promotion complete.");
  console.log(`Promoted: ${promoted} lessons`);
  console.log(`Flagged for review: ${flagged} lessons`);
  console.log(`Failed gates: ${failed} lessons`);
  console.log(`Total APPROVED now: ${totalApproved} lessons`);
  console.log(`Average word count of promoted: ${promoted > 0 ? Math.round(promotedWords / promoted) : 0} words`);
}

main()
  .catch((error) => {
    console.error("[PROMOTION PASS 2B] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Re-run the full risk-triage and NR-11 test suites**

Run: `npx vitest run __tests__/curriculum-risk-triage/ __tests__/nr11/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/promote-enriched-lessons.ts
git commit -m "feat: wire promote-enriched-lessons.ts onto curriculum risk-triage"
```

---

## Task 8: Review-page "awaiting your review" badge

**Files:**
- Modify: `app/api/admin/ops/curriculum-review/route.ts`
- Modify: `app/admin/ops/curriculum-review/page.tsx`
- Test: extend `__tests__/nr11/moe-approval-access.test.ts` (add one assertion, no
  new file)

**Interfaces:**
- Consumes: `countRiskFlaggedAwaitingReview` from `@/lib/curriculum/riskTriage`
  (Task 2).

- [ ] **Step 1: Write the failing test - GET response includes the new field**

Edit `__tests__/nr11/moe-approval-access.test.ts`: add a mock for the new
dependency and one assertion. First add this mock near the other `vi.mock` calls
(after the `regenerationAdmin` mock):

```ts
const mockCountRiskFlaggedAwaitingReview = vi.hoisted(() => vi.fn(async () => 0));
vi.mock("@/lib/curriculum/riskTriage", () => ({
  countRiskFlaggedAwaitingReview: mockCountRiskFlaggedAwaitingReview,
}));
```

Then add this test inside the `describe.each` block for roles holding
`CURRICULUM_APPROVE` (after the existing `"GET .../curriculum-review succeeds"`
test):

```ts
  it("GET /api/admin/ops/curriculum-review includes riskFlaggedAwaitingReview", async () => {
    mockRequireUser.mockResolvedValue(user);
    mockCountRiskFlaggedAwaitingReview.mockResolvedValue(3);
    const res = await reviewGet(new Request("http://localhost/api/admin/ops/curriculum-review") as any);
    const body = await res.json();
    expect(body.riskFlaggedAwaitingReview).toBe(3);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/nr11/moe-approval-access.test.ts`
Expected: FAIL - `body.riskFlaggedAwaitingReview` is `undefined` (route doesn't
return it yet), and the new top-level `vi.mock("@/lib/curriculum/riskTriage")`
has nothing real to mock against yet in the route.

- [ ] **Step 3: Add the count to the route's GET response**

Edit `app/api/admin/ops/curriculum-review/route.ts` - add the import and change
the `GET` handler's return:

```ts
import { countRiskFlaggedAwaitingReview } from "@/lib/curriculum/riskTriage";
```

Change:

```ts
    const drafts = await listCurriculumDrafts({
      grade: numberParam(url.searchParams.get("grade")),
      subject: url.searchParams.get("subject") ?? undefined,
      status: url.searchParams.get("status") ?? "DRAFT",
      limit: numberParam(url.searchParams.get("limit")),
    });
    return NextResponse.json({ drafts });
```

to:

```ts
    const [drafts, riskFlaggedAwaitingReview] = await Promise.all([
      listCurriculumDrafts({
        grade: numberParam(url.searchParams.get("grade")),
        subject: url.searchParams.get("subject") ?? undefined,
        status: url.searchParams.get("status") ?? "DRAFT",
        limit: numberParam(url.searchParams.get("limit")),
      }),
      countRiskFlaggedAwaitingReview(),
    ]);
    return NextResponse.json({ drafts, riskFlaggedAwaitingReview });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/nr11/moe-approval-access.test.ts`
Expected: PASS (all existing NR-11 assertions plus the new one)

- [ ] **Step 5: Render the badge on the review page**

Edit `app/admin/ops/curriculum-review/page.tsx` - add the import and fetch, then
render the badge in the header. Change:

```ts
import { listCurriculumDrafts } from "@/lib/curriculum/regenerationAdmin";
```

to:

```ts
import { listCurriculumDrafts } from "@/lib/curriculum/regenerationAdmin";
import { countRiskFlaggedAwaitingReview } from "@/lib/curriculum/riskTriage";
```

Change:

```ts
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.CURRICULUM_APPROVE)) redirect("/");
  const drafts = await listCurriculumDrafts({
    grade: parseGrade(searchParams?.grade),
    subject: searchParams?.subject,
    status: searchParams?.status ?? "DRAFT",
    limit: 75,
  });
```

to:

```ts
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.CURRICULUM_APPROVE)) redirect("/");
  const [drafts, riskFlaggedAwaitingReview] = await Promise.all([
    listCurriculumDrafts({
      grade: parseGrade(searchParams?.grade),
      subject: searchParams?.subject,
      status: searchParams?.status ?? "DRAFT",
      limit: 75,
    }),
    countRiskFlaggedAwaitingReview(),
  ]);
```

Change the header block:

```ts
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Platform Operations</p>
          <h1 className="text-2xl font-semibold">Curriculum Draft Review</h1>
        </header>
```

to:

```ts
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">Platform Operations</p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Curriculum Draft Review</h1>
            {riskFlaggedAwaitingReview > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                {riskFlaggedAwaitingReview} flagged by risk-triage awaiting your review
              </span>
            )}
          </div>
        </header>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/ops/curriculum-review/route.ts app/admin/ops/curriculum-review/page.tsx __tests__/nr11/moe-approval-access.test.ts
git commit -m "feat: surface risk-triage backlog count on curriculum review page"
```

---

## Task 9: Full gate + doc closeout

**Files:**
- Modify: `docs/roadmaps/CURRENT_EXECUTION_STATE.md` (closeout note)

- [ ] **Step 1: Run the full mandatory gate**

Run in order, stopping on any failure:

```bash
npx prisma generate
npx tsc --noEmit
npx vitest run
npm run build
```

Expected: all four PASS. Record the exact test count (e.g. `4,5XX tests / 5XX
files`) for the closeout note in Step 3 - do not guess it from memory.

- [ ] **Step 2: Manually dry-run `bulk-approve-published.ts` against production data (read-only)**

This is the closest thing to a live proof this plan can give without writing to
production - `--dry-run` makes zero database writes.

Run: `npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts --dry-run`

Expected: script runs to completion, prints a mix of `[WOULD APPROVE]` and
`[WOULD FLAG]` lines (confirms real production NEEDS_REVIEW rows now produce
both outcomes, not just approvals), and the `SUMMARY` block's `Would flag for
review` count is 0 or a small number bounded near `WEEKLY_REVIEW_BUDGET` (8) -
if it's far higher, treat that as a signal to revisit `FLAG_THRESHOLD` before
this is used for a real (non-dry-run) pass, not something to silently accept.

- [ ] **Step 3: Add the closeout note to `CURRENT_EXECUTION_STATE.md`**

Add a new bullet at the same place recent entries were added (after the most
recent NR-12 bullet), following the existing entry style: what shipped, the
real gate numbers from Step 1, and the dry-run evidence from Step 2. Do not
mark NR-12 itself as started - this closes only the risk-triage
prerequisite.

- [ ] **Step 4: Commit the doc closeout**

```bash
git add docs/roadmaps/CURRENT_EXECUTION_STATE.md
git commit -m "docs: curriculum risk-triage merged, ready for NR-12"
```
