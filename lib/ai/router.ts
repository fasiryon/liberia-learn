// lib/ai/router.ts
import { getOpenAIClientOrThrow } from "@/lib/ai/openaiClient";
import { checkBudget } from "@/lib/ai/budgetGuard";
import { recordAiUsage, type AiBudgetFeature } from "@/lib/ai/interactionLog";

let _groq: any = null;
function getGroq() {
  if (!_groq) {
    const Groq = require("groq-sdk").default ?? require("groq-sdk"); // eslint-disable-line
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}


export type Tier = "fast" | "smart";

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

const SIMPLE_PATTERNS = [
  /^what is\b/i,
  /^who is\b/i,
  /^define\b/i,
  /^when did\b/i,
  /^where is\b/i,
];

export function classifyMessage(message: string): {
  tier: Tier;
  reason: string;
} {
  const trimmed = message.trim();
  const len = trimmed.length;

  // Short messages matching simple patterns → fast
  if (len < 60 && SIMPLE_PATTERNS.some((p) => p.test(trimmed))) {
    return { tier: "fast", reason: "short_simple_pattern" };
  }

  // Long messages → smart
  if (len > 400) {
    return { tier: "smart", reason: "long_message" };
  }

  // Complex keywords → smart
  const lower = trimmed.toLowerCase();
  for (const kw of COMPLEX_KEYWORDS) {
    if (lower.includes(kw)) {
      return { tier: "smart", reason: `complex_keyword:${kw}` };
    }
  }

  // Default: fast for short, smart for medium-long
  if (len <= 200) {
    return { tier: "fast", reason: "default_short" };
  }

  return { tier: "smart", reason: "default_medium" };
}

export interface RouterOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  forceSmartTier?: boolean;
  aiUsage?: {
    route: string;
    feature: AiBudgetFeature;
    schoolId?: string | null;
    userId?: string | null;
    subject?: string | null;
    strandKey?: string | null;
    requestType?: string | null;
    guidanceLevel?: string | null;
    budgetFallbackContent?: string | null;
  };
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

const GROQ_MODEL = "llama-3.1-8b-instant";
const OPENAI_MODEL = "gpt-4o-mini";

const COSTS = {
  groq_input: 0.1 / 1_000_000,
  groq_output: 0.1 / 1_000_000,
  openai_input: 0.15 / 1_000_000,
  openai_output: 0.6 / 1_000_000,
};

async function callOpenAI(
  messages: RouterOptions["messages"],
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const client = getOpenAIClientOrThrow();
  try {
    const completion = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        messages,
        max_tokens: maxTokens,
      },
      { signal: AbortSignal.timeout(30_000) }
    );

    return {
      content:
        completion.choices[0]?.message?.content ??
        "I'm not sure how to answer that.",
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI provider timeout after 30s");
    }
    throw err;
  }
}

export async function routedCompletion(
  opts: RouterOptions
): Promise<RouterResult> {
  const lastUserMsg =
    [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const classification = opts.forceSmartTier
    ? { tier: "smart" as Tier, reason: "forced" }
    : classifyMessage(lastUserMsg);

  const maxTokens = opts.maxTokens ?? 512;
  if (opts.aiUsage) {
    const budget = await checkBudget(opts.aiUsage.feature, opts.aiUsage.schoolId ?? null);
    if (!budget.allowed) {
      void recordAiUsage({
        route: opts.aiUsage.route,
        feature: opts.aiUsage.feature,
        schoolId: opts.aiUsage.schoolId ?? null,
        userId: opts.aiUsage.userId ?? null,
        subject: opts.aiUsage.subject ?? null,
        strandKey: opts.aiUsage.strandKey ?? null,
        requestType: opts.aiUsage.requestType ?? null,
        guidanceLevel: opts.aiUsage.guidanceLevel ?? null,
        tokensUsed: 0,
        estimatedCostUSD: 0,
        model: "budget_guard",
        tier: classification.tier,
        fallbackUsed: true,
      });

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

  // Try Groq for fast tier if API key available
  if (classification.tier === "fast" && process.env.GROQ_API_KEY) {
    try {
      const groq = getGroq();
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: opts.messages,
        max_tokens: maxTokens,
        signal: AbortSignal.timeout(30_000),
      });

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      response = {
        content:
          completion.choices[0]?.message?.content ??
          "I'm not sure how to answer that.",
        tier: "fast",
        model: GROQ_MODEL,
        inputTokens,
        outputTokens,
        estimatedCostUSD:
          inputTokens * COSTS.groq_input + outputTokens * COSTS.groq_output,
      };
    } catch {
      // Fall through to OpenAI
      providerFallbackUsed = true;
    }
  }

  if (!response) {
    // Default: OpenAI
    const result = await callOpenAI(opts.messages, maxTokens);

    response = {
      content: result.content,
      tier: classification.tier,
      model: OPENAI_MODEL,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUSD:
        result.inputTokens * COSTS.openai_input +
        result.outputTokens * COSTS.openai_output,
    };
  }

  if (opts.aiUsage) {
    void recordAiUsage({
      route: opts.aiUsage.route,
      feature: opts.aiUsage.feature,
      schoolId: opts.aiUsage.schoolId ?? null,
      userId: opts.aiUsage.userId ?? null,
      subject: opts.aiUsage.subject ?? null,
      strandKey: opts.aiUsage.strandKey ?? null,
      requestType: opts.aiUsage.requestType ?? null,
      guidanceLevel: opts.aiUsage.guidanceLevel ?? null,
      tokensUsed: response.inputTokens + response.outputTokens,
      estimatedCostUSD: response.estimatedCostUSD,
      model: response.model,
      tier: response.tier,
      fallbackUsed: providerFallbackUsed,
    });
  }

  return response;
}
