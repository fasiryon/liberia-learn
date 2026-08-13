import { randomUUID } from "crypto";
import { backfillCurriculumProvenance, verifyCurriculumProvenanceBackfill } from "../lib/curriculum/provenance/backfill";
import { APPROVED_STAGING_SUPABASE_PROJECT_REF } from "./p2a-staging-preflight";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  if (process.env.STAGING_SUPABASE_PROJECT_REF !== APPROVED_STAGING_SUPABASE_PROJECT_REF) {
    throw new Error("P2-A backfill STOP: staging project identity mismatch");
  }
  if ((process.env.DATABASE_URL ?? "").includes("bnphuinpvgpmebcsvmsp")) {
    throw new Error("P2-A backfill STOP: production identity is prohibited");
  }
  const execute = process.argv.includes("--execute");
  const backfillRunId = arg("run-id") ?? `p2a-staging-${randomUUID()}`;
  const result = await backfillCurriculumProvenance({
    dryRun: !execute,
    backfillRunId,
    batchSize: Number(arg("batch-size") ?? 25),
    cursor: arg("cursor") ?? null,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length / Math.max(1, result.scanned) > 0.01) {
    throw new Error("P2-A backfill STOP: technical failure rate exceeds 1 percent");
  }
  if (execute) console.log(JSON.stringify(await verifyCurriculumProvenanceBackfill(), null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prismaDisconnect());

async function prismaDisconnect() {
  const { prisma } = await import("../lib/db");
  await prisma.$disconnect();
}
