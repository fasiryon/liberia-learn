/**
 * Server-side placement item issuance and learner-safe serialization.
 *
 * Items are generated (or drawn from the fallback bank) on the server and
 * persisted with their answer key. Only toPublicItem / toRespondedItem shapes
 * ever reach a learner, and the key appears only after the response is stored.
 */
import { createHash } from "crypto";
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

function bankItem(difficulty: number, usedPrompts: Set<string>): IssuedItemContent {
  const unused = PLACEMENT_ITEM_BANK.filter((item) => !usedPrompts.has(item.prompt));
  const pool = unused.length > 0 ? unused : PLACEMENT_ITEM_BANK;
  const pick = [...pool].sort(
    (a, b) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty)
  )[0];
  return {
    source: "item_bank",
    difficulty: pick.difficulty,
    subject: "mathematics",
    strand: "general",
    moeStandard: null,
    prompt: pick.prompt,
    options: [...pick.options],
    correctIndex: pick.correctIndex,
    explanation: "",
  };
}

/**
 * Produce the next item at the requested difficulty. AI generation is tried
 * first; any failure or malformed output falls back to the server item bank.
 */
export async function generatePlacementItem(input: {
  difficulty: number;
  usedPrompts: Set<string>;
  schoolId: string;
  userId: string;
}): Promise<IssuedItemContent> {
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
  return bankItem(input.difficulty, input.usedPrompts);
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

/** Learner view after the response is recorded (the answer can no longer change). */
export function toRespondedItem(item: StoredItem) {
  return {
    ...toPublicItem(item),
    selectedIndex: item.selectedIndex,
    isCorrect: item.isCorrect,
    correctIndex: item.correctIndex,
    explanation: item.explanation || null,
  };
}
