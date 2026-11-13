/**
 * Synthetic K-12 school-day readiness simulation (CoS).
 *
 * Deterministic and offline: it walks every grade's day, both sections, twenty synthetic learners each
 * (labels such as G07A-L01 are simulation labels, never database IDs), and resolves every slot to what a
 * learner would actually meet. Each slot is placed on the founder's six-stage ladder from evidence only:
 *
 *   PLANNED             the slot is in a day plan (a course outline or order never counts as a lesson)
 *   GENERATED           an exact pinned factory package fills it
 *   FACTORY_VALIDATED   that package's batch has T2 validation evidence and is not held by T2
 *   ACADEMICALLY_REVIEWED  CoS G3 passes AND an independent academic review (AI-assisted, internal) accepts it
 *   PREVIEW_ELIGIBLE    release evidence records eligibility, accessibility, rights, security and timing for the hash
 *   PUBLISHED           release evidence records an authorized official publication
 *
 * A grade's day is VERIFIED only when all 8 instructional slots reach ACADEMICALLY_REVIEWED and the day as a
 * whole shows the progression and the band's STEM rigor. This is readiness evidence; runtime evidence (real
 * routes, isolated database, browser) is G5/G7 work owned by T1 and T2.
 */
const { RIGOR, developmentalBand } = require("../../../curriculum/program/stem-v1/source/standards.cjs");

const SECTIONS = ["A", "B"];
const LEARNERS_PER_SECTION = 20;
const INSTRUCTIONAL = ["P1", "P2", "P3", "P4", "P5", "P6", "SUPPORT", "END_OF_DAY"];
const STAGES = ["PLANNED", "GENERATED", "FACTORY_VALIDATED", "ACADEMICALLY_REVIEWED", "PREVIEW_ELIGIBLE", "PUBLISHED"];
const LESSON_KINDS = new Set(["V4_DRAFT", "SCHOOLDAY_DRAFT", "FACTORY_LESSON"]);
// CODE_TRACE is included: T1's TRACE mode runs llcode in a worker (T2-LANGUAGE-AND-LOADER-ACK.md), so it executes code.
const CODE_EXECUTION_BLOCKS = new Set(["CODE_RUNNER", "BLOCK_PROGRAM", "CODE_TRACE", "GRID_ROBOT_PROGRAM"]);
const gradeLabel = (g) => (g === 0 ? "K" : String(g));
const tag = (g) => `G${String(g).padStart(2, "0")}`;
const stageIndex = (s) => STAGES.indexOf(s);

