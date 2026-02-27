// scripts/resolve-intervention-outcomes.ts
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/resolve-intervention-outcomes.ts

import { PrismaClient } from "@prisma/client";
import { isInterventionOutcomesEnabled } from "../lib/serverFlags";
import { resolveInterventionOutcomesBatch } from "../lib/metrics/impact/interventionOutcomeResolver";

const prisma = new PrismaClient();

async function main() {
  if (!isInterventionOutcomesEnabled()) {
    console.log("[intervention-outcomes] disabled (ENABLE_INTERVENTION_OUTCOMES=false)");
    return;
  }

  const result = await resolveInterventionOutcomesBatch({ prisma });
  console.log(
    `[intervention-outcomes] scanned=${result.scanned} resolved=${result.resolved} skipped=${result.skipped} cutoff=${result.cutoff.toISOString()}`
  );
}

main()
  .catch((err) => {
    console.error("[intervention-outcomes] failed", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

