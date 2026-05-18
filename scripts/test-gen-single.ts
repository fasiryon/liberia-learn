/**
 * Quick single-lesson generation test. Run with:
 *   npx tsx scripts/test-gen-single.ts
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

import { routedCompletion } from "@/lib/ai/routedCompletion";
import { generateCurriculumPayload } from "@/lib/ai/curriculum-factory";
import { validateLessonDepth, extractLessonText } from "@/lib/curriculum/regenerationQualityGate";

async function rawTest() {
  console.log("[RAW TEST] Direct OpenAI call (no parsing)...");
  const start = Date.now();
  const raw = await routedCompletion({
    messages: [
      { role: "system", content: "You are a teacher. Write a G7 MATH lesson on Linear Equations." },
      { role: "user", content: 'Return JSON: {"title":"...","body_standard":"...write 1000+ words..."}' }
    ],
    maxTokens: 4000,
    forceSmartTier: true,
    responseFormat: "json",
    aiUsage: {
      route: "test",
      feature: "curriculum",
      requestType: "elite_curriculum_test",
      provider: "openai",
    }
  });
  const ms = Date.now() - start;
  console.log(`Time: ${(ms/1000).toFixed(1)}s | Model: ${raw.model} | Tokens: ${raw.inputTokens}in/${raw.outputTokens}out`);
  const body = (() => { try { return (JSON.parse(raw.content) as any).body_standard || ""; } catch { return raw.content; } })();
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  console.log(`Body words: ${words}`);
  console.log("\n--- Raw content first 500 chars ---");
  console.log(raw.content.slice(0, 500));
}

async function main() {
  console.log("[TEST] Env check — GROQ_API_KEY set:", !!process.env.GROQ_API_KEY, "| OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);
  console.log("[TEST] Generating G7 MATH — Linear Equations via OpenAI...");
  const start = Date.now();

  const result = await generateCurriculumPayload({
    grade: 7,
    subject: "MATH",
    topic: "Linear Equations with One Variable",
    contentType: "lesson",
    lessonFormat: "standard",
    liberiaContext: true,
    forceSmartTier: true,
  });

  const ms = Date.now() - start;
  const gen = result as Record<string, unknown>;
  const body = (typeof gen.body_standard === "string" ? gen.body_standard : "") || extractLessonText(result);
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const slides = (body.match(/^##\s+/gm) ?? []).length;

  console.log(`[TEST] Done in ${(ms / 1000).toFixed(1)}s`);
  console.log(`[TEST] Words: ${words} | Slides: ${slides}`);

  const depth = validateLessonDepth({ ...result, lessonContent: body }, 7);
  console.log(`[TEST] Depth gate: ${depth.valid ? "PASS" : "FAIL"} | Reasons: ${depth.failReasons.join("; ") || "none"}`);

  console.log("\n--- FIRST 1500 chars of body_standard ---");
  console.log(body.slice(0, 1500));
  console.log("\n--- LAST 500 chars ---");
  console.log(body.slice(-500));
}

rawTest().then(() => main()).catch((err) => {
  console.error("[TEST] Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
