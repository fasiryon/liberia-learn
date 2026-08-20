import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { prisma } from "../lib/db";
import {
  backfillCurriculumProvenance,
  verifyCurriculumProvenanceBackfill,
  type BackfillDistribution,
} from "../lib/curriculum/provenance/backfill";

const PRODUCTION_PROJECT_REF = "bnphuinpvgpmebcsvmsp";
const STAGING_PROJECT_REF = "yonpfzjczoffhrgibxkz";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function assertProduction(execute: boolean): void {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (process.env.P2A_PRODUCTION_PROJECT_REF !== PRODUCTION_PROJECT_REF) {
    throw new Error("P2-A production backfill STOP: explicit production identity mismatch");
  }
  if (!databaseUrl.includes(PRODUCTION_PROJECT_REF) || databaseUrl.includes(STAGING_PROJECT_REF)) {
    throw new Error("P2-A production backfill STOP: database URL is not positively production");
  }
  if (execute && process.env.P2A_PRODUCTION_BACKFILL_EXECUTE !== "AUTHORIZED") {
    throw new Error("P2-A production backfill STOP: execute authorization is missing");
  }
}

async function curriculumBodyDigest(): Promise<string> {
  const rows = await prisma.curriculumContent.findMany({
    orderBy: { id: "asc" },
    select: { id: true, payload: true, title: true, status: true, version: true },
  });
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function main() {
  const execute = process.argv.includes("--execute");
  assertProduction(execute);
  const batchSize = Math.max(1, Math.min(Number(arg("batch-size") ?? 25), 100));
  const maxBatches = Math.max(1, Number(arg("max-batches") ?? Number.MAX_SAFE_INTEGER));
  const backfillRunId = arg("run-id") ?? `p2a-production-${randomUUID()}`;
  const aggregate: BackfillDistribution = { VERIFIED: 0, PARTIAL: 0, UNVERIFIED: 0 };
  const failures: Array<{ contentId: string; error: string }> = [];
  const bodyDigestBefore = await curriculumBodyDigest();
  let cursor: string | null = arg("cursor") ?? null;
  let scanned = 0;
  let created = 0;
  let alreadyPresent = 0;
  let batches = 0;

  while (batches < maxBatches) {
    const result = await backfillCurriculumProvenance({
      dryRun: !execute,
      backfillRunId,
      batchSize,
      cursor,
    });
    batches += 1;
    scanned += result.scanned;
    created += result.created;
    alreadyPresent += result.alreadyPresent;
    failures.push(...result.failures);
    for (const key of ["VERIFIED", "PARTIAL", "UNVERIFIED"] as const) {
      aggregate[key] += result.distribution[key];
    }
    if (result.scanned < batchSize || !result.nextCursor) {
      cursor = null;
      break;
    }
    cursor = result.nextCursor;
  }

  const bodyDigestAfter = await curriculumBodyDigest();
  if (bodyDigestBefore !== bodyDigestAfter) {
    throw new Error("P2-A production backfill STOP: curriculum body digest changed");
  }
  if (failures.length / Math.max(1, scanned) > 0.01) {
    throw new Error("P2-A production backfill STOP: technical failure rate exceeds 1 percent");
  }
  const verification = execute ? await verifyCurriculumProvenanceBackfill() : null;
  console.log(JSON.stringify({
    dryRun: !execute,
    backfillRunId,
    batchSize,
    batches,
    scanned,
    created,
    alreadyPresent,
    distribution: aggregate,
    failures,
    nextCursor: cursor,
    curriculumBodyDigest: bodyDigestAfter,
    verification,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
