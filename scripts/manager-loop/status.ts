if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getMissionDetail, listOpenMissions } from "@/lib/autonomous/missionLoop/missionRepository";
import type { MissionDetail } from "@/lib/autonomous/missionLoop/types";

function findNextAction(mission: MissionDetail): string {
  const blockedPhase = mission.phases.find((phase) => phase.status === "BLOCKED");
  if (blockedPhase) return `Phase "${blockedPhase.title}" is BLOCKED: ${blockedPhase.blockedReason ?? "no reason recorded"}`;
  const verifyingPhase = mission.phases.find((phase) => phase.status === "VERIFYING");
  if (verifyingPhase) return `Phase "${verifyingPhase.title}" is awaiting Manager review: tsx scripts/manager-loop/review-phase.ts ${verifyingPhase.id}`;
  const inProgressPhase = mission.phases.find((phase) => phase.status === "IN_PROGRESS");
  if (inProgressPhase) return `Phase "${inProgressPhase.title}" is in progress: tsx scripts/manager-loop/dispatch-phase.ts ${inProgressPhase.id}`;
  const nextPhase = mission.phases.find((phase) => phase.status === "NOT_STARTED");
  if (nextPhase) return `Next: tsx scripts/manager-loop/dispatch-phase.ts ${nextPhase.id} ("${nextPhase.title}")`;
  if (mission.status === "COMPLETE") return "Mission complete.";
  return "No phase is ready; check dependsOnPhaseIds for the remaining NOT_STARTED phases.";
}

function formatMission(mission: MissionDetail): string {
  const lines: string[] = [];
  lines.push(`Mission ${mission.id}: ${mission.objective}`);
  lines.push(`Status: ${mission.status}`);
  for (const phase of mission.phases) {
    lines.push(
      `  Phase ${phase.sequence} [${phase.status}] ${phase.title} (attempt ${phase.attempt}, last progress ${phase.lastProgressAt?.toISOString() ?? "never"})`,
    );
    for (const item of phase.checklist) {
      lines.push(`    - [${item.status}] ${item.label}`);
    }
  }
  lines.push(`Next action: ${findNextAction(mission)}`);
  return lines.join("\n");
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const asJson = argv.includes("--json");
  const missionId = argv.find((token) => !token.startsWith("--"));
  if (!missionId) {
    const missions = await listOpenMissions(prisma);
    console.log(
      asJson
        ? JSON.stringify(missions, null, 2)
        : missions.map((mission) => `${mission.id} [${mission.status}] ${mission.objective}`).join("\n"),
    );
    return;
  }
  const mission = await getMissionDetail(missionId, prisma);
  if (!mission) throw new Error(`Mission not found: ${missionId}`);
  console.log(asJson ? JSON.stringify(mission, null, 2) : formatMission(mission));
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
