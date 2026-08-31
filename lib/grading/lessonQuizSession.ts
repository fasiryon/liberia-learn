import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import type { LessonQuizQuestion } from "@/lib/ai/lessonQuiz";

const TTL_MS = 2 * 60 * 60 * 1000;

type QuizSession = {
  expiresAt: number;
  lessonId: string;
  quizId: string;
  questions: LessonQuizQuestion[];
  userId: string;
};

function key() {
  // NEXTAUTH_SECRET is a required production secret. The development fallback
  // deliberately only makes local fixtures usable; it is never a production key.
  return createHash("sha256").update(process.env.NEXTAUTH_SECRET || "liberialearn-local-quiz-session").digest();
}

export function sealLessonQuizSession(input: Omit<QuizSession, "expiresAt">): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify({ ...input, expiresAt: Date.now() + TTL_MS }));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function openLessonQuizSession(token: string, userId: string, lessonId: string): QuizSession | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const session = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString()) as QuizSession;
    if (
      session.expiresAt < Date.now() ||
      session.userId !== userId ||
      session.lessonId !== lessonId ||
      !Array.isArray(session.questions) ||
      session.questions.length !== 5
    ) return null;
    return session;
  } catch {
    return null;
  }
}

export function projectQuizForLearner(questions: LessonQuizQuestion[]) {
  return questions.map(({ id, question, options }) => ({ id, question, options }));
}
