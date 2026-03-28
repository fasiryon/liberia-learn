import { z } from "zod";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import {
  buildAssistantActions,
  type AssistantAction,
} from "@/lib/ai/rag/assistantActions";
import {
  type RetrievalContext,
  retrieveRelevantChunks,
  type RetrievedChunk,
  type RetrievalMode,
} from "@/lib/ai/rag/retrievalService";
import type { SessionUser } from "@/lib/auth";

const MIN_TOP_SIMILARITY = 0.72;
const MIN_AVG_SIMILARITY = 0.66;
const MIN_SHORT_CONTEXT_CONFIDENCE = 0.84;

const GroundedAnswerSchema = z.object({
  answer: z.string().min(1),
  sourceIds: z.array(z.string()).min(1).max(5),
});

export type GroundedSource = {
  id: string;
  title: string;
  excerpt: string;
  sourceType: "curriculum" | "lesson" | "standard" | "policy";
  sourceLabel: string | null;
  similarity: number;
  groundingStrength?: "weak" | "grounded";
};

export type GroundedAnswerResult = {
  answer: string;
  sources: GroundedSource[];
  retrievalWeak: boolean;
  hadFallback: boolean;
  isWeakGrounding: boolean;
  actions: AssistantAction[];
};

type QueryInput = {
  question: string;
  schoolId: string;
  subject?: string | null;
  grade?: number | null;
  allowedSubjects?: string[] | null;
  allowedGrades?: number[] | null;
  mode?: RetrievalMode;
  role: SessionUser["role"];
  context?: RetrievalContext;
  chunks?: RetrievedChunk[];
  isEvalRun?: boolean;
};

const POLICY_KEYWORDS = [
  "policy",
  "governance",
  "compliance",
  "security",
  "tenant isolation",
  "privacy",
  "audit",
  "moe",
];

function inferRetrievalMode(input: QueryInput): RetrievalMode {
  if (input.mode) {
    return input.mode;
  }

  const question = input.question.toLowerCase();
  if (POLICY_KEYWORDS.some((keyword) => question.includes(keyword))) {
    return "policy";
  }

  if (input.subject || typeof input.grade === "number") {
    return "classroom";
  }

  return "mixed";
}

function buildWeakRetrievalAnswerForInput(
  chunks: RetrievedChunk[],
  input: Pick<QueryInput, "role" | "question" | "subject" | "grade" | "context">
): GroundedAnswerResult {
  return {
    answer:
      "Weak grounding: I could not find enough approved LiberiaLearn content to answer that confidently. Try narrowing the question by subject, grade, or route context.",
    sources: chunks.slice(0, 3).map((chunk) => toSource(chunk, "weak")),
    retrievalWeak: true,
    hadFallback: true,
    isWeakGrounding: true,
    actions: buildAssistantActions({
      role: input.role,
      question: input.question,
      subject: input.subject,
      gradeLevel:
        input.context?.gradeLevel ??
        (typeof input.grade === "number" ? String(input.grade) : null),
      context: input.context,
    }),
  };
}

function hasUsableChunks(chunks: RetrievedChunk[]): boolean {
  return chunks.some(
    (chunk) =>
      typeof chunk.content === "string" &&
      chunk.content.trim().length > 0 &&
      typeof chunk.title === "string" &&
      chunk.title.trim().length > 0
  );
}

function isExplicitRefusal(answer: string): boolean {
  const normalized = normalizeText(answer);
  return [
    "i could not find enough approved liberialearn content",
    "i cannot answer that confidently",
    "i can't answer that confidently",
    "unable to answer",
    "not enough grounded information",
    "do not have enough information",
  ].some((pattern) => normalized.includes(pattern));
}

