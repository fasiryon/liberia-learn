// scripts/manager-loop/accept-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getPhaseDetail, recordPhaseDecision, transitionPhase } from "@/lib/autonomous/missionLoop/missionRepository";
import { evaluateAcceptanceCriteria } from "@/lib/autonomous/missionLoop/gateEvaluation";

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const phaseId = argv[0];
  if (!phaseId) throw new Error("Usage: accept-phase.ts <phaseId>");
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  if (phase.status !== "VERIFYING") {
    throw new Error(`Phase ${phaseId} is ${phase.status}, not VERIFYING - cannot accept`);
  }
  const requiredIncomplete = phase.checklist.filter(
    (item) => item.required && item.status !== "DONE" && item.status !== "SKIPPED",
  );
  if (requiredIncomplete.length > 0) {
    throw new Error(`Cannot accept: ${requiredIncomplete.length} required checklist item(s) incomplete`);
  }
  const gate = await evaluateAcceptanceCriteria(phase.acceptanceCriteria, prisma);
  if (!gate.passed) {
    throw new Error(
      `Cannot accept: acceptance criteria failed - ${gate.results
        .filter((result) => !result.passed)
        .map((result) => result.detail)
        .join("; ")}`,
    );
  }
  await recordPhaseDecision(
    { phaseId, workflowRunId: phase.workflowRunId, outcome: "ACCEPT", evidenceRefs: gate.results },
    prisma,
  );
  await transitionPhase(phaseId, "COMPLETE", {}, prisma);
  console.log(`Phase ${phaseId} ACCEPTED and marked COMPLETE.`);
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
