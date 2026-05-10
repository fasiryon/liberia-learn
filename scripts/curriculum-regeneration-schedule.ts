import { config } from "dotenv";
import { runCurriculumRegenerationScheduler } from "@/lib/curriculum/regenerationScheduler";

config({ path: ".env.local" });
config();

runCurriculumRegenerationScheduler()
  .then((result) => {
    console.log(JSON.stringify({ action: "curriculum_regeneration_schedule", ...result }, null, 2));
  })
  .catch((error) => {
    console.error("[CURRICULUM_REGEN_SCHEDULE] failed", error);
    process.exitCode = 1;
  });

