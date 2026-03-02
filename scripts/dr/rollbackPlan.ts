#!/usr/bin/env npx ts-node
/**
 * scripts/dr/rollbackPlan.ts — Block 29
 * LiberiaLearn Rollback Plan Script
 *
 * Prints the step-by-step rollback runbook for a given target block.
 * For automated use, exports rollback step definitions and a validator.
 *
 * Usage:
 *   npx ts-node scripts/dr/rollbackPlan.ts --block 28
 *   npx ts-node scripts/dr/rollbackPlan.ts --list
 */

export interface RollbackStep {
  order: number;
  category: "schema" | "flag" | "code" | "cache" | "verify";
  action: string;
  command?: string;
  detail?: string;
  reversible: boolean;
}

export interface BlockRollback {
  block: number;
  title: string;
  safeToRollback: boolean;
  dataRisk: "none" | "low" | "medium" | "high";
  steps: RollbackStep[];
}

// ─── Block rollback definitions ───────────────────────────────────────────────

export const ROLLBACK_PLANS: BlockRollback[] = [
  {
    block: 28,
    title: "MOE Access Portal (MOE_OFFICIAL role + 5 national oversight routes)",
    safeToRollback: true,
    dataRisk: "low",
    steps: [
      {
        order: 1,
        category: "flag",
        action: "Disable MOE portal feature flag",
        command: "ENABLE_MOE_PORTAL=false  # set in environment / Vercel dashboard",
        detail: "Immediately gates all 5 new routes with 404 without a code deploy.",
        reversible: true,
      },
      {
        order: 2,
        category: "code",
        action: "Revert Block 28 commit",
        command: "git revert 708c403 --no-edit",
        detail: "Removes 5 route files, test file, and auth.ts role union change.",
        reversible: true,
      },
      {
        order: 3,
        category: "schema",
        action: "Note: MOE_OFFICIAL Role enum value cannot be dropped with IF NOT EXISTS guard",
        detail:
          "PostgreSQL does not support DROP VALUE from an enum. " +
          "The MOE_OFFICIAL value is safe to leave in the DB — it will be unused. " +
          "No data migration is required as no users will have been assigned this role " +
          "unless the seed/admin tooling was run with it explicitly.",
        reversible: false,
      },
      {
        order: 4,
        category: "verify",
        action: "Run health check to confirm platform is operational",
        command: "npx ts-node scripts/dr/healthCheck.ts",
        detail: "Should return overall: healthy.",
        reversible: true,
      },
      {
        order: 5,
        category: "verify",
        action: "Run full test suite",
        command: "npx vitest run",
        detail: "All pre-Block 28 tests should pass (871 baseline).",
        reversible: true,
      },
    ],
  },
  {
    block: 27,
    title: "Load Acceptance Harness (test-only — no production schema changes)",
    safeToRollback: true,
    dataRisk: "none",
    steps: [
      {
        order: 1,
        category: "code",
        action: "Delete Block 27 test files (harness is test-only)",
        command:
          "git revert 8db0165 --no-edit  # removes loadHarness.ts, concurrencyGuards.test.ts, nationalScaleSmoke.test.ts",
        detail: "No schema changes, no route changes, no flag changes in Block 27.",
        reversible: true,
      },
      {
        order: 2,
        category: "verify",
        action: "Run full test suite",
        command: "npx vitest run",
        detail: "Should return 871 tests (Block 27 harness tests removed).",
        reversible: true,
      },
    ],
  },
  {
    block: 26,
    title: "Performance Hardening (parallelized queries + 3 composite indexes)",
    safeToRollback: true,
    dataRisk: "none",
    steps: [
      {
        order: 1,
        category: "code",
        action: "Revert Block 26 query optimizations",
        command: "git revert <block-26-commit> --no-edit",
        detail: "Reverts teacher schedule, student work, and trendAggregator parallelizations.",
        reversible: true,
      },
      {
        order: 2,
        category: "schema",
        action: "Drop Block 26 composite indexes (safe — indexes are non-destructive)",
        command:
          "DROP INDEX CONCURRENTLY IF EXISTS idx_enrollment_student_class;\n" +
          "DROP INDEX CONCURRENTLY IF EXISTS idx_meeting_class_date;\n" +
          "DROP INDEX CONCURRENTLY IF EXISTS idx_submission_student_hw;",
        detail:
          "Dropping indexes is safe and reversible. Query performance reverts to pre-Block 26 " +
          "but data integrity is unaffected.",
        reversible: true,
      },
      {
        order: 3,
        category: "verify",
        action: "Run health check + full test suite",
        command: "npx ts-node scripts/dr/healthCheck.ts && npx vitest run",
        reversible: true,
      },
    ],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getRollbackPlan(block: number): BlockRollback | undefined {
  return ROLLBACK_PLANS.find((p) => p.block === block);
}

export function listRollbackBlocks(): Array<{ block: number; title: string; dataRisk: string }> {
  return ROLLBACK_PLANS.map((p) => ({
    block: p.block,
    title: p.title,
    dataRisk: p.dataRisk,
  }));
}

/**
 * Validates that a rollback plan is safe to execute.
 * Returns warnings if any irreversible steps exist.
 */
export function validateRollback(block: number): {
  safe: boolean;
  irreversibleSteps: RollbackStep[];
  dataRisk: string;
} {
  const plan = getRollbackPlan(block);
  if (!plan) {
    return { safe: false, irreversibleSteps: [], dataRisk: "unknown" };
  }
  const irreversible = plan.steps.filter((s) => !s.reversible);
  return {
    safe: plan.safeToRollback,
    irreversibleSteps: irreversible,
    dataRisk: plan.dataRisk,
  };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

function printPlan(plan: BlockRollback) {
  console.log(`\nRollback Plan — Block ${plan.block}: ${plan.title}`);
  console.log(`Data risk: ${plan.dataRisk.toUpperCase()} | Safe to rollback: ${plan.safeToRollback}\n`);
  for (const step of plan.steps) {
    const reversible = step.reversible ? "" : " [IRREVERSIBLE]";
    console.log(`Step ${step.order} [${step.category.toUpperCase()}]${reversible}: ${step.action}`);
    if (step.command) console.log(`  $ ${step.command}`);
    if (step.detail) console.log(`  Note: ${step.detail}`);
    console.log();
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    console.log("\nAvailable rollback plans:");
    for (const entry of listRollbackBlocks()) {
      console.log(`  Block ${entry.block}: ${entry.title} (data risk: ${entry.dataRisk})`);
    }
    console.log();
    return;
  }

  const blockIdx = args.indexOf("--block");
  if (blockIdx >= 0 && args[blockIdx + 1]) {
    const blockNum = parseInt(args[blockIdx + 1], 10);
    const plan = getRollbackPlan(blockNum);
    if (!plan) {
      console.error(`No rollback plan defined for Block ${blockNum}`);
      process.exit(1);
    }
    printPlan(plan);
    return;
  }

  console.log("Usage:");
  console.log("  npx ts-node scripts/dr/rollbackPlan.ts --list");
  console.log("  npx ts-node scripts/dr/rollbackPlan.ts --block <number>");
}

if (require.main === module) {
  main();
}
