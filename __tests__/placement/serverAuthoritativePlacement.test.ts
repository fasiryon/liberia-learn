import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createFakePlacementDb } from "./fakePlacementDb";

const { fake, mockRoutedCompletion, mockLogAudit, mockNotify } = vi.hoisted(() => ({
  fake: { current: null as any },
  mockRoutedCompletion: vi.fn(),
  mockLogAudit: vi.fn(),
  mockNotify: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  get prisma() {
    return fake.current.db;
  },
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/ai/routedCompletion", () => ({ routedCompletion: mockRoutedCompletion }));
vi.mock("@/lib/ai/promptRegistry", () => ({
  buildPrompt: () => "system prompt",
  getPromptMetadata: () => ({ key: "placement.question.system", version: "1", hash: "h" }),
}));
vi.mock("@/lib/placement-notifications", () => ({ notifyPlacementConfirmation: mockNotify }));

import {
  startOrResumeSession,
  issueNextItem,
  submitResponse,
  completeSession,
  getSession,
} from "@/lib/placementAuthority/sessionService";
import { recordPlacementReview, confirmOfficialPlacement } from "@/lib/placementAuthority/decisionService";
import { PLACEMENT_MAX_ITEMS } from "@/lib/placementAuthority/scoring";

const LEARNER = { id: "user-a", role: "STUDENT", schoolId: "school-1" };
const OTHER_LEARNER = { id: "user-b", role: "STUDENT", schoolId: "school-1" };
const TEACHER = { id: "teacher-1", role: "TEACHER", schoolId: "school-1", isPlatformAdmin: false };
const ADMIN = { id: "admin-1", role: "ADMIN", schoolId: "school-1", isPlatformAdmin: false };
const OTHER_SCHOOL_ADMIN = { id: "admin-9", role: "ADMIN", schoolId: "school-9", isPlatformAdmin: false };
const OTHER_SCHOOL_TEACHER = { id: "teacher-9", role: "TEACHER", schoolId: "school-9", isPlatformAdmin: false };

let opCounter = 0;
const op = () => `operation-${++opCounter}-xyz`;

async function answerItem(user: any, sessionId: string, choose: "correct" | "wrong") {
  const { item } = await issueNextItem(user, sessionId);
  const stored = fake.current.state.items.find((i: any) => i.id === item.id);
  const selectedIndex = choose === "correct" ? stored.correctIndex : (stored.correctIndex + 1) % stored.options.length;
  return submitResponse(user, sessionId, { itemId: item.id, itemVersion: item.itemVersion, selectedIndex, operationId: op() });
}

async function completedPlacement(user = LEARNER, correctCount = 7) {
  const session = await startOrResumeSession(user);
  for (let i = 0; i < PLACEMENT_MAX_ITEMS; i++) {
    await answerItem(user, session.sessionId, i < correctCount ? "correct" : "wrong");
  }
  return completeSession(user, session.sessionId);
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.current = createFakePlacementDb();
  fake.current.addLearner({ userId: "user-a", studentId: "student-a", schoolId: "school-1", currentGrade: 4 });
  fake.current.addLearner({ userId: "user-b", studentId: "student-b", schoolId: "school-1", currentGrade: 5 });
  // AI unavailable by default: the server item bank supplies items.
  mockRoutedCompletion.mockRejectedValue(new Error("AI offline"));
  mockLogAudit.mockResolvedValue(undefined);
});

describe("answer custody", () => {
  it("never serializes the answer key, explanation, or correctness before a response", async () => {
    const session = await startOrResumeSession(LEARNER);
    const { item } = await issueNextItem(LEARNER, session.sessionId);
    const json = JSON.stringify(item);
    for (const leaked of ["correctIndex", "correctAnswer", "explanation", "isCorrect", "answer"]) {
      expect(json).not.toContain(`"${leaked}"`);
    }
    const state = await getSession(LEARNER, session.sessionId);
    expect(JSON.stringify(state.currentItem)).not.toContain("correctIndex");
  });

  it("keeps an AI-generated key server-side too", async () => {
    mockRoutedCompletion.mockResolvedValueOnce({
      content: JSON.stringify({
        question: "What is 12 x 3?",
        options: ["36", "32", "38", "30"],
        correctAnswer: 0,
        explanation: "12 times 3 is 36.",
        subject: "mathematics",
        strand: "operations",
        moeStandard: null,
        whyThisQuestion: "w",
        commonMistake: "c",
        hint: "h",
      }),
    });
    const session = await startOrResumeSession(LEARNER);
    const { item } = await issueNextItem(LEARNER, session.sessionId);
    expect(item.prompt).toBe("What is 12 x 3?");
    expect(JSON.stringify(item)).not.toMatch(/correct|explanation|12 times 3/);
  });

  it("reports correctness but never reveals the key, even after the response is stored", async () => {
    const session = await startOrResumeSession(LEARNER);
    const result: any = await answerItem(LEARNER, session.sessionId, "wrong");
    expect(result.item.isCorrect).toBe(false);
    expect(result.item).not.toHaveProperty("correctIndex");
    expect(result.item).not.toHaveProperty("explanation");
  });

  it("no client component bundles placement answer keys", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== "node_modules" && name !== "api") walk(path);
        } else if (/\.(tsx|ts)$/.test(name)) {
          const src = readFileSync(path, "utf8");
          const isClient = /^\s*["']use client["']/.test(src);
          if (isClient && /placementAuthority\/(itemBank|items|sessionService|scoring)/.test(src)) offenders.push(path);
          if (isClient && /correctAnswer:\s*\d|answer:\s*"[^"]+",\s*\n\s*difficulty/.test(src) && /placement/i.test(path)) {
            offenders.push(path);
          }
        }
      }
    };
    walk("app");
    walk("components");
    expect(offenders).toEqual([]);
  });
});

