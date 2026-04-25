import { generateNationalBatch, auditNationalCoverage } from "../lib/curriculum/nationalFactory";

async function main() {
  const action = process.argv[2] ?? "dry_run";
  const batchSize = Number(process.argv[3] ?? "50");
  const gradeArg = process.argv[4] ? Number(process.argv[4]) : undefined;
  const subjectArg = process.argv[5] ?? undefined;
  const isDryRun = action !== "generate";

  console.log(`\n=== National Factory: action=${action}, batchSize=${batchSize}, grade=${gradeArg ?? "all"}, subject=${subjectArg ?? "all"} ===\n`);

  const r = await generateNationalBatch({
    batchSize,
    dryRun: isDryRun,
    prioritizeCritical: true,
    grade: gradeArg,
    subject: subjectArg,
    sessionId: `prod-${action}-${Date.now()}`,
  });

  console.log("totalAttempted:", r.totalAttempted);
  console.log("totalSaved:    ", r.totalSaved);
  console.log("totalSkipped:  ", r.totalSkipped);
  console.log("totalFailed:   ", r.totalFailed);
  console.log("dryRun:        ", isDryRun);
  console.log("\nBatches:");
  for (const b of r.batches) {
    const outcomes = b.items.reduce((acc, it) => {
      acc[it.outcome] = (acc[it.outcome] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`  G${b.grade} ${b.subject}: attempted=${b.attempted} saved=${b.passed} skipped=${b.skippedDuplicates} failed=${b.failed}`, outcomes);
  }

  if (!isDryRun && r.totalSaved > 0) {
    console.log("\n=== Post-generation audit ===");
    const audit = await auditNationalCoverage();
    const critical = audit.entries.filter(e => e.severity === "critical");
    const severe   = audit.entries.filter(e => e.severity === "severe");
    console.log("Critical gaps after generation:", critical.length);
    for (const e of critical) console.log("  ", `G${e.grade} ${e.subject}`, e.approved, "approved");
    console.log("Severe gaps after generation:", severe.length);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
