import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import type { PracticeQuestion, PracticeSet } from "@/lib/adaptive/practiceGenerator";

const TTL_MS = 2 * 60 * 60 * 1000;

type AdaptivePracticeSession = {
  correctIndices: number[];
  expiresAt: number;
  practiceSetId: string;
  strandCode: string;
  userId: string;
};

type LegacyAdaptivePracticeSession = Omit<AdaptivePracticeSession, "correctIndices"> & {
  questions: PracticeQuestion[];
};

type AdaptivePracticeSessionInput = Pick<AdaptivePracticeSession, "strandCode" | "userId"> & {
  questions: PracticeQuestion[];
};

function key() {
  return createHash("sha256")
    .update(process.env.NEXTAUTH_SECRET || "liberialearn-local-adaptive-session")
    .digest();
}

export function sealAdaptivePracticeSession(input: AdaptivePracticeSessionInput) {
  const session: AdaptivePracticeSession = {
    correctIndices: input.questions.map(({ correctIndex }) => correctIndex),
    practiceSetId: randomUUID(),
    expiresAt: Date.now() + TTL_MS,
    strandCode: input.strandCode,
    userId: input.userId,
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return {
    practiceSetId: session.practiceSetId,
    token: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url"),
  };
}

export function openAdaptivePracticeSession(token: string, userId: string, practiceSetId: string) {
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const parsed = JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()
    ) as AdaptivePracticeSession | LegacyAdaptivePracticeSession;
    const correctIndices = "correctIndices" in parsed && Array.isArray(parsed.correctIndices)
      ? parsed.correctIndices
      : "questions" in parsed && Array.isArray(parsed.questions)
        ? parsed.questions.map((question) => question?.correctIndex)
        : null;
    if (
      parsed.expiresAt < Date.now() ||
      parsed.userId !== userId ||
      parsed.practiceSetId !== practiceSetId ||
      !correctIndices ||
      correctIndices.length === 0 ||
      correctIndices.some((index) => !Number.isInteger(index) || index < 0)
    ) return null;
    return {
      correctIndices,
      expiresAt: parsed.expiresAt,
      practiceSetId: parsed.practiceSetId,
      strandCode: parsed.strandCode,
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

export function projectAdaptivePracticeForLearner(
  practice: PracticeSet,
  practiceSetId: string
) {
  return {
    strand: practice.strand,
    difficultyTier: practice.difficultyTier,
    generatedAt: practice.generatedAt,
    practiceSetId,
    questions: practice.questions.map(({ id, prompt, options, hintText }) => ({
      id,
      prompt,
      options,
      hintText,
    })),
  };
}

export function scoreAdaptiveAnswers(answers: number[], correctIndices: number[]) {
  if (answers.length === 0 || answers.length !== correctIndices.length) {
    throw Object.assign(new Error("Invalid adaptive attempt payload"), { status: 400 });
  }
  const incorrectAnswerIndices = answers.reduce<number[]>((indices, answer, index) => {
    if (answer !== correctIndices[index]) indices.push(index);
    return indices;
  }, []);
  return {
    score: Math.round(((answers.length - incorrectAnswerIndices.length) / answers.length) * 10000) / 10000,
    incorrectAnswerIndices,
  };
}
