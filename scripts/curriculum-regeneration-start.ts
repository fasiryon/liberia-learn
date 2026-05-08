import { config } from "dotenv";
import { createCurriculumRegenerationRun } from "@/lib/curriculum/regenerationQueue";

config({ path: ".env.local" });
config();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readNumberArg(flag: string) {
  const value = readArg(flag);
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const result = await createCurriculumRegenerationRun({
    dryRun,
    gradeLevel: readNumberArg("--grade") ?? readNumberArg("--grade-level"),
    subject: readArg("--subject"),
    limit: readNumberArg("--limit") ?? (dryRun ? 23 : undefined),
    requestedBy: readArg("--requested-by") ?? "script",
    provider: readArg("--provider"),
  });

  console.log(JSON.stringify({
    action: dryRun ? "curriculum_regeneration_dry_run" : "curriculum_regeneration_start",
    databaseWrites: !dryRun,
    queueWrites: !dryRun,
    ...result,
  }, null, 2));
}

main().catch((error) => {
  console.error("[CURRICULUM_REGEN_START] failed", error);
  process.exitCode = 1;
});