function run({ plans, g3, drafts, reviews, releaseEvidence, securityGate = [], risks = [] }) {
  const audit = new Map(g3.lessons.map((l) => [`${l.version}@${l.key}`, l]));
  const review = new Map(reviews.map((r) => [`${r.version}@${r.key}`, r]));
  const release = new Map((releaseEvidence.packages ?? []).map((r) => [r.packageHash, r]));

  function stageOf(b) {
    if (!LESSON_KINDS.has(b.kind)) return { stage: "PLANNED", why: "no factory lesson" };
    const version = b.version ?? "4.0.0-draft.6";
    const pkg = drafts.find((d) => d.version === version && d.key === b.key);
    if (!pkg) return { stage: "PLANNED", why: "binding names a package that is not pinned" };
    const id = `${version}@${b.key}`;
    if (pkg.factoryValidation?.status !== "PASS") return { stage: "GENERATED", why: "no T2 validation evidence", version, pkg };
    if (pkg.hold) return { stage: "GENERATED", why: `T2 validation PASS but batch held: ${pkg.hold}`, version, pkg };
    const a = audit.get(id);
    const r = review.get(id);
    if (!a || a.g3 !== "G3_PASS") return { stage: "FACTORY_VALIDATED", why: a ? `G3 ${a.g3}` : "not yet audited", version, pkg };
    if (!r || r.decision !== "ACCEPT" || r.packageHash !== pkg.packageHash) return { stage: "FACTORY_VALIDATED", why: r ? `academic review ${r.decision}` : "academic review not recorded", version, pkg };
    const e = release.get(pkg.packageHash);
    const missing = !e ? ["release evidence"] : ["eligibilityRegistry", "accessibility", "rights", "timing"].filter((k) => e[k] !== "PASS");
    // Dependency security is a separate gate, judged on the build commit that would serve the lesson.
    const gate = e && securityGate.find((s) => s.commit === e.securityCommit);
    if (e && (!gate || gate.status !== "PASS")) missing.push(`security gate${gate ? ` OPEN at ${gate.commit}` : " not run for the build commit"}`);
    // Executable coding blocks need their own independent safety evidence (founder decision 1).
    if (e && (a.signals?.blockTypes ?? []).some((t) => CODE_EXECUTION_BLOCKS.has(t)) && e.codeExecutionSafety !== "PASS") missing.push("code-execution safety review");
    // Open platform findings that block preview apply to every lesson (unified risk register).
    const blockingRisks = risks.filter((r) => r.status === "OPEN" && r.blocksPreview).map((r) => r.id);
    if (e && blockingRisks.length) missing.push(`open platform risks ${blockingRisks.join(", ")}`);
    if (missing.length) return { stage: "ACADEMICALLY_REVIEWED", why: `missing: ${missing.join(", ")}`, version, pkg };
    if (e.published !== "AUTHORIZED_AND_PUBLISHED") return { stage: "PREVIEW_ELIGIBLE", why: "not published", version, pkg };
    return { stage: "PUBLISHED", why: e.authorization ?? "", version, pkg };
  }

  const rows = [];
  const perGrade = [];
  for (const plan of plans) {
    const teaching = plan.blocks.filter((b) => /^P[1-6]$/.test(b.slot));
    const bSlotOf = new Map();
    (plan.sectionB?.order ?? []).forEach((course, i) => bSlotOf.set(`P${i + 1}`, teaching.find((t) => t.course === course)));
    const gradeRows = [];
    for (const section of SECTIONS) {
      for (const block of plan.blocks) {
        if (!INSTRUCTIONAL.includes(block.slot)) continue;
        const source = section === "B" && /^P[1-6]$/.test(block.slot) ? bSlotOf.get(block.slot) : block;
        const b = source.binding;
        const s = stageOf(b);
        const a = s.pkg ? audit.get(`${s.version}@${b.key}`) : null;
        const row = {
          grade: plan.grade, section, slot: block.slot, time: `${block.start}-${block.end}`,
          course: source.course ?? (block.slot === "SUPPORT" ? "SUPPORT" : "END_OF_DAY"), unit: source.unit ?? null,
          stage: s.stage, stageNote: s.why,
          selection: s.pkg ? b.selection : null, packageHash: s.pkg ? s.pkg.packageHash : null,
          batch: s.pkg ? `${s.pkg.version} ${s.pkg.batchState}${s.pkg.batchCommit ? ` @${s.pkg.batchCommit}` : ""}` : null,
          order: s.pkg ? (b.orderId ?? null) : (b.generationOrder?.orderId ?? b.productionOrder?.orderId ?? null),
          g3: s.pkg ? (a?.g3 ?? "NOT_AUDITED") : "-",
          academicReview: s.pkg ? (review.get(`${s.version}@${b.key}`)?.decision ?? "NOT_RECORDED") : "-",
          humanSubjectExpert: "NOT_PERFORMED",
          signals: a?.signals ?? null,
        };
        rows.push(row);
        gradeRows.push(row);
      }
    }
    const a = gradeRows.filter((r) => r.section === "A");
    const count = (stage) => a.filter((r) => stageIndex(r.stage) >= stageIndex(stage)).length;
    const band = developmentalBand(plan.grade);
    const sig = a.map((r) => r.signals).filter(Boolean);
    const dayMissing = RIGOR[band].dayNeeds.filter((need) => !sig.some((x) => x[need]));
    const progressionOk = a.every((r) => r.signals && (r.signals.progressionComplete ?? r.signals.progression.length === 5));
    const reviewed = count("ACADEMICALLY_REVIEWED");
    const verdict = reviewed === INSTRUCTIONAL.length && progressionOk && dayMissing.length === 0 ? "DAY_VERIFIED"
      : count("GENERATED") === 0 ? "DAY_NOT_STARTED"
      : count("GENERATED") === INSTRUCTIONAL.length ? "ALL_SLOTS_GENERATED_NOT_VERIFIED"
      : "DAY_PARTIAL";
    perGrade.push({
      grade: plan.grade, band, instructionalSlots: INSTRUCTIONAL.length,
      stages: Object.fromEntries(STAGES.map((st) => [st, count(st)])),
      dayRigorMissing: sig.length ? dayMissing : RIGOR[band].dayNeeds,
      progressionComplete: progressionOk,
      verdict,
    });
  }
  const per = (stage) => rows.filter((r) => stageIndex(r.stage) >= stageIndex(stage)).length * LEARNERS_PER_SECTION;
  const lessonsBy = (pred) => new Set(rows.filter(pred).map((r) => r.packageHash)).size;
  const summary = {
    grades: plans.length,
    sections: plans.length * SECTIONS.length,
    syntheticLearners: plans.length * SECTIONS.length * LEARNERS_PER_SECTION,
    learnerSlots: rows.length * LEARNERS_PER_SECTION,
    learnerSlotsByStage: Object.fromEntries(STAGES.map((st) => [st, per(st)])),
    distinctLessonsInDays: { generated: lessonsBy((r) => r.packageHash), factoryValidated: lessonsBy((r) => stageIndex(r.stage) >= 2), academicallyReviewed: lessonsBy((r) => stageIndex(r.stage) >= 3) },
    gradesVerified: perGrade.filter((g) => g.verdict === "DAY_VERIFIED").length,
    firstVerifiedGrade: perGrade.find((g) => g.verdict === "DAY_VERIFIED")?.grade ?? null,
    verdicts: Object.fromEntries([...new Set(perGrade.map((g) => g.verdict))].sort().map((v) => [v, perGrade.filter((g) => g.verdict === v).length])),
  };
  return { rows, perGrade, summary, render: (ctx) => render(rows, perGrade, summary, plans, g3, ctx) };
}

