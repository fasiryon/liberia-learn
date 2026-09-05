if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { getMissionDetail, getPhaseDetail, transitionPhase } from "@/lib/autonomous/missionLoop/missionRepository";
import type { MissionDetail, PhaseDetail } from "@/lib/autonomous/missionLoop/types";

const GOVERNING_AUTHORITIES = [
  "governedMeasurement (lib/measurement/governedMeasurement.ts)",
  "controlledExperiment (lib/experiments/controlledExperiment.ts)",
  "qualityOperations (lib/experiments/qualityOperations.ts)",
  "releaseGate (lib/quality/releaseGate.ts)",
  "calibration (lib/quality/calibration.ts)",
  "fixtureRegistry (lib/quality/fixtureRegistry.ts)",
  "reviewTasks (lib/quality/reviewTasks.ts)",
  "RBAC, tenant isolation, audit logging, cost controls (never weaken to pass a gate)",
];

function renderBrief(mission: MissionDetail, phase: PhaseDetail): string {
  const lines: string[] = [];
  lines.push(`=== Phase brief: ${phase.title} ===`);
  lines.push(`Mission objective: ${mission.objective}`);
  if (mission.scope) lines.push(`Mission scope: ${JSON.stringify(mission.scope)}`);
  if (mission.constraints) lines.push(`Mission constraints: ${JSON.stringify(mission.constraints)}`);
  lines.push(`Phase objective: ${phase.objective}`);
  lines.push(`Depends on phases: ${phase.dependsOnPhaseIds.length ? phase.dependsOnPhaseIds.join(", ") : "none"}`);
  lines.push("Acceptance criteria:");
  for (const criterion of phase.acceptanceCriteria) lines.push(`  - ${JSON.stringify(criterion)}`);
  lines.push("Checklist:");
  for (const item of phase.checklist) {
    lines.push(`  - [${item.status}] ${item.label}${item.required ? "" : " (optional)"}`);
  }
  lines.push("Governing authorities (never bypass, never self-authorize around a blocking result):");
  for (const authority of GOVERNING_AUTHORITIES) lines.push(`  - ${authority}`);
  lines.push("");
  lines.push("Complete this phase completely and extremely well. Work autonomously until every");
  lines.push("required checklist item and acceptance criterion is satisfied. Stay within this");
  lines.push("phase's scope unless another change is strictly required to satisfy it. When ready,");
  lines.push(`run: tsx scripts/manager-loop/report-phase.ts ${phase.id} --status VERIFYING --evidence <path-to-json>`);
  return lines.join("\n");
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const phaseId = argv[0];
  if (!phaseId) throw new Error("Usage: dispatch-phase.ts <phaseId>");
  const phase = await getPhaseDetail(phaseId, prisma);
  if (!phase) throw new Error(`Phase not found: ${phaseId}`);
  const mission = await getMissionDetail(phase.workflowRunId, prisma);
  if (!mission) throw new Error(`Mission not found: ${phase.workflowRunId}`);
  if (phase.status === "NOT_STARTED") {
    await transitionPhase(phaseId, "IN_PROGRESS", {}, prisma);
  }
  console.log(renderBrief(mission, phase));
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
