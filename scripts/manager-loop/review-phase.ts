// scripts/manager-loop/review-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getPhaseDetail } from "@/lib/autonomous/missionLoop/missionRepository";
import { evaluateAcceptanceCriteria } from "@/lib/autonomous/missionLoop/gateEvaluation";

export async function main(argv: string[], prisma: PrismaClient): Promise<{ readyToAccept: boolean }> {
  const phaseId = argv[0];
  if (!phaseId) throw new Error("Usage: review-phase.ts <phaseId>");
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const requiredIncomplete = phase.checklist.filter(
    (item) => item.required && item.status !== "DONE" && item.status !== "SKIPPED",
  );
  const gate = await evaluateAcceptanceCriteria(phase.acceptanceCriteria, prisma);
  console.log(`Phase ${phaseId} (${phase.title}) - status ${phase.status}`);
  console.log(`Required checklist items incomplete: ${requiredIncomplete.length}`);
  for (const item of requiredIncomplete) console.log(`  - ${item.label}`);
  console.log("Acceptance criteria:");
  for (const result of gate.results) console.log(`  - ${result.passed ? "PASS" : "FAIL"}: ${result.detail}`);
  const readyToAccept = phase.status === "VERIFYING" && requiredIncomplete.length === 0 && gate.passed;
  console.log(readyToAccept ? "READY TO ACCEPT" : "NOT READY");
  return { readyToAccept };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(process.argv.slice(2), prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
