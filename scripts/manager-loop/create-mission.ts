if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaClient } from "@prisma/client";
import { createMission } from "@/lib/autonomous/missionLoop/missionRepository";
import type { AcceptanceCriterion } from "@/lib/autonomous/missionLoop/types";

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
  const slug = args.get("slug");
  const objective = args.get("objective");
  if (!slug || !objective) {
    throw new Error(
      'Usage: create-mission.ts --slug <slug> --objective "<text>" [--scope <json>] [--constraints <json>] [--acceptance-criteria <json>]',
    );
  }
  const scope = args.has("scope") ? JSON.parse(args.get("scope")!) : undefined;
  const constraints = args.has("constraints") ? JSON.parse(args.get("constraints")!) : undefined;
  const acceptanceCriteria: AcceptanceCriterion[] | undefined = args.has("acceptance-criteria")
    ? JSON.parse(args.get("acceptance-criteria")!)
    : undefined;
  const result = await createMission({ slug, objective, scope, constraints, acceptanceCriteria }, prisma);
  console.log(`Created mission ${result.id} (workflowType mission.${slug})`);
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