describe("server scoring and client authority", () => {
  it.each([["correct"], ["isCorrect"], ["score"], ["band"], ["estimatedGrade"], ["correctIndex"]])(
    "rejects a client-supplied %s field",
    async (field) => {
      const session = await startOrResumeSession(LEARNER);
      const { item } = await issueNextItem(LEARNER, session.sessionId);
      await expect(
        submitResponse(LEARNER, session.sessionId, {
          itemId: item.id,
          itemVersion: item.itemVersion,
          selectedIndex: 0,
          operationId: op(),
          [field]: true,
        })
      ).rejects.toMatchObject({ status: 400, code: "client_authority_fields_rejected" });
      expect(fake.current.state.items[0].respondedAt).toBeNull();
    }
  );

  it("derives score, band, and recommendation on the server and never changes the official grade", async () => {
    const result = await completedPlacement(LEARNER, 10);
    const placement = fake.current.state.placements[0];
    expect(result).toMatchObject({ status: "COMPLETED", correctAnswers: 10, totalQuestions: 10, officialPlacement: "pending_review" });
    expect(placement).toMatchObject({ source: "server_session", rawScore: 10, totalQuestions: 10, band: "advanced" });
    expect(placement.estimatedGrade).toBeGreaterThanOrEqual(6);
    expect(fake.current.state.students.find((s: any) => s.id === "student-a").currentGrade).toBe(4);
    expect(JSON.stringify(result)).not.toContain("estimatedGrade");
  });

  it("refuses to finish before every item is answered", async () => {
    const session = await startOrResumeSession(LEARNER);
    await answerItem(LEARNER, session.sessionId, "correct");
    await expect(completeSession(LEARNER, session.sessionId)).rejects.toMatchObject({ status: 409, code: "session_incomplete" });
  });
});

