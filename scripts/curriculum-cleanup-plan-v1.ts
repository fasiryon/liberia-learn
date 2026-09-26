/**
 * Curriculum cleanup plan V1 (offline, no database access).
 *
 * Reads artifacts/curriculum-cleanup-v1/snapshot.json (captured read-only by
 * scripts/curriculum-cleanup-snapshot-v1.ts), builds the deterministic plan,
 * validates it by simulated apply + rollback, and writes:
 *   artifacts/curriculum-cleanup-v1/cleanup-plan.json   every action with before-images
 *   artifacts/curriculum-cleanup-v1/CLEANUP_PLAN_V1.md  counts, survivors, rollback plan
 *
 * Exits non-zero when validation fails. This script never mutates production.
 */
import fs from "node:fs";
import path from "node:path";
import { buildCleanupPlan, validateCleanupPlan, type CurriculumSnapshot } from "@/lib/curriculum/cleanup/cleanupPlan";

const DIR = path.resolve("artifacts/curriculum-cleanup-v1");

function main() {
  const snapshot = JSON.parse(fs.readFileSync(path.join(DIR, "snapshot.json"), "utf8")) as CurriculumSnapshot & { unresolvedReferenceRows: Record<string, number> };
  const g4 = JSON.parse(fs.readFileSync(path.join(DIR, "g4-math-live.json"), "utf8"));
  const plan = buildCleanupPlan(snapshot);
  const validation = validateCleanupPlan(plan, snapshot);

  const byPk = new Map(snapshot.contents.map((c) => [c.id, c]));
  const retiredByReason = plan.retainedReferences.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + r.rows }), {});
  const retainedByTable = plan.retainedReferences.reduce<Record<string, number>>((acc, r) => ({ ...acc, [`${r.table}.${r.column}`]: (acc[`${r.table}.${r.column}`] ?? 0) + r.rows }), {});
  const unitActions = plan.actions.filter((a) => a.kind === "REPAIR_UNIT_LINK" || a.kind === "RETAIN_UNIT_KEY");
  const danglingUnitShapes = unitActions.reduce<Record<string, number>>((acc, a) => {
    const shape = "fromUnitId" in a ? a.fromUnitId.replace(/[0-9]+/g, "N").replace(/c[a-z0-9]{20,}/g, "<cuid>") : "?";
    return { ...acc, [shape]: (acc[shape] ?? 0) + 1 };
  }, {});
  const danglingEdgeMissing = plan.actions.reduce<Record<string, number>>((acc, a) => a.kind === "DELETE_DANGLING_PREREQUISITE" ? { ...acc, [a.missing.join("+")]: (acc[a.missing.join("+")] ?? 0) + 1 } : acc, {});

  // Grade 4 Math release bindings vs production (the release is repository code).
  const probe = g4.releaseBindingProbe;
  const g4Release = {
    releaseId: "lr-moe-g4-math-fractions-2026.1",
    references: [
      { ref: "contentBinding ll-g4-math-fractions-equal-parts-2026.1", liveExists: probe.lesson.length > 0, repair: "Founder runs scripts/author-grade4-fractions-authority.ts (human review identity required); not an automated cleanup action" },
      { ref: "learningTargetCode LR-MATH-G4_6-02 (CurriculumLearningTarget)", liveExists: probe.target.length > 0, repair: "No CurriculumLearningTarget rows exist for grade 4 at all; the binding's standard exists. Seed via the governed target workflow after MOE objective review, or treat standardCode as the live anchor" },
      { ref: "standardCode LR-MATH-G4_6-02 (Standard)", liveExists: probe.standard.length > 0, repair: null },
      { ref: "skillId placement-skill-MATH-G4_6 (Skill)", liveExists: probe.skill.length > 0, repair: null },
    ],
  };

  const out = {
    planVersion: plan.planVersion,
    snapshotCapturedAt: plan.snapshotCapturedAt,
    database: plan.database,
    validation,
    counts: plan.counts,
    learnerImpact: plan.learnerImpact,
    retainedReferenceRows: { byReason: retiredByReason, byTable: retainedByTable },
    unresolvedReferenceRowsInSnapshot: snapshot.unresolvedReferenceRows,
    danglingPrerequisiteMissingSide: danglingEdgeMissing,
    danglingUnitKeyShapes: danglingUnitShapes,
    grade4MathRelease: g4Release,
    duplicateGroups: plan.duplicateGroups.map((group) => ({
      ...group,
      survivor: { ...group.survivor, title: byPk.get(group.survivor.contentPk)?.title, status: byPk.get(group.survivor.contentPk)?.status },
      retired: group.retired.map((r) => ({ ...r, status: byPk.get(r.contentPk)?.status })),
    })),
    retainedReferences: plan.retainedReferences,
    actions: plan.actions,
  };
  fs.writeFileSync(path.join(DIR, "cleanup-plan.json"), `${JSON.stringify(out, null, 1)}\n`);

  const c = plan.counts;
  const md = `# Curriculum cleanup plan V1

- **Snapshot:** production \`${plan.database.db}\` read at ${plan.snapshotCapturedAt} (\`SET TRANSACTION READ ONLY\`). Nothing has been written.
- **Plan validation:** ${validation.ok ? "PASS" : "FAIL"}${validation.errors.length ? ` (${validation.errors.join(", ")})` : ""}. Rollback simulation restores the snapshot exactly: **${validation.rollbackRestoresSnapshot ? "yes" : "no"}**.
- **Status:** plan only. Production mutation needs explicit human authorization. See "Execution gate" below.

## Defects before and after (simulated)

| Defect | Before | After plan |
|---|---:|---:|
| Status/payload governance conflicts | ${validation.before.statusPayloadConflicts} | ${validation.after.statusPayloadConflicts} |
| Learner-visible duplicate lesson rows | ${validation.before.duplicateVisibleRows} | ${validation.after.duplicateVisibleRows} |
| Dangling prerequisite edges | ${validation.before.danglingPrerequisites} | ${validation.after.danglingPrerequisites} |
| Orphaned lesson variants | ${validation.before.orphanVariants} | ${validation.after.orphanVariants} |
| Dangling unit links (after: retained on purpose / unaccounted) | ${validation.before.danglingUnitLinks} | ${validation.after.danglingUnitLinks} / ${validation.after.unaccountedUnitLinks} |
| Forward bindings to retired lessons | ${validation.before.referencesToRetiredLessons} | ${validation.after.referencesToRetiredLessons} |

## Actions

| Action | Count | Mechanism |
|---|---:|---|
| SUPERSEDE_DUPLICATE | ${c.SUPERSEDE_DUPLICATE} | Governance event SUPERSEDED (replacement = survivor revision). The row is kept. |
| REPOINT_REFERENCE | ${c.REPOINT_REFERENCE} | Forward bindings only (lesson plans, timetable, teacher assignments, learning path, shares). |
| RETURN_FOR_REVIEW | ${c.RETURN_FOR_REVIEW} | Governance event RETURNED_FOR_REVIEW; status NEEDS_REVIEW. |
| DELETE_DANGLING_PREREQUISITE | ${c.DELETE_DANGLING_PREREQUISITE} | Delete edge; full row kept in plan for restore. |
| REPOINT_PREREQUISITE | ${c.REPOINT_PREREQUISITE} | Edge moves from retired duplicate to survivor. |
| DELETE_DUPLICATE_PREREQUISITE | ${c.DELETE_DUPLICATE_PREREQUISITE} | Self-loop or duplicate after repoint. |
| DELETE_ORPHAN_VARIANT | ${c.DELETE_ORPHAN_VARIANT} | Delete; full row (body included) kept in plan for restore. |
| REPAIR_UNIT_LINK | ${c.REPAIR_UNIT_LINK} | Exactly one unit matches grade + subject + sequence and shares a title word. |
| RETAIN_UNIT_KEY | ${c.RETAIN_UNIT_KEY} | No verified match. No write: \`unitId\` is also the adaptive mastery grouping key (\`lib/adaptive/updateMastery.ts\`), so clearing it would regroup learner mastery. Proper repair = governed units for these topic keys (decision below). |

Dangling prerequisite edges by missing side: ${Object.entries(danglingEdgeMissing).map(([k, v]) => `${k}=${v}`).join(", ")}.
Dangling unit key shapes: ${Object.entries(danglingUnitShapes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `\`${k}\`=${v}`).join(", ")}.

