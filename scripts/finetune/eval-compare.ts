/**
 * Eval: base gpt-4o-mini vs the fine-tuned model on held-out lesson specs.
 * Generates a lesson with each model from the same spec, scores both with the
 * quality proxy, and reports quality / cost / latency before-vs-after.
 *
 * The honest cost story: the FT model is trained on the lesson format, so it
 * runs with a ~20-token system prompt instead of the multi-thousand-token
 * curriculum prompt the base model needs. This script measures the real delta.
 *
 * Run: npx dotenv -e .env.production -- npx tsx scripts/finetune/eval-compare.ts \
 *        --ft-model ft:gpt-4o-mini-...:... [--limit 20]
 */
import { readFileSync } from "fs";
import { join } from "path";
import { getOpenAIClientOrThrow } from "@/lib/ai/openaiClient";
import { SFT_SYSTEM } from "@/lib/finetune/datasetBuilder";
import { scoreLessonBody } from "@/lib/finetune/score";
import { summarizeComparison, type EvalRow } from "@/lib/finetune/evalCompare";

// A representative "base" system prompt (long, as production uses today).
const BASE_SYSTEM =
  "You are an elite curriculum architect for the LiberiaLearn national platform. " +
  "Write a complete, world-class, grade-appropriate lesson grounded in Liberian context. " +
  "Follow concrete->representational->abstract progression, include worked examples, guided and " +
  "independent practice, an assessment section, and a student summary. Use Liberian names, places, " +
  "and currency (LD). Write actual instructional content, never a lesson plan or outline. " +
  "Aim for the grade-appropriate depth and length expected of a national-standard lesson.";

const PRICE = {
  baseIn: 0.15 / 1e6,
  baseOut: 0.6 / 1e6,
  ftIn: 0.3 / 1e6, // fine-tuned gpt-4o-mini inference is ~2x base rate
  ftOut: 1.2 / 1e6,
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`) || a === `--${name}`);
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=")[1] : process.argv[process.argv.indexOf(hit) + 1];
}
function gradeFrom(spec: string): number {
  const m = spec.match(/Grade\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 6;
}

async function generate(client: ReturnType<typeof getOpenAIClientOrThrow>, model: string, system: string, spec: string) {
  const t0 = Date.now();
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: spec },
    ],
    max_tokens: 2000,
  });
  return {
    body: res.choices[0]?.message?.content ?? "",
    inTok: res.usage?.prompt_tokens ?? 0,
    outTok: res.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - t0,
  };
}

async function main() {
  const ftModel = arg("ft-model");
  if (!ftModel) {
    console.error("--ft-model <id> is required (from scripts/finetune/data/ft-job.json).");
    process.exit(1);
  }
  const limit = arg("limit") ? parseInt(arg("limit")!, 10) : 20;
  const baseModel = arg("base-model") ?? "gpt-4o-mini";

  const valPath = join(process.cwd(), "scripts", "finetune", "data", "sft-val.jsonl");
  const specs = readFileSync(valPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(0, limit)
    .map((line) => JSON.parse(line).messages.find((m: { role: string }) => m.role === "user").content as string);

  const client = getOpenAIClientOrThrow();
  const rows: EvalRow[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const grade = gradeFrom(spec);
    // base needs the long prompt; FT uses the short SFT system prompt
    const base = await generate(client, baseModel, BASE_SYSTEM, spec);
    const ft = await generate(client, ftModel, SFT_SYSTEM, spec);
    rows.push({
      contentId: `val-${i}`,
      baseScore: scoreLessonBody(base.body, grade),
      ftScore: scoreLessonBody(ft.body, grade),
      baseCostUSD: base.inTok * PRICE.baseIn + base.outTok * PRICE.baseOut,
      ftCostUSD: ft.inTok * PRICE.ftIn + ft.outTok * PRICE.ftOut,
      baseLatencyMs: base.latencyMs,
      ftLatencyMs: ft.latencyMs,
    });
    console.log(`  [${i + 1}/${specs.length}] base=${rows[i].baseScore} ft=${rows[i].ftScore}`);
  }

  const s = summarizeComparison(rows);
  console.log("\n=== base vs fine-tuned ===");
  console.log(`n=${s.n}`);
  console.log(`quality:  base ${s.avgBaseScore.toFixed(1)}  ->  ft ${s.avgFtScore.toFixed(1)}  (delta ${s.scoreDelta.toFixed(1)})`);
  console.log(`cost/gen: base $${s.avgBaseCostUSD.toFixed(5)}  ->  ft $${s.avgFtCostUSD.toFixed(5)}  (${s.costReductionPct.toFixed(1)}% reduction)`);
  console.log(`latency:  base ${Math.round(s.avgBaseLatencyMs)}ms  ->  ft ${Math.round(s.avgFtLatencyMs)}ms`);
  console.log(`ft win/tie rate: ${(s.ftWinRate * 100).toFixed(0)}%`);
}

main().catch((e) => {
  console.error("eval failed:", e?.message || e);
  process.exit(1);
});
