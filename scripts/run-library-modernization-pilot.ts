/**
 * Runs the Library Modernization pipeline for the pilot batch, then queues each ready candidate for
 * independent review in the ledger. Offline: reads the local read-only extract; never touches a database.
 *
 *   npx tsx scripts/run-library-modernization-pilot.ts [pilot-key ...]
 *
 * Resumable and idempotent: unchanged lessons are skipped stage by stage and no duplicate ledger events are
 * appended. A changed candidate under an existing version is refused (bump candidateVersion).
 */
import fs from "fs";
import path from "path";
import { loadLibraryExtract } from "@/lib/curriculum/modernization/extract";
import { buildLibraryAuditContext } from "@/lib/curriculum/modernization/legacyAudit";
import { appendEvents, readLedgerFile, writeLedgerFile } from "@/lib/curriculum/modernization/ledger";
import { digest, LEDGER_FILE } from "@/lib/curriculum/modernization/build";
import { DEFAULT_BUDGET, runModernizationPipeline, type BudgetState } from "@/lib/curriculum/modernization/pipeline";
import { PILOT_DIR, PILOT_LESSONS, pilotAuthor } from "@/lib/curriculum/modernization/pilot";

function main() {
  const only = process.argv.slice(2);
  const { manifest, records } = loadLibraryExtract();
  const context = buildLibraryAuditContext(records);
  let ledger = readLedgerFile(LEDGER_FILE);
  const budget: BudgetState = { authoringCalls: 0, tokens: 0 };
  const summary = [];
  for (const lesson of PILOT_LESSONS.filter((entry) => !only.length || only.includes(entry.key))) {
    const legacy = records.find((record) => record.contentId === lesson.contentId);
    if (!legacy) throw new Error(`pilot lesson not in extract: ${lesson.contentId}`);
    const state = ledger.lessons.get(lesson.contentId);
    const result = runModernizationPipeline({
      contentId: lesson.contentId, legacy, auditContext: context, ledgerLive: state?.live ?? null, author: pilotAuthor(lesson.key),
      outDir: path.join(PILOT_DIR, lesson.key), budget: DEFAULT_BUDGET, budgetState: budget,
      at: new Date(manifest.capturedAt).toISOString(), pipelineRunId: `pilot-v1:${lesson.key}`,
    });
    // Queue only what the ledger does not already hold for this exact candidate hash.
    const current = ledger.lessons.get(lesson.contentId);
    const fresh = result.ledgerEvents.filter((event) => {
      if (event.body.type === "WORK_STARTED") return !current?.work || current.work.legacyContentHash !== event.body.legacyContentHash;
      if (event.body.type === "CANDIDATE_REGISTERED") return current?.candidate?.candidateHash !== event.body.candidateHash;
      if (event.body.type === "REVIEW_REQUESTED") return !(current?.candidate?.candidateHash === event.body.candidateHash && current.reviewRequested);
      return true;
    });
    ledger = appendEvents(ledger, fresh);
    // Proposed legacy mapping plan: which live rows the candidate would stand in for, and what never moves.
    const rows = [lesson.contentId, ...(context.duplicateBodies.get(lesson.contentId) ?? [])].map((contentId) => {
      const record = records.find((entry) => entry.contentId === contentId)!;
      return { contentId, legacyRevisionId: record.revision!.id, legacyContentHash: record.revision!.contentHash, status: record.row.status, dependencies: record.dependencies,
        relation: contentId === lesson.contentId ? "AUDITED_SOURCE" : "IDENTICAL_LEARNER_TEXT" };
    });
    const plan = {
      planVersion: "liberialearn-legacy-mapping-plan/1.0.0", status: "PROPOSED_UNAUTHORIZED", candidate: { id: result.candidateId, version: result.candidateVersion, sha256: result.candidateHash },
      legacyRows: rows,
      historyPolicy: "PRESERVE_HISTORICAL_PINS",
      rules: [
        "Every existing ScheduledWork, StudentProgress, LearningEvent, submission, tutor conversation and lesson plan keeps pointing at the legacy contentId and revision it was created against; nothing is repointed.",
        "Published report cards and transcripts are not recomputed or relabelled.",
        "Legacy rows are not deleted. On release they leave the learner catalogue for new assignment only, and resolve for history forever.",
        "New assignments after release use the released revision only when the class teacher opts in (futureAssignments: TEACHER_OPT_IN) during the pilot.",
        "Mastery already recorded from the legacy lesson stays as recorded; the learning authority decides separately whether later evidence from the new lesson is admitted.",
      ],
      futureAssignments: "TEACHER_OPT_IN",
      requires: ["Human independent ACCEPT on ACADEMIC and ASSESSMENT scopes for this candidate hash", "CURRICULUM_AUTHORITY RELEASE_AUTHORIZED citing this plan's digest", "A governed migration for any catalogue-visibility change (not applied here)"],
    };
    fs.writeFileSync(path.join(PILOT_DIR, lesson.key, "legacy-mapping-plan.json"), `${JSON.stringify({ ...plan, planDigest: digest(plan) }, null, 1)}\n`);
    summary.push({ key: lesson.key, status: result.status, candidateHash: result.candidateHash, manifestHash: result.manifestHash, appended: fresh.length,
      failed: result.checks.filter((check) => check.blocking && !check.passed).map((check) => `${check.id}: ${check.detail}`) });
  }
  writeLedgerFile(LEDGER_FILE, ledger);
  console.log(JSON.stringify({ budget, ledgerHead: ledger.head, summary }, null, 2));
}

main();