## Duplicates: ${plan.duplicateGroups.length} groups, ${plan.duplicateGroups.reduce((n, g) => n + g.retired.length + 1, 0)} rows

Survivor ranking, strongest first: human-review approval, learner/teacher activity rows attached, all reference rows, payload completeness, learner-visible status, most recent update, contentId. Every group and its reasons are in \`cleanup-plan.json\` → \`duplicateGroups\`.

Retained (not repointed) reference rows on retired duplicates: ${Object.entries(retiredByReason).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}. History tables (learning events, submissions, homework, AI interactions, ledgers, audio/video) stay attached to the lesson the learner actually saw. The superseded row is never deleted, so those rows keep resolving.

## Learner impact

- Lessons leaving learner view (superseded or returned for review): **${plan.learnerImpact.lessonsLeavingLearnerView}**
- Cells that would lose every visible lesson: ${plan.learnerImpact.cellsLosingAllVisibleLessons.length ? plan.learnerImpact.cellsLosingAllVisibleLessons.join(", ") : "none"}
- Learner/teacher reference rows repointed: ${plan.learnerImpact.learnerReferenceRowsRepointed}

## Grade 4 Math release bindings (production)

| Reference | Exists live | Repair |
|---|---|---|
${g4Release.references.map((r) => `| ${r.ref} | ${r.liveExists ? "yes" : "**no**"} | ${r.repair ?? "none needed"} |`).join("\n")}

Production has **${g4.lessons.length}** Grade 4 Math lessons, ${g4.units.length} Grade 4 Math units (${g4.units.map((u: { unitId: string; name: string }) => `${u.unitId} "${u.name}"`).join(", ")}), ${g4.learningTargets.length} grade-4 learning targets and ${g4.moeObjectives.length} grade-4 MoeCurriculumObjective rows.

## Rollback / recovery plan

1. **Before apply:** take a Supabase point-in-time marker and export the rows named in \`cleanup-plan.json\` (every action carries its before-image). Record the snapshot \`capturedAt\`; abort if any targeted row's \`updatedAt\` changed since then (optimistic check).
2. **Apply** in one transaction per action class, in plan order: supersede → repoint references → return for review → prerequisite edges → variants → unit links. Lesson state changes go through \`lib/curriculum/mutations/governanceWriter.ts\` so every change is a governance event, never a raw status write.
3. **Rollback:** governance changes are reversed with compensating events (REINSTATED to the prior status); repoints are reversed from \`from\`/\`to\`; deleted edges and variants are re-inserted from their before-images with original ids; repaired unit links are restored from \`fromUnitId\`. The validator proves apply-then-reverse reproduces the snapshot byte-for-byte.
4. **Point-in-time restore** is the last resort if a partial apply leaves an inconsistent state.

## Execution gate (not yet satisfied)

- [ ] Human review of the ${plan.duplicateGroups.length} survivor decisions and the ${c.RETURN_FOR_REVIEW} lessons leaving learner view
- [ ] Explicit production-write authorization
- [ ] Executor script built on governanceWriter, run first against staging with a fresh staging snapshot
- [ ] Fresh production snapshot re-planned immediately before apply (plan is snapshot-bound)
- [ ] Decision on the ${c.RETAIN_UNIT_KEY} retained unit keys: create governed CurriculumUnit rows for the ${new Set(plan.actions.flatMap((a) => a.kind === "RETAIN_UNIT_KEY" ? [a.fromUnitId] : [])).size} distinct topic keys, or move mastery grouping off \`unitId\` first
`;
  fs.writeFileSync(path.join(DIR, "CLEANUP_PLAN_V1.md"), md);
  console.log(JSON.stringify({ ok: validation.ok, errors: validation.errors, before: validation.before, after: validation.after, counts: plan.counts, duplicateGroups: plan.duplicateGroups.length, learnerImpact: plan.learnerImpact, retained: retiredByReason, danglingUnitShapes }, null, 2));
  if (!validation.ok) process.exitCode = 1;
}

main();
