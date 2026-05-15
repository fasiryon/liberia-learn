import { getOpenAIClientOrThrow } from "@/lib/ai/openaiClient";
import { checkBudget } from "@/lib/ai/budgetGuard";
import {
  logAIInteraction,
  type AiBudgetFeature,
  type LogAIInteractionInput,
} from "@/lib/ai/interactionLog";

let _groq: any = null;
function getGroq() {
  if (!_groq) {
    const Groq = require("groq-sdk").default ?? require("groq-sdk"); // eslint-disable-line
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

export type Tier = "fast" | "smart";
export type Provider = "openai" | "groq" | "grok";

export type AiUsageContext = {
  route: string;
  feature: AiBudgetFeature;
  schoolId?: string | null;
  userId?: string | null;
  studentId?: string | null;
  subject?: string | null;
  strandKey?: string | null;
  requestType?: string | null;
  guidanceLevel?: string | null;
  contentId?: string | null;
  lessonId?: string | null;
  provider?: Provider | string | null;
  budgetFallbackContent?: string | null;
  promptKey?: string | null;
  promptVersion?: string | null;
  promptHash?: string | null;
  contentVersion?: string | null;
  assessmentVersion?: string | null;
  calculationVersion?: string | null;
  clientEventId?: string | null;
  originalTimestamp?: Date | string | null;
  syncReceivedAt?: Date | string | null;
  dedupeKey?: string | null;
  sourceEventId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export interface RouterOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  forceSmartTier?: boolean;
  aiUsage?: AiUsageContext;
  /** When set to "json", instructs the model to return only valid JSON (JSON mode). */
  responseFormat?: "json" | "text";
}

export interface RouterResult {
  content: string;
  tier: Tier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
  budgetBlocked?: boolean;
}

function completionTimeoutMs(aiUsage?: AiUsageContext) {
  const requestType = aiUsage?.requestType ?? "";
  // Elite curriculum generation prompts are large (5000+ input tokens + long output).
  // Allow 4 minutes so Groq/OpenAI can complete without aborting mid-response.
  return requestType.startsWith("elite_curriculum_") ? 240_000 : 30_000;
}

const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_SMART_MODEL = "llama-3.3-70b-versatile";
const GROK_MODEL = "grok-3";
const OPENAI_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";
const GROK_COMPLETIONS_ENDPOINT = "https://api.x.ai/v1/chat/completions";

const COSTS = {
  groq_input: 0.1 / 1_000_000,
  groq_output: 0.1 / 1_000_000,
  groq_smart_input: 0.59 / 1_000_000,
  groq_smart_output: 0.79 / 1_000_000,
  grok_input: 3 / 1_000_000,
  grok_output: 15 / 1_000_000,
  openai_input: 0.15 / 1_000_000,
  openai_output: 0.6 / 1_000_000,
};

const COMPLEX_KEYWORDS = [
  "essay",
  "analyze",
  "analyse",
  "compare",
  "contrast",
  "explain why",
  "how does",
  "evaluate",
  "discuss",
  "argue",
  "persuade",
  "write a",
  "prove",
  "derive",
  "calculate step",
  "step by step",
];

const SIMPLE_PATTERNS = [/^what is\b/i, /^who is\b/i, /^define\b/i, /^when did\b/i, /^where is\b/i];

function buildTelemetryInput(
  usage: AiUsageContext,
  completion: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUSD: number;
    model: string;
    tier: Tier;
  },
  fallbackUsed: boolean
): LogAIInteractionInput {
  return {
    route: usage.route,
    feature: usage.feature,
    schoolId: usage.schoolId ?? null,
    userId: usage.userId ?? null,
    studentId: usage.studentId ?? usage.userId ?? null,
    subject: usage.subject ?? null,
    strandKey: usage.strandKey ?? null,
    requestType: usage.requestType ?? null,
    guidanceLevel: usage.guidanceLevel ?? null,
    contentId: usage.contentId ?? null,
    lessonId: usage.lessonId ?? null,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
    estimatedCostUSD: completion.estimatedCostUSD,
    model: completion.model,
    provider: usage.provider ?? null,
    tier: completion.tier,
    fallbackUsed,
    promptKey: usage.promptKey ?? null,
    promptVersion: usage.promptVersion ?? null,
    promptHash: usage.promptHash ?? null,
    contentVersion: usage.contentVersion ?? null,
    assessmentVersion: usage.assessmentVersion ?? null,
    calculationVersion: usage.calculationVersion ?? null,
    clientEventId: usage.clientEventId ?? null,
    originalTimestamp: usage.originalTimestamp ?? null,
    syncReceivedAt: usage.syncReceivedAt ?? null,
    dedupeKey: usage.dedupeKey ?? null,
    sourceEventId: usage.sourceEventId ?? null,
    metadata: usage.metadata ?? null,
  };
}

export function classifyMessage(message: string): {
  tier: Tier;
  reason: string;
} {
  const trimmed = message.trim();
  const len = trimmed.length;

  if (len < 60 && SIMPLE_PATTERNS.some((p) => p.test(trimmed))) {
    return { tier: "fast", reason: "short_simple_pattern" };
  }

  if (len > 400) {
    return { tier: "smart", reason: "long_message" };
  }

  const lower = trimmed.toLowerCase();
  for (const kw of COMPLEX_KEYWORDS) {
    if (lower.includes(kw)) {
      return { tier: "smart", reason: `complex_keyword:${kw}` };
    }
  }

  if (len <= 200) {
    return { tier: "fast", reason: "default_short" };
  }

  return { tier: "smart", reason: "default_medium" };
}

async function callOpenAI(
  messages: RouterOptions["messages"],
  maxTokens: number,
  timeoutMs: number,
  responseFormat?: "json" | "text"
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const client = getOpenAIClientOrThrow();
  try {
    const completion = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        messages,
        max_tokens: maxTokens,
        ...(responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      },
      { signal: AbortSignal.timeout(timeoutMs) }
    );

    return {
      content: completion.choices[0]?.message?.content ?? "I'm not sure how to answer that.",
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`AI provider timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }
}

async function callGrok(
  messages: RouterOptions["messages"],
  maxTokens: number,
  timeoutMs: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is required to use the Grok provider");
  }

  try {
    const response = await fetch(GROK_COMPLETIONS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Grok provider request failed with ${response.status}${errorText ? `: ${errorText}` : ""}`
      );
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: completion.choices?.[0]?.message?.content ?? "I'm not sure how to answer that.",
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`AI provider timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }
}

function normalizeEmbeddingText(input: string): string {
  const normalized = input.toWellFormed().replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("Cannot generate embedding for empty input");
  }
  return normalized;
}

type RoutedEmbeddingOptions = {
  input: string | string[];
  model?: string;
};

type RoutedEmbeddingResult = {
  model: string;
  embedding: number[] | number[][];
};

export function routedEmbedding(
  opts: { input: string; model?: string }
): Promise<{ model: string; embedding: number[] }>;
export function routedEmbedding(
  opts: { input: string[]; model?: string }
): Promise<{ model: string; embedding: number[][] }>;
export async function routedEmbedding(
  opts: RoutedEmbeddingOptions
): Promise<RoutedEmbeddingResult> {
  const normalizedInput = Array.isArray(opts.input)
    ? opts.input.map(normalizeEmbeddingText)
    : normalizeEmbeddingText(opts.input);

  const client = getOpenAIClientOrThrow();
  const response = await client.embeddings.create({
    model: opts.model ?? EMBEDDING_MODEL,
    input: normalizedInput,
  });

  if (Array.isArray(normalizedInput)) {
    const embedding = response.data.map((item) => item.embedding);
    if (
      embedding.length !== normalizedInput.length ||
      embedding.some((vector) => !Array.isArray(vector))
    ) {
      throw new Error("Embedding model returned no vectors");
    }

    return {
      model: opts.model ?? EMBEDDING_MODEL,
      embedding,
    };
  }

  const embedding = response.data[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding model returned no vector");
  }

  return {
    model: opts.model ?? EMBEDDING_MODEL,
    embedding,
  };
}

export async function routedCompletion(opts: RouterOptions): Promise<RouterResult> {
  const lastUserMsg =
    [...opts.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const classification = opts.forceSmartTier
    ? { tier: "smart" as Tier, reason: "forced" }
    : classifyMessage(lastUserMsg);

  const maxTokens = opts.maxTokens ?? 512;
  const timeoutMs = completionTimeoutMs(opts.aiUsage);
  if (opts.aiUsage) {
    const budget = await checkBudget(opts.aiUsage.feature, opts.aiUsage.schoolId ?? null);
    if (!budget.allowed) {
      logAIInteraction(
        buildTelemetryInput(
          opts.aiUsage,
          {
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUSD: 0,
            model: "budget_guard",
            tier: classification.tier,
          },
          true
        )
      ).catch((e) => console.warn("Log skipped:", e instanceof Error ? e.message : String(e)));

      return {
        content:
          opts.aiUsage.budgetFallbackContent ??
          JSON.stringify({ hadFallback: true, fallbackReason: budget.fallbackReason }),
        tier: classification.tier,
        model: "budget_guard",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUSD: 0,
        budgetBlocked: true,
      };
    }
  }

  let providerFallbackUsed = false;
  let response: RouterResult | null = null;
  const requestedProvider = opts.aiUsage?.provider?.trim().toLowerCase();

  if (requestedProvider === "grok") {
    const result = await callGrok(opts.messages, maxTokens, timeoutMs);
    response = {
      content: result.content,
      tier: classification.tier,
      model: GROK_MODEL,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUSD:
        result.inputTokens * COSTS.grok_input + result.outputTokens * COSTS.grok_output,
    };
  }

  // Skip Groq when caller explicitly requests openai (e.g. curriculum generation
  // where JSON consistency and longer outputs are more important than cost).
  const skipGroq = requestedProvider === "openai";

  if (!response && !skipGroq && process.env.GROQ_API_KEY) {
    const useSmartGroq = classification.tier === "smart" || opts.forceSmartTier;
    const groqModel = useSmartGroq ? GROQ_SMART_MODEL : GROQ_MODEL;
    try {
      const groq = getGroq();
      const completion = await groq.chat.completions.create({
        model: groqModel,
        messages: opts.messages,
        max_tokens: maxTokens,
        signal: AbortSignal.timeout(timeoutMs),
        ...(opts.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      });

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const costIn = useSmartGroq ? COSTS.groq_smart_input : COSTS.groq_input;
      const costOut = useSmartGroq ? COSTS.groq_smart_output : COSTS.groq_output;

      response = {
        content: completion.choices[0]?.message?.content ?? "I'm not sure how to answer that.",
        tier: useSmartGroq ? "smart" : "fast",
        model: groqModel,
        inputTokens,
        outputTokens,
        estimatedCostUSD: inputTokens * costIn + outputTokens * costOut,
      };
    } catch {
      providerFallbackUsed = true;
    }
  }

  if (!response) {
    const result = await callOpenAI(opts.messages, maxTokens, timeoutMs, opts.responseFormat);
    response = {
      content: result.content,
      tier: classification.tier,
      model: OPENAI_MODEL,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUSD:
        result.inputTokens * COSTS.openai_input + result.outputTokens * COSTS.openai_output,
    };
  }

  if (opts.aiUsage) {
    logAIInteraction(
      buildTelemetryInput(opts.aiUsage, response, providerFallbackUsed)
    ).catch((e) => console.warn("Log skipped:", e instanceof Error ? e.message : String(e)));
  }

  return response;
}
