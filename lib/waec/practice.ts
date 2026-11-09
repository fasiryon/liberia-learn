/**
 * lib/waec/practice.ts — PHASE 5A Surface (D2)
 *
 * WAEC-style practice sessions. The lesson corpus is prose (no structured questions), so
 * questions are GENERATED via routedCompletion against the WAEC syllabus topics (PATH B)
 * and CACHED in WaecPracticeItem — a growing bank so we don't regenerate each time.
 * Keys are withheld until issued-attempt scoring. Practice results are provisional
 * and do not enter legacy mastery or official academic records.
 */
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { moderateText } from "@/lib/agents/moderation";
import { getWaecSubject, getTopic, type WaecSubjectId } from "@/lib/waec/syllabus";
import { getStudentWaecReadiness } from "@/lib/waec/readiness";
import {
  openPracticeSession, practiceError, practiceReceiptId, validatePracticeAnswers,
  validatePracticeItems, verifyPracticeRevisions, type PracticeContext,
} from "@/lib/waec/practiceSession";

export type ClientQuestion = { id: string; topicId: string; topicName: string; prompt: string; options: string[] };
export type PracticeSession = { subjectId: WaecSubjectId; subjectName: string; questions: ClientQuestion[] };
export type TopicResult = { topicId: string; topicName: string; correct: number; total: number };
export type PracticeResult = {
  score: number; correct: number; total: number;
  topics: TopicResult[];
  review: { id: string; prompt: string; options: string[]; correctIndex: number; chosen: number | null; explanation: string | null }[];
  evidenceStatus: "PROVISIONAL_UNBOUND";
  masteryUpdated: false;
};

const MIN_PER_TOPIC = 3;

async function generateForTopic(subjectId: WaecSubjectId, topicId: string, grade: number): Promise<number> {
  const subject = getWaecSubject(subjectId);
  const topic = getTopic(topicId);
  if (!subject || !topic) return 0;

  const system =
    "You are a WAEC (WASSCE) examiner writing authentic exam-style multiple-choice questions for " +
    "West African senior secondary students (Liberia). Questions must match WAEC difficulty and " +
    "phrasing, use Liberian/West African context where natural, and each have exactly 4 options with " +
    "one correct answer. Return ONLY JSON: {\"questions\":[{\"prompt\":string,\"options\":[4 strings]," +
    "\"correctIndex\":0-3,\"explanation\":string}]}.";
  const user = `Subject: ${subject.name}\nTopic: ${topic.name}\nGrade level: SSS (Grade ${grade}).\nWrite 4 fresh WAEC-style multiple-choice questions on this topic.`;

  const res = await routedCompletion({
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    responseFormat: "json",
    forceSmartTier: true,
    maxTokens: 1100,
    aiUsage: { route: "lib/waec/practice", feature: "curriculum", requestType: "waec_practice_gen", subject: subjectId },
  });

  const outputVerdict = await moderateText(res.content, "output", {
    audience: "minor",
  });
  if (outputVerdict.verdict !== "SAFE") return 0;

  let parsed: any;
  try { parsed = JSON.parse(res.content); } catch { return 0; }
  const list: any[] = Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed) ? parsed : [];
  const valid = list.filter(
    (q) => q && typeof q.prompt === "string" && Array.isArray(q.options) && q.options.length === 4 &&
      q.options.every((o: any) => typeof o === "string") && Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 && q.correctIndex <= 3
  );
  if (valid.length === 0) return 0;

  await prisma.waecPracticeItem.createMany({
    data: valid.map((q) => ({
      subjectId, topicId, prompt: q.prompt.slice(0, 1000), options: q.options,
      correctIndex: q.correctIndex, explanation: typeof q.explanation === "string" ? q.explanation.slice(0, 600) : null, grade,
    })),
  });
  return valid.length;
}

/** Ensure the bank has at least MIN_PER_TOPIC items for each of the subject's mastery topics. */
export async function ensureBank(subjectId: WaecSubjectId, grade = 11): Promise<void> {
  const subject = getWaecSubject(subjectId);
  if (!subject || subject.masterySubject === null) return;
  const topics = subject.topics.filter((t) => t.strands.length > 0);
  for (const t of topics) {
    const count = await prisma.waecPracticeItem.count({ where: { subjectId, topicId: t.id, grade } });
    if (count < MIN_PER_TOPIC) {
      await generateForTopic(subjectId, t.id, grade).catch(() => 0);
    }
  }
}

