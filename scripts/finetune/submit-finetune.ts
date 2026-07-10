/**
 * Submit the SFT fine-tuning job to OpenAI (gpt-4o-mini). GATED: prints the
 * cost estimate and does NOTHING unless you pass --confirm, so a training run
 * never happens by accident.
 *
 * Run (dry run, no spend):  npx dotenv -e .env.production -- npx tsx scripts/finetune/submit-finetune.ts
 * Run (actually train):     ... scripts/finetune/submit-finetune.ts --confirm
 */
import { readFileSync, writeFileSync, createReadStream } from "fs";
import { join } from "path";
import { getOpenAIClientOrThrow } from "@/lib/ai/openaiClient";
import { estimateTokens } from "@/lib/finetune/datasetBuilder";

const MODEL = "gpt-4o-mini-2024-07-18";
const dataDir = join(process.cwd(), "scripts", "finetune", "data");

function estimateCost(jsonlPath: string, epochs = 3): { examples: number; tokens: number; costUSD: number } {
  const lines = readFileSync(jsonlPath, "utf8").trim().split("\n").filter(Boolean);
  let tokens = 0;
  for (const line of lines) {
    const obj = JSON.parse(line) as { messages: { content: string }[] };
    tokens += obj.messages.reduce((s, m) => s + estimateTokens(m.content), 0);
  }
  return { examples: lines.length, tokens, costUSD: (tokens / 1_000_000) * 3.0 * epochs };
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const trainPath = join(dataDir, "sft-train.jsonl");

  const est = estimateCost(trainPath);
  console.log("=== fine-tune job (gpt-4o-mini) ===");
  console.log(`training file: ${trainPath}`);
  console.log(`examples: ${est.examples} | est. train tokens: ${est.tokens.toLocaleString()}`);
  console.log(`ESTIMATED TRAINING COST (3 epochs): $${est.costUSD.toFixed(2)}`);

  if (!confirm) {
    console.log("\nDRY RUN - no job submitted, no money spent.");
    console.log("Re-run with --confirm to actually start training.");
    return;
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    console.error("OPENAI_API_KEY not set.");
    process.exit(1);
  }

  const client = getOpenAIClientOrThrow();
  console.log("\nUploading training file...");
  const file = await client.files.create({
    file: createReadStream(trainPath),
    purpose: "fine-tune",
  });
  console.log(`file id: ${file.id}`);

  console.log("Creating fine-tuning job...");
  const job = await client.fineTuning.jobs.create({ training_file: file.id, model: MODEL });
  console.log(`job id: ${job.id} (status: ${job.status})`);

  // Poll until terminal.
  let current = job;
  while (["validating_files", "queued", "running"].includes(current.status)) {
    await new Promise((r) => setTimeout(r, 20_000));
    current = await client.fineTuning.jobs.retrieve(job.id);
    console.log(`  ...${current.status}`);
  }

  const out = {
    jobId: current.id,
    status: current.status,
    fineTunedModel: current.fine_tuned_model ?? null,
    baseModel: MODEL,
    trainingFile: file.id,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(join(dataDir, "ft-job.json"), JSON.stringify(out, null, 2));
  console.log(`\nDone. status=${current.status} model=${current.fine_tuned_model ?? "n/a"}`);
  console.log(`Next: ... scripts/finetune/eval-compare.ts --ft-model ${current.fine_tuned_model ?? "<model>"}`);
}

main().catch((e) => {
  console.error("submit failed:", e?.message || e);
  process.exit(1);
});