describe("binding, replay, and tamper resistance", () => {
  it("rejects an altered item version", async () => {
    const session = await startOrResumeSession(LEARNER);
    const { item } = await issueNextItem(LEARNER, session.sessionId);
    await expect(
      submitResponse(LEARNER, session.sessionId, { itemId: item.id, itemVersion: "tampered", selectedIndex: 0, operationId: op() })
    ).rejects.toMatchObject({ status: 409, code: "item_version_mismatch" });
  });

  it("rejects an item id from another session (cross-session reuse)", async () => {
    const a = await startOrResumeSession(LEARNER);
    const b = await startOrResumeSession(OTHER_LEARNER);
    const { item } = await issueNextItem(OTHER_LEARNER, b.sessionId);
    await expect(
      submitResponse(LEARNER, a.sessionId, { itemId: item.id, itemVersion: item.itemVersion, selectedIndex: 0, operationId: op() })
    ).rejects.toMatchObject({ status: 404, code: "item_not_found" });
  });

  it("hides another learner's session", async () => {
    const other = await startOrResumeSession(OTHER_LEARNER);
    await expect(getSession(LEARNER, other.sessionId)).rejects.toMatchObject({ status: 404 });
    await expect(issueNextItem(LEARNER, other.sessionId)).rejects.toMatchObject({ status: 404 });
    await expect(completeSession(LEARNER, other.sessionId)).rejects.toMatchObject({ status: 404 });
  });

  it("replays the same operation idempotently and refuses a changed answer", async () => {
    const session = await startOrResumeSession(LEARNER);
    const { item } = await issueNextItem(LEARNER, session.sessionId);
    const body = { itemId: item.id, itemVersion: item.itemVersion, selectedIndex: 1, operationId: "stable-operation-1" };
    const first = await submitResponse(LEARNER, session.sessionId, body);
    const replay = await submitResponse(LEARNER, session.sessionId, body);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.item.isCorrect).toBe(first.item.isCorrect);
    await expect(
      submitResponse(LEARNER, session.sessionId, { ...body, selectedIndex: 2, operationId: "stable-operation-2" })
    ).rejects.toMatchObject({ status: 409, code: "response_already_recorded" });
    expect(fake.current.state.items.filter((i: any) => i.respondedAt)).toHaveLength(1);
  });

  it("re-issues the same pending item on refresh instead of a new one", async () => {
    const session = await startOrResumeSession(LEARNER);
    const first = await issueNextItem(LEARNER, session.sessionId);
    const again = await issueNextItem(LEARNER, session.sessionId);
    expect(again.item.id).toBe(first.item.id);
    expect(fake.current.state.items).toHaveLength(1);
  });

  it("completion is idempotent and creates one placement result", async () => {
    const result = await completedPlacement();
    const sessionId = fake.current.state.sessions[0].id;
    const again = await completeSession(LEARNER, sessionId);
    expect(again.placementId).toBe(result.placementId);
    expect(again.replayed).toBe(true);
    expect(fake.current.state.placements).toHaveLength(1);
  });

  it("refuses a response after completion", async () => {
    await completedPlacement();
    const sessionId = fake.current.state.sessions[0].id;
    const item = fake.current.state.items[0];
    await expect(
      submitResponse(LEARNER, sessionId, { itemId: item.id, itemVersion: item.itemVersion, selectedIndex: 0, operationId: op() })
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses writes to an expired session and starts a fresh one", async () => {
    const session = await startOrResumeSession(LEARNER);
    const { item } = await issueNextItem(LEARNER, session.sessionId);
    fake.current.state.sessions[0].expiresAt = new Date(Date.now() - 1000);
    await expect(
      submitResponse(LEARNER, session.sessionId, { itemId: item.id, itemVersion: item.itemVersion, selectedIndex: 0, operationId: op() })
    ).rejects.toMatchObject({ status: 410, code: "session_expired" });
    expect(fake.current.state.sessions[0].status).toBe("EXPIRED");
    const fresh = await startOrResumeSession(LEARNER);
    expect(fresh.sessionId).not.toBe(session.sessionId);
  });

  it("refuses non-learners and learners from another tenant", async () => {
    await expect(startOrResumeSession(TEACHER as any)).rejects.toMatchObject({ status: 403 });
    await expect(startOrResumeSession({ id: "user-a", role: "STUDENT", schoolId: "school-9" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("human authority: review vs official confirm", () => {
  it("a teacher review records a recommendation and never changes the grade", async () => {
    const { placementId } = await completedPlacement();
    const result = await recordPlacementReview(TEACHER, placementId, { recommendation: "endorse" });
    expect(result.officialGradeChanged).toBe(false);
    expect(fake.current.state.reviews).toHaveLength(1);
    expect(fake.current.state.students.find((s: any) => s.id === "student-a").currentGrade).toBe(4);
    expect(fake.current.state.placements[0].teacherDecision).toBeNull();
  });

  it("an ordinary teacher cannot confirm the official grade", async () => {
    const { placementId } = await completedPlacement();
    await expect(confirmOfficialPlacement(TEACHER, placementId, { finalGrade: 5 })).rejects.toMatchObject({ status: 403 });
    expect(fake.current.state.decisions).toHaveLength(0);
  });

  it("reviewers and approvers outside the school cannot see the placement", async () => {
    const { placementId } = await completedPlacement();
    await expect(recordPlacementReview(OTHER_SCHOOL_TEACHER, placementId, { recommendation: "endorse" })).rejects.toMatchObject({ status: 404 });
    await expect(confirmOfficialPlacement(OTHER_SCHOOL_ADMIN, placementId, { finalGrade: 5 })).rejects.toMatchObject({ status: 404 });
  });

  it("the school placement authority confirms, recording an immutable decision", async () => {
    const { placementId } = await completedPlacement();
    const recommended = fake.current.state.placements[0].estimatedGrade;
    const result = await confirmOfficialPlacement(ADMIN, placementId, { finalGrade: recommended });
    expect(result.officialGradeChanged).toBe(true);
    expect(result.decision).toMatchObject({ finalGrade: recommended, isOverride: false, previousGrade: 4 });
    expect(fake.current.state.students.find((s: any) => s.id === "student-a").currentGrade).toBe(recommended);
    const replay = await confirmOfficialPlacement(ADMIN, placementId, { finalGrade: recommended });
    expect(replay.replayed).toBe(true);
    expect(fake.current.state.decisions).toHaveLength(1);
    await expect(confirmOfficialPlacement(ADMIN, placementId, { finalGrade: recommended === 12 ? 11 : recommended + 1, reason: "x".repeat(25) })).rejects.toMatchObject({ status: 409 });
  });

  it("an override requires a reason and preserves the recommendation and evidence", async () => {
    const { placementId } = await completedPlacement();
    const placement = fake.current.state.placements[0];
    const recommended = placement.estimatedGrade;
    const other = recommended === 1 ? 2 : recommended - 1;
    await expect(confirmOfficialPlacement(ADMIN, placementId, { finalGrade: other })).rejects.toMatchObject({ status: 400, code: "reason_required" });
    const result = await confirmOfficialPlacement(ADMIN, placementId, {
      finalGrade: other,
      reason: "Recently transferred with a documented report card",
    });
    expect(result.decision).toMatchObject({ isOverride: true, recommendedGrade: recommended, finalGrade: other });
    expect(placement.estimatedGrade).toBe(recommended);
    expect(placement.rawScore).toBe(7);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "placement.official.confirmed", userId: "admin-1" }));
  });

  it("a legacy client-scored result always needs a reason to confirm", async () => {
    fake.current.state.placements.push({
      id: "legacy-1", studentId: "student-a", source: "legacy_client", estimatedGrade: 6, band: "proficient", rawScore: 8, totalQuestions: 10, teacherDecision: null,
    });
    await expect(confirmOfficialPlacement(ADMIN, "legacy-1", { finalGrade: 6 })).rejects.toMatchObject({ status: 400, code: "reason_required" });
  });
});

describe("retired client-scored endpoints", () => {
  it.each([
    "@/app/api/student/placement/route",
    "@/app/api/placement/calculate-grade/route",
    "@/app/api/placement/generate-question/route",
  ])("%s returns 410", async (modulePath) => {
    vi.doMock("@/lib/auth", () => ({ requireRole: vi.fn().mockResolvedValue(LEARNER) }));
    const { POST } = await import(modulePath);
    const res = await POST();
    expect(res.status).toBe(410);
    vi.doUnmock("@/lib/auth");
  });
});
