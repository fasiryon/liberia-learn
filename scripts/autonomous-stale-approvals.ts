import { processStaleApprovals } from "@/lib/autonomous/actions/staleApprovalWorker";

async function main() {
  const result = await processStaleApprovals({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify({ job: "autonomous.stale-approvals", ...result }));
}

main().catch((error) => {
  console.error("[autonomous.stale-approvals] failed", error);
  process.exit(1);
});

