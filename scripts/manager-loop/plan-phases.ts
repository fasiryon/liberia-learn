if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { planPhases } from "@/lib/autonomous/missionLoop/missionRepository";
import type { PhaseInput } from "@/lib/autonomous/missionLoop/types";

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      args.set(token.slice(2), argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

export async function main(argv: string[], prisma: PrismaClient): Promise<void> {
  const args = parseArgs(argv);
  const missionId = args.get("mission");
  const phasesFile = args.get("phases-file");
  if (!missionId || !phasesFile) {
    throw new Error("Usage: plan-phases.ts --mission <id> --phases-file <path-to-json>");
  }
  const phases = JSON.parse(readFileSync(phasesFile, "utf8")) as PhaseInput[];
  const result = await planPhases(missionId, phases, prisma);
  console.log(`Created ${result.phaseIds.length} phase(s): ${result.phaseIds.join(", ")}`);
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
