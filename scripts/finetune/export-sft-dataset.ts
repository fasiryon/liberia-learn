/**
 * Export the SFT dataset from approved lessons.
 *
 * Reads human-approved CurriculumContent (payload.body) from prod using the
 * POOLER (production read, carry-forward rule 3), builds OpenAI chat FT
 * examples, splits train/val, and writes JSONL + a manifest with a training
 * cost estimate. Read-only; touches no production-live table.
 *
 * Run: npx dotenv -e .env.production -- npx tsx scripts/finetune/export-sft-dataset.ts \
 *        [--limit 500] [--grades 4,5,6] [--subjects MATH,SCIENCE] [--val-ratio 0.1]
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import {
  buildDataset,
  splitTrainVal,
  toJsonl,
  estimateFtCostUSD,
  type LessonRecord,
} from "@/lib/finetune/datasetBuilder";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`) || a === `--${name}`);
  if (!hit) return undefined;
  if (hit.includes("=")) return hit.split("=")[1];
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1];
}

async function main() {
  const limit = arg("limit") ? parseInt(arg("limit")!, 10) : undefined;
  const grades = arg("grades")?.split(",").map((g) => parseInt(g, 10));
  const subjects = arg("subjects")?.split(",").map((s) => s.trim().toUpperCase());
  const valRatio = arg("val-ratio") ? parseFloat(arg("val-ratio")!) : 0.1;
  const outDir = join(process.cwd(), "scripts", "finetune", "data");
  mkdirSync(outDir, { recursive: true });

  const prisma = new PrismaClient();
  const p = prisma as unknown as { curriculumContent: { findMany: (a: unknown) => Promise<LessonRecord[]> } };

  const where: Record<string, unknown> = { status: { in: ["published", "APPROVED"] } };
  if (grades) where.grade = { in: grades };
  if (subjects) where.subject = { in: subjects };

  console.log("Reading approved lessons (pooler, read-only)...");
  const lessons = await p.curriculumContent.findMany({
    where,
    select: { contentId: true, title: true, grade: true, subject: true, payload: true },
    ...(limit ? { take: limit } : {}),
    orderBy: { createdAt: "desc" },
  });
  console.log(`Fetched ${lessons.length} approved lessons.`);

  const { examples, skipped } = buildDataset(lessons);
  const { train, val } = splitTrainVal(examples, valRatio, 42);
  const trainCost = estimateFtCostUSD(train, 3);

  writeFileSync(join(outDir, "sft-train.jsonl"), toJsonl(train));
  writeFileSync(join(outDir, "sft-val.jsonl"), toJsonl(val));

  const bySubject: Record<string, number> = {};
  const byGrade: Record<string, number> = {};
  for (const e of examples) {
    bySubject[e.meta.subject] = (bySubject[e.meta.subject] ?? 0) + 1;
    byGrade[String(e.meta.grade)] = (byGrade[String(e.meta.grade)] ?? 0) + 1;
  }
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "CurriculumContent status in [published, APPROVED]",
    filters: { grades: grades ?? "all", subjects: subjects ?? "all", limit: limit ?? "all" },
    counts: { fetched: lessons.length, kept: examples.length, skipped, train: train.length, val: val.length },
    distribution: { bySubject, byGrade },
    trainTokensApprox: train.reduce((s, e) => s + e.meta.tokensApprox, 0),
    estimatedTrainingCostUSD: Number(trainCost.toFixed(2)),
    model: "gpt-4o-mini-2024-07-18",
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("\n=== SFT dataset built ===");
  console.log(`kept ${examples.length} / fetched ${lessons.length} (skipped ${skipped})`);
  console.log(`train ${train.length} | val ${val.length}`);
  console.log(`est. training cost (3 epochs): $${trainCost.toFixed(2)}`);
  console.log(`wrote: ${outDir}/{sft-train.jsonl, sft-val.jsonl, manifest.json}`);
  console.log("\nNext: npx dotenv -e .env.production -- npx tsx scripts/finetune/submit-finetune.ts --confirm");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("export failed:", e?.message || e);
  process.exit(1);
});