function parseGroundedAnswerResponse(raw: string): z.infer<typeof GroundedAnswerSchema> | null {
  const candidates = [raw];
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch && objectMatch[0] !== raw) {
    candidates.push(objectMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      return GroundedAnswerSchema.parse(JSON.parse(candidate));
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function getMetadataText(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  const record = metadata as Record<string, unknown>;
  const values = [
    record.sourceType,
    record.kind,
    record.contentType,
    record.sourceKind,
    record.documentType,
    record.category,
    record.label,
  ];

  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function normalizeGroundedSourceType(
  chunk: Pick<RetrievedChunk, "sourceType" | "sourceLabel" | "title" | "content"> & {
    metadata?: unknown;
  }
): GroundedSource["sourceType"] {
  const rawSourceType = normalizeText(chunk.sourceType);
  const sourceLabel = normalizeText(chunk.sourceLabel);
  const title = normalizeText(chunk.title);
  const content = normalizeText(chunk.content.slice(0, 160));
  const metadataText = getMetadataText(chunk.metadata);
  const combined = [rawSourceType, metadataText, sourceLabel, title, content]
    .filter(Boolean)
    .join(" ");

  if (
    containsAny(combined, [
      "curriculum_content",
      "lesson_content",
      "curriculum",
      "scheme of work",
      "unit plan",
    ])
  ) {
    return "curriculum";
  }

  if (containsAny(combined, ["assignment", "lesson", "homework", "worksheet"])) {
    return "lesson";
  }

  if (
    containsAny(combined, [
      "moe_standard",
      "standard",
      "benchmark",
      "competency",
      "strand",
      "outcome",
    ])
  ) {
    return "standard";
  }

  if (
    containsAny(combined, [
      "policy",
      "governance",
      "security",
      "compliance",
      "adr",
      "architecture decision",
      "privacy",
      "audit",
    ])
  ) {
    return "policy";
  }

  if (containsAny(combined, ["teacher", "lesson objective", "class activity", "practice"])) {
    return "lesson";
  }

  return "curriculum";
}

function toSource(
  chunk: RetrievedChunk,
  groundingStrength: "weak" | "grounded" = "grounded"
): GroundedSource {
  return {
    id: chunk.id,
    title: chunk.title,
    excerpt: chunk.content.slice(0, 240),
    sourceType: normalizeGroundedSourceType(chunk),
    sourceLabel: chunk.sourceLabel,
    similarity: chunk.similarity,
    groundingStrength,
  };
}

export function isWeakRetrieval(chunks: RetrievedChunk[]): boolean {
  if (chunks.length === 0) {
    return true;
  }

  const topSimilarity = chunks[0]?.similarity ?? 0;
  const averageSimilarity =
    chunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / chunks.length;
  const totalRetrievedText = chunks.reduce(
    (sum, chunk) => sum + chunk.content.trim().length,
    0
  );

  if (topSimilarity < MIN_TOP_SIMILARITY || averageSimilarity < MIN_AVG_SIMILARITY) {
    return true;
  }

  if (totalRetrievedText < 15 && topSimilarity < MIN_SHORT_CONTEXT_CONFIDENCE) {
    return true;
  }

  return false;
}

function buildAudienceInstruction(role: SessionUser["role"]): string {
  if (role === "STUDENT") {
    return "Explain concepts like a supportive tutor. Focus on learning help, not administration or policy.";
  }

  if (role === "GUARDIAN") {
    return "Answer like a family-facing learning support assistant. Keep the guidance practical, safe, and free of internal school operations.";
  }

  return "Answer like a grounded school assistant for teachers and administrators.";
}

function buildPrompt(question: string, chunks: RetrievedChunk[], role: SessionUser["role"]): string {
  const context = chunks
    .map(
      (chunk, index) =>
        `Source ${index + 1} (id: ${chunk.id})\nTitle: ${chunk.title}\nType: ${chunk.sourceType}\nContent:\n${chunk.content}`
    )
    .join("\n\n");

  return `You are answering a LiberiaLearn educational query.
Answer using the provided context only.
You must answer only from the provided sources.
If the sources do not fully answer the question, say that clearly and stay conservative.
Do not cite any source id that is not present below.
${buildAudienceInstruction(role)}

Return JSON only in this exact shape:
{
  "answer": "<grounded answer>",
  "sourceIds": ["<source-id-1>", "<source-id-2>"]
}

Question:
${question}

Retrieved context:
${context}`;
}

export async function answerGroundedQuestion(input: QueryInput): Promise<GroundedAnswerResult> {
  const mode = inferRetrievalMode(input);
  const chunks =
    input.chunks ??
    (await retrieveRelevantChunks({
      question: input.question,
      schoolId: input.schoolId,
      subject: input.subject,
      grade: input.grade,
      allowedSubjects: input.allowedSubjects,
      allowedGrades: input.allowedGrades,
      topK: 5,
      mode,
      context: input.context,
    }));
  const retrievalWeak = isWeakRetrieval(chunks);

  if (!hasUsableChunks(chunks)) {
    return buildWeakRetrievalAnswerForInput(chunks, input);
  }

  try {
    const response = await routedCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are a grounded LiberiaLearn assistant. Answer only from retrieved content and never invent sources.",
        },
        {
          role: "user",
          content: buildPrompt(input.question, chunks, input.role),
        },
      ],
      maxTokens: 500,
      forceSmartTier: true,
    });
    const parsed = parseGroundedAnswerResponse(response.content);
    if (!parsed || !parsed.answer.trim() || isExplicitRefusal(parsed.answer)) {
      return buildWeakRetrievalAnswerForInput(chunks, input);
    }

    const allowedIds = new Set(chunks.map((chunk) => chunk.id));
    const citedIds = parsed.sourceIds.filter((id) => allowedIds.has(id));
    const effectiveCitedIds =
      citedIds.length > 0
        ? citedIds
        : chunks.slice(0, Math.min(3, chunks.length)).map((chunk) => chunk.id);

    return {
      answer: parsed.answer.trim(),
      sources: chunks
        .filter((chunk) => effectiveCitedIds.includes(chunk.id))
        .map((chunk) => toSource(chunk, "grounded")),
      retrievalWeak,
      hadFallback: false,
      isWeakGrounding: retrievalWeak,
      actions: buildAssistantActions({
        role: input.role,
        question: input.question,
        subject: input.subject,
        gradeLevel:
          input.context?.gradeLevel ??
          (typeof input.grade === "number" ? String(input.grade) : null),
        context: input.context,
      }),
    };
  } catch {
    return buildWeakRetrievalAnswerForInput(chunks, input);
  }
}