/** Build a client-safe session, weighting weak/uncovered topics higher. */
export async function buildPracticeSession(
  studentId: string, subjectId: WaecSubjectId, size = 6, grade = 11
): Promise<PracticeSession | null> {
  const subject = getWaecSubject(subjectId);
  if (!subject || subject.masterySubject === null) return null;
  await ensureBank(subjectId, grade);

  const readiness = await getStudentWaecReadiness(studentId, subjectId);
  const scoreByTopic = new Map(readiness.topics.map((t) => [t.topicId, t.score]));

  const topics = subject.topics.filter((t) => t.strands.length > 0);
  // Weakest / unassessed first, then by exam weight.
  const ordered = topics.slice().sort((a, b) => {
    const sa = scoreByTopic.get(a.id); const sb = scoreByTopic.get(b.id);
    const wa = sa == null ? -1 : sa; const wb = sb == null ? -1 : sb;
    if (wa !== wb) return wa - wb;
    return b.examWeight - a.examWeight;
  });

  const questions: ClientQuestion[] = [];
  const seen = new Set<string>();
  // Round-robin across ordered topics until we hit `size`.
  for (let round = 0; round < 3 && questions.length < size; round++) {
    for (const t of ordered) {
      if (questions.length >= size) break;
      const item = await prisma.waecPracticeItem.findFirst({
        where: { subjectId, topicId: t.id, grade, id: { notIn: Array.from(seen) } },
        orderBy: { createdAt: "asc" }, skip: round,
      });
      if (!item) continue;
      seen.add(item.id);
      questions.push({ id: item.id, topicId: t.id, topicName: t.name, prompt: item.prompt, options: item.options as string[] });
    }
  }
  if (questions.length === 0) return null;
  return { subjectId, subjectName: subject.name, questions };
}

/** Score one issued formative attempt; its unique provisional receipt is the only write. */
export async function gradePracticeSession(
  studentId: string, schoolId: string, subjectId: WaecSubjectId, grade: number,
  answers: unknown,
  issued?: { token: string; userId: string }
): Promise<PracticeResult> {
  const context: PracticeContext = { userId: issued?.userId ?? "", studentId, schoolId, subjectId, grade };
  const claims = openPracticeSession(issued?.token ?? "", context);
  const submitted = validatePracticeAnswers(answers, claims);
  const ids = claims.items.map(item => item.id);
  const rows = await prisma.waecPracticeItem.findMany({ where: { id: { in: ids }, subjectId, grade } });
  const items = validatePracticeItems(rows, context, ids);
  verifyPracticeRevisions(items, claims);
  const byId = new Map(items.map((i) => [i.id, i]));

  const perTopic = new Map<string, { correct: number; total: number }>();
  const review: PracticeResult["review"] = [];
  let correct = 0;

  for (const a of submitted) {
    const item = byId.get(a.id);
    if (!item) throw practiceError(400, "Answers must match the issued practice questions exactly.");
    const isCorrect = a.chosen === item.correctIndex;
    if (isCorrect) correct++;
    const pt = perTopic.get(item.topicId) ?? { correct: 0, total: 0 };
    pt.total++; if (isCorrect) pt.correct++;
    perTopic.set(item.topicId, pt);
    review.push({
      id: item.id, prompt: item.prompt, options: item.options,
      correctIndex: item.correctIndex, chosen: a.chosen, explanation: item.explanation,
    });
  }

  const total = review.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  const topics: TopicResult[] = Array.from(perTopic.entries()).map(([topicId, pt]) => ({
    topicId, topicName: getTopic(topicId)?.name ?? topicId, correct: pt.correct, total: pt.total,
  }));

  // The existing primary key makes competing creates atomic across processes.
  // No read-before-write claim, lock, schema or mastery side effect is needed.
  try {
    await prisma.auditLog.create({ data: {
      id: practiceReceiptId(claims), userId: context.userId, schoolId,
      action: "waec.practice.provisional.scored", resourceType: "WAECPracticeAttempt", resourceId: claims.attemptId,
      // Keep provisional practice out of every AssessmentAttempt reader,
      // including older analytics without a status/source filter.
      details: {
        userId: context.userId, studentId, schoolId, subject: subjectId, grade,
        score, correct, total, topics, answers: submitted,
        evidenceStatus: "PROVISIONAL_UNBOUND", masteryUpdated: false, independentAssessment: false,
        assistance: { status: "UNKNOWN", source: "not_collected" },
        issuedAt: claims.issuedAt, expiresAt: claims.expiresAt, itemBindings: claims.items,
      },
    } });
  } catch (error: unknown) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw practiceError(409, "This practice attempt was already submitted. Reload to start a new attempt.");
    }
    throw error;
  }
  return { score, correct, total, topics, review, evidenceStatus: "PROVISIONAL_UNBOUND", masteryUpdated: false };
}
