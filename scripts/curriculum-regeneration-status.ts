import { config } from "dotenv";
import { getCurriculumRegenerationStatus } from "@/lib/curriculum/regenerationQueue";

config({ path: ".env.local" });
config();

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const runId = readArg("--run-id") ?? process.argv[2];
  if (!runId) throw new Error("--run-id is required");
  const status = await getCurriculumRegenerationStatus(runId);
  console.log(JSON.stringify({ action: "curriculum_regeneration_status", ...status }, null, 2));
}

main().catch((error) => {
  console.error("[CURRICULUM_REGEN_STATUS] failed", error);
  process.exitCode = 1;
});
