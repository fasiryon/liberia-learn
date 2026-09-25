/**
 * PlacementSession authority. The server issues every item, holds every answer
 * key, scores every response, and derives score/band/recommendation. The
 * learner only renders items and submits a selected option index.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  PLACEMENT_ASSESSMENT_VERSION,
  PLACEMENT_MAX_ITEMS,
  PLACEMENT_SCORING_VERSION,
  PLACEMENT_SESSION_TTL_MS,
  nextDifficulty,
  scorePlacement,
} from "@/lib/placementAuthority/scoring";
import {
  computeItemVersion,
  generatePlacementItem,
  toPublicItem,
  toRespondedItem,
  type StoredItem,
} from "@/lib/placementAuthority/items";

type Learner = { id: string; role: string; schoolId?: string | null };

const fail = (status: number, message: string, code?: string) =>
  Object.assign(new Error(message), { status, code: code ?? message });

/** Fields a client may never assert; their presence rejects the request. */
const CLIENT_AUTHORITY_FIELDS = ["correct", "isCorrect", "score", "rawScore", "band", "levelLabel", "estimatedGrade", "recommendedGrade", "correctIndex", "correctAnswer"];

export function assertNoClientAuthority(body: Record<string, unknown> | null | undefined) {
  if (!body || typeof body !== "object") return;
  const asserted = CLIENT_AUTHORITY_FIELDS.filter((field) => field in body);
  if (asserted.length > 0) {
    throw fail(400, "Placement scoring is server-authoritative; client scoring fields are not accepted", "client_authority_fields_rejected");
  }
}

async function resolveLearner(user: Learner) {
  if (user.role !== "STUDENT") throw fail(403, "Forbidden");
  if (!user.schoolId) throw fail(403, "School context required", "school_required");
  const student = await prisma.student.findFirst({
    where: { userId: user.id, user: { schoolId: user.schoolId } },
    select: { id: true },
  });
  if (!student) throw fail(404, "Student record not found", "student_not_found");
  return { studentId: student.id, schoolId: user.schoolId };
}

function toStored(row: any): StoredItem {
  return { ...row, options: Array.isArray(row.options) ? (row.options as string[]) : [] };
}

