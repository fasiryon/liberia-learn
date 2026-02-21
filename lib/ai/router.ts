// lib/ai/router.ts
import OpenAI from "openai";

let _groq: any = null;
function getGroq() {
  if (!_groq) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Groq = require("groq-sdk").default ?? require("groq-sdk");
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

  // Short messages matching simple patterns â†’ fast
  if (len < 60 && SIMPLE_PATTERNS.some((p) => p.test(trimmed))) {
    return { tier: "fast", reason: "short_simple_pattern" };
  }

  // Long messages â†’ smart
  if (len > 400) {
    return { tier: "smart", reason: "long_message" };
  }

  // Complex keywords â†’ smart
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
}

export interface RouterResult {
  content: string;
  tier: Tier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUSD: number;
}

const GROQ_MODEL = "llama-3.1-8b-instant";
const OPENAI_MODEL = "gpt-4o-mini";

const COSTS = {
  groq_input: 0.05 / 1_000_000,
  groq_output: 0.08 / 1_000_000,
  openai_input: 0.15 / 1_000_000,
  openai_output: 0.6 / 1_000_000,
};

async function callOpenAI(
  messages: RouterOptions["messages"],
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    max_tokens: maxTokens,
  });

  return {
    content:
      completion.choices[0]?.message?.content ??
      "I'm not sure how to answer that.",
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
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

  // Try Groq for fast tier if API key available
  if (classification.tier === "fast" && process.env.GROQ_API_KEY) {
    try {
      const groq = getGroq();
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: opts.messages,
        max_tokens: maxTokens,
      });

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      return {
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
    }
  }

  // Default: OpenAI
  const result = await callOpenAI(opts.messages, maxTokens);

  return {
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

