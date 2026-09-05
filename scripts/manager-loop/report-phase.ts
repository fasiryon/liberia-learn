if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  getPhaseDetail,
  transitionPhase,
  updateChecklistItem,
  writeCheckpoint,
} from "@/lib/autonomous/missionLoop/missionRepository";
import type { ChecklistItemStatus, PhaseStatus } from "@/lib/autonomous/missionLoop/types";

type EvidenceFile = {
  checklist?: Array<{ itemId: string; status: ChecklistItemStatus; evidenceRef?: unknown }>;
  checkpointKey: string;
  state?: unknown;
  evidenceRefs?: unknown;
  blockedReason?: string;
};

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
  const status = args.get("status") as PhaseStatus | undefined;
  const evidencePath = args.get("evidence");
  if (!phaseId || !status || !evidencePath) {
    throw new Error("Usage: report-phase.ts <phaseId> --status VERIFYING|BLOCKED --evidence <path-to-json>");
  }
  if (status !== "VERIFYING" && status !== "BLOCKED") {
    throw new Error(`report-phase.ts may only set VERIFYING or BLOCKED, got ${status}`);
  }
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as EvidenceFile;
  for (const item of evidence.checklist ?? []) {
    await updateChecklistItem(item.itemId, item.status, item.evidenceRef, prisma);
  }
  await writeCheckpoint(
    {
      phaseId,
      workflowRunId: phase.workflowRunId,
      checkpointKey: evidence.checkpointKey,
      state: evidence.state,
      evidenceRefs: evidence.evidenceRefs,
    },
    prisma,
  );
  await transitionPhase(
    phaseId,
    status,
    status === "BLOCKED" ? { blockedReason: evidence.blockedReason ?? "blocked" } : {},
    prisma,
  );
  console.log(`Phase ${phaseId} reported as ${status}.`);
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
