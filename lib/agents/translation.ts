import { createHash } from "crypto";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { getSystemPrompt, buildPrompt } from "@/lib/ai/promptRegistry";
import { logger } from "@/lib/logger";

/**
 * Multi-language layer for agents: detect the caller's language, translate
 * inbound text to English for tool calls, and translate responses back. Results
 * are cached per (op, source, target, text) in-process to save LLM cost. All
 * operations fail safe (English / original text) rather than throwing.
 */

const cache = new Map<string, string>();
const MAX_CACHE = 2_000;

function cacheKey(op: string, source: string, target: string, text: string): string {
  const hash = createHash("sha256").update(text, "utf8").digest("hex").slice(0, 32);
  return `${op}:${source}:${target}:${hash}`;
}

function cacheGet(key: string): string | undefined {
  return cache.get(key);
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
}

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

export async function detectLanguage(text: string): Promise<string> {
  if (!text || !text.trim()) return "en";
  const key = cacheKey("detect", "-", "-", text);
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const completion = await routedCompletion({
      messages: [
        { role: "system", content: getSystemPrompt("agent.translation.detect.system") },
        { role: "user", content: text },
      ],
      maxTokens: 20,
      responseFormat: "json",
      aiUsage: { route: "agent/translation", feature: "agent_platform" as never, requestType: "agent_detect_language" },
    });
    const parsed = JSON.parse(stripFences(completion.content)) as { lang?: string };
    const lang = (parsed.lang || "en").toLowerCase().slice(0, 5);
    cacheSet(key, lang);
    return lang;
  } catch (e) {
    logger.warn("[agent.translation] detect failed, defaulting to en", {
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
    return "en";
  }
}

export async function translateToEnglish(text: string, sourceLang: string): Promise<string> {
  if (!text || !text.trim() || sourceLang === "en") return text;
  const key = cacheKey("toEn", sourceLang, "en", text);
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const completion = await routedCompletion({
      messages: [
        { role: "system", content: getSystemPrompt("agent.translation.toEnglish.system") },
        { role: "user", content: text },
      ],
      maxTokens: 800,
      responseFormat: "json",
      aiUsage: { route: "agent/translation", feature: "agent_platform" as never, requestType: "agent_translate_to_en" },
    });
    const parsed = JSON.parse(stripFences(completion.content)) as { text?: string };
    const out = parsed.text || text;
    cacheSet(key, out);
    return out;
  } catch (e) {
    logger.warn("[agent.translation] toEnglish failed, returning original", {
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
    return text;
  }
}

export async function translateFromEnglish(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim() || targetLang === "en") return text;
  const key = cacheKey("fromEn", "en", targetLang, text);
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const completion = await routedCompletion({
      messages: [
        {
          role: "system",
          content: buildPrompt("agent.translation.fromEnglish.system", { targetLang }),
        },
        { role: "user", content: text },
      ],
      maxTokens: 800,
      responseFormat: "json",
      aiUsage: { route: "agent/translation", feature: "agent_platform" as never, requestType: "agent_translate_from_en" },
    });
    const parsed = JSON.parse(stripFences(completion.content)) as { text?: string };
    const out = parsed.text || text;
    cacheSet(key, out);
    return out;
  } catch (e) {
    logger.warn("[agent.translation] fromEnglish failed, returning English", {
      message: e instanceof Error ? e.message.slice(0, 200) : String(e),
    });
    return text;
  }
}
