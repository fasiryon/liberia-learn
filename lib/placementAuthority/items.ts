/**
 * Server-side placement item issuance and learner-safe serialization.
 *
 * Items are generated (or drawn from the fallback bank) on the server and
 * persisted with their answer key. Only toPublicItem / toRespondedItem shapes
 * ever reach a learner, and neither carries the key.
 */
import { createHash, randomInt } from "crypto";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { buildPrompt, getPromptMetadata } from "@/lib/ai/promptRegistry";
import { PLACEMENT_ASSESSMENT_VERSION } from "@/lib/placementAuthority/scoring";
import { PLACEMENT_ITEM_BANK } from "@/lib/placementAuthority/itemBank";

const DIFFICULTY_DESCRIPTIONS: Record<number, string> = {
  1: "very basic, elementary level",
  2: "simple, early middle school level",
  3: "moderate, middle school level",
  4: "challenging, high school level",
  5: "advanced, college prep level",
};

export type IssuedItemContent = {
  source: "ai_generated" | "item_bank";
  difficulty: number;
  subject: string;
  strand: string;
  moeStandard: string | null;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type StoredItem = IssuedItemContent & {
  id: string;
  sequence: number;
  itemVersion: string;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  respondedAt: Date | null;
};

/** Content hash binding a response to the exact item text and key it was issued with. */
export function computeItemVersion(item: Pick<IssuedItemContent, "prompt" | "options" | "correctIndex" | "explanation">): string {
  return createHash("sha256")
    .update(
      JSON.stringify([PLACEMENT_ASSESSMENT_VERSION, item.prompt, item.options, item.correctIndex, item.explanation])
    )
    .digest("hex")
    .slice(0, 32);
}

function parseGeneratedItem(content: string, difficulty: number): IssuedItemContent | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const c = JSON.parse(match[0]);
    if (
      typeof c.question !== "string" ||
      !Array.isArray(c.options) ||
      c.options.length !== 4 ||
      c.options.some((o: unknown) => typeof o !== "string") ||
      !Number.isInteger(c.correctAnswer) ||
      c.correctAnswer < 0 ||
      c.correctAnswer > 3 ||
      new Set(c.options.map((o: string) => o.trim())).size !== 4
    ) {
      return null;
    }
    return {
      source: "ai_generated",
      difficulty,
      subject: typeof c.subject === "string" ? c.subject.trim().toLowerCase() : "mathematics",
      strand: typeof c.strand === "string" ? c.strand.trim() : "general",
      moeStandard: typeof c.moeStandard === "string" ? c.moeStandard.trim() : null,
      prompt: c.question.trim(),
      options: c.options.map((o: string) => o.trim()),
      correctIndex: c.correctAnswer,
      explanation: typeof c.explanation === "string" ? c.explanation.trim() : "",
    };
  } catch {
    return null;
  }
}

/** Uniform integer in [0, max). Injectable so tests can pin the draw. */
export type RandomIndex = (max: number) => number;
const secureRandomIndex: RandomIndex = (max) => randomInt(max);

/**
 * Fisher-Yates shuffle of an item's options, remapping the key. Positions are
 * drawn per issuance, so a key learned in one session does not carry over as
 * "option C" in the next.
 */
export function shuffleOptions(options: string[], correctIndex: number, random: RandomIndex = secureRandomIndex) {
  const order = options.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((index) => options[index]), correctIndex: order.indexOf(correctIndex) };
}

/**
 * Draw a fallback item. Candidates exclude prompts already used in this
 * session and, while any remain, prompts this learner saw in earlier sessions;
 * among the closest-difficulty candidates one is chosen at random. Reuse of a
 * previously seen prompt happens only once the approved bank is exhausted and
 * is reported so the caller can audit it.
 */