function render(rows, perGrade, summary, plans, g3, { generationOrders, autoBound }) {
  const md = {};
  const M = ["# K-12 Period Matrix V1", "", "Generated by `scripts/cos-stem/build-program.cjs`. Every instructional slot for every grade and both sections: the slot's stage on the six-stage ladder, the lesson candidate, package hash and batch, the CoS G3 result, the independent academic review, and human subject-expert review. Machine-readable: `curriculum/program/stem-v1/period-matrix.json`.", "", `Stages: ${STAGES.join(" → ")}. A course outline or a generation order is PLANNED, never a lesson.`, ""];
  for (const plan of plans) {
    M.push(`## Grade ${gradeLabel(plan.grade)}`, "", "| Sec | Slot | Course (unit) | Stage | Why not further | Selection / order | Package hash | G3 | Academic review |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const r of rows.filter((x) => x.grade === plan.grade)) {
      M.push(`| ${r.section} | ${r.slot} | ${r.course}${r.unit ? ` (U${r.unit})` : ""} | ${r.stage} | ${r.stageNote ?? ""} | ${r.selection ? `\`${r.selection}\`` : r.order ?? "-"} | ${r.packageHash ? `\`${r.packageHash.slice(0, 12)}…\`` : "-"} | ${r.g3} | ${r.academicReview} |`);
    }
    M.push("");
  }
  md.matrix = M.join("\n");

  const S = ["# Synthetic School-Day Simulation V1", "", "Generated by `scripts/cos-stem/build-program.cjs` (`lib/simulate.cjs`). Deterministic readiness simulation of the LiberiaLearn Demonstration Academy: 13 grades, sections A and B, 20 synthetic learners per section. Learner labels are simulation labels, never database IDs. This is **not** runtime evidence.", "", "## Milestone", "", summary.firstVerifiedGrade === null ? "**No grade has a verified day yet.** The first milestone is one grade whose 8 instructional slots all reach ACADEMICALLY_REVIEWED, with complete progression and the band's STEM rigor across the day." : `First verified grade: **${gradeLabel(summary.firstVerifiedGrade)}**.`, "", "## Learner-slots by stage", "", "| Stage | Learner-slots reaching it | Share |", "| --- | ---: | ---: |"];
  for (const [st, n] of Object.entries(summary.learnerSlotsByStage)) S.push(`| ${st} | ${n} | ${((100 * n) / summary.learnerSlots).toFixed(1)}% |`);
  S.push("", `Distinct lessons in the days: ${summary.distinctLessonsInDays.generated} generated, ${summary.distinctLessonsInDays.factoryValidated} factory-validated (not held), ${summary.distinctLessonsInDays.academicallyReviewed} academically reviewed.`, "");
  S.push("## Full-day readiness by grade", "", "| Grade | Band | Planned | Generated | Factory validated | Reviewed | Preview eligible | Published | Day progression | Day rigor missing | Verdict |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |");
  for (const g of perGrade) S.push(`| ${gradeLabel(g.grade)} | ${g.band} | ${g.stages.PLANNED} | ${g.stages.GENERATED} | ${g.stages.FACTORY_VALIDATED} | ${g.stages.ACADEMICALLY_REVIEWED} | ${g.stages.PREVIEW_ELIGIBLE} | ${g.stages.PUBLISHED} | ${g.progressionComplete ? "complete" : "incomplete"} | ${g.dayRigorMissing.join(", ") || "-"} | ${g.verdict} |`);
  S.push("", "Counts are of the 8 instructional slots (P1-P6, support, end of day), section A.", "", "## Automatic bindings applied", "");
  S.push(autoBound.length ? autoBound.map((x) => `- ${tag(x.grade)} ${x.slot}: \`${x.orderId}\` → \`${x.version}@${x.key}\``).join("\n") : "None yet. A sealed batch registered with `scripts/cos-stem/intake-batch.cjs` whose manifests name a generation order fills that order's slot automatically.");
  S.push("", "## One learner's day, per section", "");
  for (const plan of plans) for (const sec of SECTIONS) {
    const day = rows.filter((r) => r.grade === plan.grade && r.section === sec).map((r) => `${r.slot} ${r.course}: ${r.stage}`);
    S.push(`- **${tag(plan.grade)}${sec}-L01**: ${day.join(" · ")}`);
  }
  S.push("");
  md.simulation = S.join("\n");

  const Q = ["# Per-Grade Academic Quality Reports V1", "", "Generated from the CoS G3 audit (`curriculum/program/stem-v1/g3-audit.json`, `scripts/cos-stem/g3-audit.cjs`), the independent academic reviews (`curriculum/program/stem-v1/reviews/`) and the day plans. G3 is mechanical evidence; academic review is AI-assisted and internal; **no human subject-expert approval is claimed for any lesson.**", ""];
  for (const plan of plans) {
    const g = perGrade.find((x) => x.grade === plan.grade);
    const lessons = g3.lessons.filter((l) => l.grade === plan.grade);
    const pass = lessons.filter((l) => l.g3 === "G3_PASS").length;
    Q.push(`## Grade ${gradeLabel(plan.grade)}: ${g.verdict} (G3 ${pass} pass / ${lessons.length - pass} fail)`, "");
    if (!lessons.length) Q.push("No factory lesson exists for this grade yet. Every instructional slot is PLANNED with a generation order; there is no lesson content to review.", "");
    for (const l of lessons) {
      Q.push(`### \`${l.version}@${l.key}\` (${l.course ?? "-"}): ${l.g3}`, "", `Package \`${l.packageHash}\`.`, "");
      if (!l.findings.length) Q.push("No G3 findings.", "");
      else { Q.push("| Finding | Severity | Precise revision |", "| --- | --- | --- |"); for (const f of l.findings) Q.push(`| ${f.code} | ${f.severity} | ${f.revision.replace(/\|/g, "\\|")} |`); Q.push(""); }
    }
    const open = generationOrders.filter((o) => o.grade === plan.grade && o.status === "OPEN").map((o) => o.orderId);
    if (open.length) Q.push(`Open generation orders: ${open.map((o) => `\`${o}\``).join(", ")}.`, "");
  }
  md.quality = Q.join("\n");
  return md;
}

module.exports = { run, SECTIONS, LEARNERS_PER_SECTION, INSTRUCTIONAL, STAGES };
