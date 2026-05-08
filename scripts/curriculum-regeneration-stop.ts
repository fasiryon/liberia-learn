import { config } from "dotenv";
import { stopCurriculumRegenerationRun } from "@/lib/curriculum/regenerationQueue";

config({ path: ".env.local" });
config();

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const runId = readArg("--run-id") ?? process.argv[2];
  if (!runId) throw new Error("--run-id is required");
  const reason = readArg("--reason") ?? "Stopped by operator script.";
  await stopCurriculumRegenerationRun(runId, reason);
  console.log(JSON.stringify({ action: "curriculum_regeneration_stop", runId, reason }, null, 2));
}

main().catch((error) => {
  console.error("[CURRICULUM_REGEN_STOP] failed", error);
  process.exitCode = 1;
});