export function drawBankItem(input: {
  difficulty: number;
  usedPrompts: Set<string>;
  priorExposure: Set<string>;
  random?: RandomIndex;
}): IssuedItemContent & { reusedPriorExposure: boolean } {
  const random = input.random ?? secureRandomIndex;
  const unusedThisSession = PLACEMENT_ITEM_BANK.filter((item) => !input.usedPrompts.has(item.prompt));
  const sessionPool = unusedThisSession.length > 0 ? unusedThisSession : PLACEMENT_ITEM_BANK;
  const unseen = sessionPool.filter((item) => !input.priorExposure.has(item.prompt));
  const pool = unseen.length > 0 ? unseen : sessionPool;
  const distance = (item: { difficulty: number }) => Math.abs(item.difficulty - input.difficulty);
  const nearest = Math.min(...pool.map(distance));
  const candidates = pool.filter((item) => distance(item) === nearest);
  const pick = candidates[random(candidates.length)];
  const shuffled = shuffleOptions(pick.options, pick.correctIndex, random);
  return {
    source: "item_bank",
    difficulty: pick.difficulty,
    subject: "mathematics",
    strand: "general",
    moeStandard: null,
    prompt: pick.prompt,
    options: shuffled.options,
    correctIndex: shuffled.correctIndex,
    explanation: "",
    reusedPriorExposure: unseen.length === 0,
  };
}

/**
 * Produce the next item at the requested difficulty. AI generation is tried
 * first; any failure or malformed output falls back to the server item bank.
 */
export async function generatePlacementItem(input: {
  difficulty: number;
  usedPrompts: Set<string>;
  /** Prompts this learner saw in earlier sessions; loaded only on fallback. */
  loadPriorExposure: () => Promise<Set<string>>;
  schoolId: string;
  userId: string;
}): Promise<IssuedItemContent & { reusedPriorExposure?: boolean }> {
  const promptMetadata = getPromptMetadata("placement.question.system");
  try {
    const completion = await routedCompletion({
      messages: [
        {
          role: "system",
          content: buildPrompt("placement.question.system", {
            subjectText: "mathematics",
            difficultyDescription: DIFFICULTY_DESCRIPTIONS[input.difficulty],
            previousAnswers: "Server-held session; prior answers withheld",
            safeDifficulty: input.difficulty,
            subjectLower: "mathematics",
          }),
        },
        { role: "user", content: `Generate the placement question for mathematics at difficulty ${input.difficulty}.` },
      ],
      maxTokens: 600,
      forceSmartTier: true,
      aiUsage: {
        route: "/api/student/placement/sessions/[sessionId]/items",
        feature: "curriculum",
        schoolId: input.schoolId,
        userId: input.userId,
        studentId: input.userId,
        subject: "mathematics",
        requestType: "placement_question_generation",
        promptKey: promptMetadata.key,
        promptVersion: promptMetadata.version,
        promptHash: promptMetadata.hash,
        assessmentVersion: PLACEMENT_ASSESSMENT_VERSION,
      },
    });
    const parsed = completion?.content ? parseGeneratedItem(completion.content, input.difficulty) : null;
    if (parsed && !input.usedPrompts.has(parsed.prompt)) return parsed;
  } catch {
    // fall through to the bank
  }
  return drawBankItem({
    difficulty: input.difficulty,
    usedPrompts: input.usedPrompts,
    priorExposure: await input.loadPriorExposure(),
  });
}

/** Learner view of an unanswered item: no key, no explanation, no correctness. */
export function toPublicItem(item: StoredItem) {
  return {
    id: item.id,
    sequence: item.sequence,
    itemVersion: item.itemVersion,
    prompt: item.prompt,
    options: item.options,
    subject: item.subject,
    strand: item.strand,
  };
}

/**
 * Learner view after the response is recorded (the answer can no longer
 * change). Correctness is shown, but the answer key and explanation stay
 * server-side: revealing them let a learner harvest keys in one attempt and
 * replay them in a new session. Reviewers see keys through staff APIs only.
 */
export function toRespondedItem(item: StoredItem) {
  return {
    ...toPublicItem(item),
    selectedIndex: item.selectedIndex,
    isCorrect: item.isCorrect,
  };
}
