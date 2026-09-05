// scripts/manager-loop/reject-phase.ts
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getPhaseDetail, recordPhaseDecision, transitionPhase } from "@/lib/autonomous/missionLoop/missionRepository";

function parseArgs(argv: string[]): { args: Map<string, string>; positionals: string[] } {
  const args = new Map<string, string>();
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      args.set(token.slice(2), argv[i + 1]);
      i += 1;
    } else {
      positionals.push(token);
    }
  }
  return { args, positionals };
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const { args, positionals } = parseArgs(argv);
  const phaseId = positionals[0];
  const reason = args.get("reason");
  if (!phaseId || !reason) throw new Error('Usage: reject-phase.ts <phaseId> --reason "..."');
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  if (phase.status !== "VERIFYING") {
    throw new Error(`Phase ${phaseId} is ${phase.status}, not VERIFYING - cannot reject`);
  }
  await recordPhaseDecision({ phaseId, workflowRunId: phase.workflowRunId, outcome: "REJECT", reason }, prisma);
  await transitionPhase(phaseId, "IN_PROGRESS", {}, prisma);
  console.log(`Phase ${phaseId} REJECTED (${reason}) and returned to IN_PROGRESS.`);
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