/** Loads a session owned by this learner; hides other learners' sessions as 404. */
async function loadOwnedSession(user: Learner, sessionId: string) {
  const learner = await resolveLearner(user);
  const session = await prisma.placementSession.findFirst({
    where: { id: sessionId, studentId: learner.studentId, schoolId: learner.schoolId },
    include: { items: { orderBy: { sequence: "asc" } } },
  });
  if (!session) throw fail(404, "Placement session not found", "session_not_found");
  if (session.status === "ACTIVE" && session.expiresAt.getTime() <= Date.now()) {
    await prisma.placementSession.updateMany({
      where: { id: session.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    throw fail(410, "This placement session has expired. Start a new one.", "session_expired");
  }
  return { learner, session: { ...session, items: session.items.map(toStored) } };
}

function sessionView(session: { id: string; status: string; maxItems: number; expiresAt: Date; placementTestId: string | null; items: StoredItem[] }) {
  const answered = session.items.filter((item) => item.respondedAt);
  const pending = session.items.find((item) => !item.respondedAt) ?? null;
  return {
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    totalItems: session.maxItems,
    answeredCount: answered.length,
    currentItem: pending ? toPublicItem(pending) : null,
    readyToComplete: session.status === "ACTIVE" && answered.length >= session.maxItems,
    placementId: session.placementTestId,
  };
}

/** Start a new session or resume the learner's active one (idempotent). */
export async function startOrResumeSession(user: Learner) {
  const learner = await resolveLearner(user);
  const now = new Date();
  await prisma.placementSession.updateMany({
    where: { studentId: learner.studentId, status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  const findActive = () =>
    prisma.placementSession.findFirst({
      where: { studentId: learner.studentId, schoolId: learner.schoolId, status: "ACTIVE" },
      include: { items: { orderBy: { sequence: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  const active = await findActive();
  if (active) return { resumed: true, ...sessionView({ ...active, items: active.items.map(toStored) }) };

  // No retake cooldown exists (policy not yet set); every attempt is counted
  // and audited so reviewers can see repeated attempts.
  const priorAttempts = await prisma.placementSession.count({ where: { studentId: learner.studentId } });
  let created;
  try {
    created = await prisma.placementSession.create({
      data: {
        studentId: learner.studentId,
        schoolId: learner.schoolId,
        assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
        maxItems: PLACEMENT_MAX_ITEMS,
        expiresAt: new Date(now.getTime() + PLACEMENT_SESSION_TTL_MS),
      },
    });
  } catch (error) {
    // A concurrent start won the one-ACTIVE-session-per-student index; resume it.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await findActive();
      if (winner) return { resumed: true, ...sessionView({ ...winner, items: winner.items.map(toStored) }) };
      throw fail(409, "Another placement session is already active", "session_conflict");
    }
    throw error;
  }
  await logAudit({
    userId: user.id,
    schoolId: learner.schoolId,
    action: "placement.session.started",
    resourceType: "placement_session",
    resourceId: created.id,
    details: { assessmentVersion: PLACEMENT_ASSESSMENT_VERSION, attemptNumber: priorAttempts + 1 },
  });
  return { resumed: false, ...sessionView({ ...created, items: [] }) };
}

export async function getSession(user: Learner, sessionId: string) {
  const { session } = await loadOwnedSession(user, sessionId);
  return sessionView(session);
}

/**
 * Issue the next item. If an issued item is still unanswered it is returned
 * again, so refresh/double-click never creates a second item.
 */
export async function issueNextItem(user: Learner, sessionId: string) {
  const { learner, session } = await loadOwnedSession(user, sessionId);
  if (session.status !== "ACTIVE") throw fail(409, "Placement session is not active", "session_not_active");

  const pending = session.items.find((item) => !item.respondedAt);
  if (pending) return { item: toPublicItem(pending), reissued: true };
  if (session.items.length >= session.maxItems) {
    throw fail(409, "All placement items have been issued", "items_exhausted");
  }

  const last = session.items[session.items.length - 1];
  const difficulty = nextDifficulty(last ? { difficulty: last.difficulty, isCorrect: last.isCorrect === true } : null);
  const content = await generatePlacementItem({
    difficulty,
    usedPrompts: new Set(session.items.map((item) => item.prompt)),
    loadPriorExposure: () => priorExposure(learner.studentId, session.id),
    schoolId: learner.schoolId,
    userId: user.id,
  });

  try {
    const created = await prisma.placementSessionItem.create({
      data: {
        sessionId: session.id,
        sequence: session.items.length + 1,
        itemVersion: computeItemVersion(content),
        source: content.source,
        difficulty: content.difficulty,
        subject: content.subject,
        strand: content.strand,
        moeStandard: content.moeStandard,
        prompt: content.prompt,
        options: content.options,
        correctIndex: content.correctIndex,
        explanation: content.explanation,
      },
    });
    if (content.reusedPriorExposure) {
      await logAudit({
        userId: user.id,
        schoolId: learner.schoolId,
        action: "placement.item.exposure_reused",
        resourceType: "placement_session",
        resourceId: session.id,
        details: { itemId: created.id, sequence: created.sequence, reason: "fallback_bank_exhausted_for_learner" },
      });
    }
    return { item: toPublicItem(toStored(created)), reissued: false };
  } catch (error) {
    // A concurrent request issued this sequence first; return that item.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.placementSessionItem.findFirst({
        where: { sessionId: session.id, respondedAt: null },
        orderBy: { sequence: "asc" },
      });
      if (existing) return { item: toPublicItem(toStored(existing)), reissued: true };
    }
    throw error;
  }
}

/** Prompts this learner was shown in any earlier placement session. */
async function priorExposure(studentId: string, currentSessionId: string) {
  const sessions = await prisma.placementSession.findMany({
    where: { studentId, id: { not: currentSessionId } },
    select: { id: true },
  });
  if (sessions.length === 0) return new Set<string>();
  const items = await prisma.placementSessionItem.findMany({
    where: { sessionId: { in: sessions.map((row) => row.id) } },
    select: { prompt: true },
  });
  return new Set(items.map((item) => item.prompt));
}

export type ResponseInput = {
  itemId?: unknown;
  itemVersion?: unknown;
  selectedIndex?: unknown;
  operationId?: unknown;
};

/**
 * Record and server-score one response. The response binds to session,
 * learner, item id, item version, and a stable operation id. A replay of the
 * same operation returns the stored result without writing again.
 */
export async function submitResponse(user: Learner, sessionId: string, input: ResponseInput & Record<string, unknown>) {
  assertNoClientAuthority(input);
  const { itemId, itemVersion, selectedIndex, operationId } = input;
  if (typeof itemId !== "string" || typeof itemVersion !== "string") throw fail(400, "itemId and itemVersion are required", "invalid_response");
  if (typeof operationId !== "string" || operationId.length < 8 || operationId.length > 128) {
    throw fail(400, "operationId must be 8-128 characters", "invalid_operation_id");
  }

  const { learner, session } = await loadOwnedSession(user, sessionId);
  const item = session.items.find((candidate) => candidate.id === itemId);
  if (!item) throw fail(404, "Placement item not found in this session", "item_not_found");
  if (item.itemVersion !== itemVersion) throw fail(409, "Item version does not match the issued item", "item_version_mismatch");

  if (item.respondedAt) {
    const stored = await prisma.placementSessionItem.findUnique({ where: { id: item.id }, select: { responseOperationId: true } });
    if (stored?.responseOperationId === operationId && item.selectedIndex === selectedIndex) {
      return { replayed: true, item: toRespondedItem(item), ...progress(session) };
    }
    throw fail(409, "A response for this item is already recorded", "response_already_recorded");
  }
  if (session.status !== "ACTIVE") throw fail(409, "Placement session is not active", "session_not_active");
  if (!Number.isInteger(selectedIndex) || (selectedIndex as number) < 0 || (selectedIndex as number) >= item.options.length) {
    throw fail(400, "selectedIndex must be a valid option index", "invalid_selection");
  }

  const isCorrect = selectedIndex === item.correctIndex;
  const respondedAt = new Date();
  let written: number;
  try {
    const result = await prisma.placementSessionItem.updateMany({
      where: { id: item.id, sessionId: session.id, respondedAt: null },
      data: { selectedIndex: selectedIndex as number, isCorrect, responseOperationId: operationId, respondedAt },
    });
    written = result.count;
  } catch (error) {
    // operationId already used for a different item or session.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw fail(409, "operationId was already used for another response", "operation_id_reused");
    }
    throw error;
  }
  if (written === 0) {
    // Lost a race with a concurrent write of the same item.
    const current = await prisma.placementSessionItem.findUnique({ where: { id: item.id } });
    if (current?.responseOperationId === operationId) {
      return { replayed: true, item: toRespondedItem(toStored(current)), ...progress(session) };
    }
    throw fail(409, "A response for this item is already recorded", "response_already_recorded");
  }

  const recorded: StoredItem = { ...item, selectedIndex: selectedIndex as number, isCorrect, respondedAt };
  const answeredCount = session.items.filter((candidate) => candidate.respondedAt).length + 1;
  await logAudit({
    userId: user.id,
    schoolId: learner.schoolId,
    action: "placement.response.recorded",
    resourceType: "placement_session",
    resourceId: session.id,
    details: { itemId: item.id, itemVersion: item.itemVersion, sequence: item.sequence },
  });
  return {
    replayed: false,
    item: toRespondedItem(recorded),
    answeredCount,
    totalItems: session.maxItems,
    readyToComplete: answeredCount >= session.maxItems,
  };
}

function progress(session: { maxItems: number; items: StoredItem[] }) {
  const answeredCount = session.items.filter((item) => item.respondedAt).length;
  return { answeredCount, totalItems: session.maxItems, readyToComplete: answeredCount >= session.maxItems };
}

/**
 * Score the session on the server and record the placement result as
 * diagnostic evidence. Idempotent: completing twice returns the same result.
 * Never changes Student.currentGrade.
 */
export async function completeSession(user: Learner, sessionId: string) {
  const { learner, session } = await loadOwnedSession(user, sessionId);
  if (session.status === "COMPLETED" && session.placementTestId) {
    return learnerResult(session.placementTestId, true);
  }
  if (session.status !== "ACTIVE") throw fail(409, "Placement session is not active", "session_not_active");

  const answered = session.items.filter((item) => item.respondedAt && item.isCorrect !== null);
  if (answered.length < session.maxItems || session.items.some((item) => !item.respondedAt)) {
    throw fail(409, "Answer every placement item before finishing", "session_incomplete");
  }

  const score = scorePlacement(answered.map((item) => ({ difficulty: item.difficulty, isCorrect: item.isCorrect === true })));

  let placementId: string;
  try {
    placementId = await prisma.$transaction(async (tx) => {
      const placement = await tx.placementTest.create({
        data: {
          studentId: learner.studentId,
          source: "server_session",
          sessionId: session.id,
          scoringVersion: PLACEMENT_SCORING_VERSION,
          band: score.band,
          levelLabel: score.levelLabel,
          estimatedGrade: score.recommendedGrade,
          rawScore: score.correctAnswers,
          totalQuestions: score.totalQuestions,
          details: {
            accuracyRate: score.accuracyRate,
            weightedAccuracy: score.weightedAccuracy,
            averageDifficulty: score.averageDifficulty,
            difficultyRange: score.difficultyRange,
            confidence: score.confidence,
            assessmentVersion: session.assessmentVersion,
          },
          // Staff-facing evidence (reviewer APIs only).
          questions: answered.map((item) => ({
            questionId: item.id,
            itemVersion: item.itemVersion,
            source: item.source,
            question: item.prompt,
            options: item.options,
            correctAnswer: item.correctIndex,
            explanation: item.explanation,
            difficulty: item.difficulty,
            subject: item.subject,
            strand: item.strand,
            moeStandard: item.moeStandard,
          })),
          answers: answered.map((item) => ({
            questionId: item.id,
            difficulty: item.difficulty,
            correct: item.isCorrect === true,
            selectedAnswer: item.selectedIndex,
          })),
        },
      });
      const closed = await tx.placementSession.updateMany({
        where: { id: session.id, status: "ACTIVE" },
        data: { status: "COMPLETED", completedAt: new Date(), placementTestId: placement.id },
      });
      if (closed.count === 0) throw fail(409, "Placement session changed while finishing", "session_race");
      return placement.id;
    });
  } catch (error: any) {
    if ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || error?.code === "session_race") {
      const existing = await prisma.placementTest.findUnique({ where: { sessionId: session.id }, select: { id: true } });
      if (existing) return learnerResult(existing.id, true);
    }
    throw error;
  }

  await logAudit({
    userId: user.id,
    schoolId: learner.schoolId,
    action: "placement.session.completed",
    resourceType: "placement_test",
    resourceId: placementId,
    details: {
      sessionId: session.id,
      scoringVersion: PLACEMENT_SCORING_VERSION,
      band: score.band,
      recommendedGrade: score.recommendedGrade,
      rawScore: score.correctAnswers,
      totalQuestions: score.totalQuestions,
    },
  });
  return learnerResult(placementId, false);
}

/** Learner-appropriate result: progress and level, pending human review. */
async function learnerResult(placementId: string, replayed: boolean) {
  const placement = await prisma.placementTest.findUnique({
    where: { id: placementId },
    select: { id: true, rawScore: true, totalQuestions: true, levelLabel: true, teacherDecision: true },
  });
  if (!placement) throw fail(404, "Placement result not found");
  return {
    replayed,
    status: "COMPLETED" as const,
    placementId: placement.id,
    correctAnswers: placement.rawScore,
    totalQuestions: placement.totalQuestions,
    levelLabel: placement.levelLabel,
    officialPlacement: placement.teacherDecision ? "decided" : "pending_review",
  };
}
