/**
 * lib/waec/practice.ts — PHASE 5A Surface (D2)
 *
 * WAEC-style practice sessions. The lesson corpus is prose (no structured questions), so
 * questions are GENERATED via routedCompletion against the WAEC syllabus topics (PATH B)
 * and CACHED in WaecPracticeItem — a growing bank so we don't regenerate each time.
 * correctIndex is never sent to clients; grading is server-side and feeds the mastery engine.
 */
import { prisma } from "@/lib/db";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { moderateText } from "@/lib/agents/moderation";
import { updateMasteryProfile } from "@/lib/mastery/masteryService";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import { getWaecSubject, getTopic, type WaecSubjectId } from "@/lib/waec/syllabus";
import { getStudentWaecReadiness } from "@/lib/waec/readiness";

export type ClientQuestion = { id: string; topicId: string; topicName: string; prompt: string; options: string[] };
export type PracticeSession = { subjectId: WaecSubjectId; subjectName: string; questions: ClientQuestion[] };
export type TopicResult = { topicId: string; topicName: string; correct: number; total: number };
export type PracticeResult = {
  score: number; correct: number; total: number;
  topics: TopicResult[];
  review: { id: string; prompt: string; options: string[]; correctIndex: number; chosen: number | null; explanation: string | null }[];
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
    const count = await prisma.waecPracticeItem.count({ where: { subjectId, topicId: t.id } });
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
        where: { subjectId, topicId: t.id, id: { notIn: Array.from(seen) } },
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

/** Grade answers server-side, update mastery per topic, return breakdown + review. */
export async function gradePracticeSession(
  studentId: string, schoolId: string, subjectId: WaecSubjectId, grade: number,
  answers: { id: string; chosen: number | null }[]
): Promise<PracticeResult> {
  const subject = getWaecSubject(subjectId);
  const ids = answers.map((a) => a.id);
  const items = await prisma.waecPracticeItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(items.map((i) => [i.id, i]));

  const perTopic = new Map<string, { correct: number; total: number }>();
  const review: PracticeResult["review"] = [];
  let correct = 0;

  for (const a of answers) {
    const item = byId.get(a.id);
    if (!item) continue;
    const isCorrect = a.chosen === item.correctIndex;
    if (isCorrect) correct++;
    const pt = perTopic.get(item.topicId) ?? { correct: 0, total: 0 };
    pt.total++; if (isCorrect) pt.correct++;
    perTopic.set(item.topicId, pt);
    review.push({
      id: item.id, prompt: item.prompt, options: item.options as string[],
      correctIndex: item.correctIndex, chosen: a.chosen, explanation: item.explanation,
    });
  }

  const total = review.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Feed each topic's result into the mastery engine (the same service lessons use).
  if (subject && subject.masterySubject !== null) {
    const band = gradeToBand(grade);
    for (const [topicId, pt] of perTopic) {
      const strand = getTopic(topicId)?.strands[0];
      if (!strand || pt.total === 0) continue;
      const topicScore = pt.correct / pt.total;
      await updateMasteryProfile({
        studentId, schoolId, subject: strand.subject, strandKey: strand.strandKey, gradeBand: band,
        newScore: topicScore, wasAiAssisted: false, totalAttempts: pt.total, aiAssistedAttempts: 0,
        recentScores: [topicScore],
      }).catch(() => null);
    }
  }

  const topics: TopicResult[] = Array.from(perTopic.entries()).map(([topicId, pt]) => ({
    topicId, topicName: getTopic(topicId)?.name ?? topicId, correct: pt.correct, total: pt.total,
  }));

  return { score, correct, total, topics, review };
}
