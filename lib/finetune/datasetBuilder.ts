import { createHash } from "crypto";

/**
 * SFT dataset builder for LiberiaLearn lesson generation.
 * Maps human-approved CurriculumContent (payload.body) into OpenAI chat
 * fine-tuning examples. Pure + deterministic so it is fully testable.
 * DPO (phase 2) will add a preference-pair builder alongside this file.
 */

export const SFT_SYSTEM =
  "You are a LiberiaLearn curriculum author. Write a complete, grade-appropriate lesson grounded in Liberian context for the given specification.";

/** Minimum approved-body length to be worth training on. */
const MIN_BODY_CHARS = 300;

export interface LessonRecord {
  contentId: string;
  title: string | null;
  grade: number;
  subject: string;
  status?: string;
  // eslint-disable-next-line
  payload: any;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SftExample {
  messages: ChatMessage[];
  meta: { contentId: string; grade: number; subject: string; tokensApprox: number };
}

/** Rough token estimate (~4 chars/token). Good enough for cost planning. */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

function objectivesText(payload: { objectives?: unknown }): string {
  const o = payload?.objectives;
  if (Array.isArray(o)) return o.map(String).join("; ");
  if (typeof o === "string") return o;
  return "";
}

export function buildSftExample(lesson: LessonRecord): SftExample | null {
  const body = typeof lesson?.payload?.body === "string" ? lesson.payload.body.trim() : "";
  if (body.length < MIN_BODY_CHARS) return null;

  const title = lesson.title ?? lesson.payload?.title ?? "Untitled lesson";
  const objectives = objectivesText(lesson.payload);
  const spec = [
    `Grade ${lesson.grade}`,
    `Subject: ${lesson.subject}`,
    `Title: ${title}`,
    objectives ? `Objectives: ${objectives}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: SFT_SYSTEM },
    { role: "user", content: spec },
    { role: "assistant", content: body },
  ];

  return {
    messages,
    meta: {
      contentId: lesson.contentId,
      grade: lesson.grade,
      subject: lesson.subject,
      tokensApprox: estimateTokens(spec) + estimateTokens(body) + estimateTokens(SFT_SYSTEM),
    },
  };
}

export function buildDataset(lessons: LessonRecord[]): { examples: SftExample[]; skipped: number } {
  const examples: SftExample[] = [];
  const seenIds = new Set<string>();
  const seenBodies = new Set<string>();
  let skipped = 0;

  for (const lesson of lessons) {
    if (seenIds.has(lesson.contentId)) {
      skipped += 1;
      continue;
    }
    const ex = buildSftExample(lesson);
    if (!ex) {
      skipped += 1;
      continue;
    }
    const bodyHash = createHash("sha256").update(ex.messages[2].content).digest("hex");
    if (seenBodies.has(bodyHash)) {
      skipped += 1;
      continue;
    }
    seenIds.add(lesson.contentId);
    seenBodies.add(bodyHash);
    examples.push(ex);
  }

  return { examples, skipped };
}

/** Deterministic seeded shuffle (mulberry32) so splits are reproducible. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const a = [...items];
  let s = seed >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function splitTrainVal<T>(
  items: T[],
  valRatio = 0.1,
  seed = 42
): { train: T[]; val: T[] } {
  const shuffled = seededShuffle(items, seed);
  const valCount = Math.round(items.length * valRatio);
  return { val: shuffled.slice(0, valCount), train: shuffled.slice(valCount) };
}

/**
 * gpt-4o-mini fine-tuning TRAINING cost. Priced per 1M training tokens
 * (~$3.00/1M at time of writing), billed per epoch.
 */
const GPT4O_MINI_FT_TRAIN_PER_1M = 3.0;

export function estimateFtCostUSD(
  examples: Array<{ meta: { tokensApprox: number } }>,
  epochs = 3
): number {
  const trainTokens = examples.reduce((sum, e) => sum + e.meta.tokensApprox, 0);
  return (trainTokens / 1_000_000) * GPT4O_MINI_FT_TRAIN_PER_1M * epochs;
}

/** OpenAI fine-tuning wants one JSON object per line, FT format only (no meta). */
export function toJsonl(examples: SftExample[]): string {
  return examples.map((e) => JSON.stringify({ messages: e.messages })).join("\n") + "\n";
}
