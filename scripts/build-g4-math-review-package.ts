/**
 * Build the Grade 4 Math founder review package (repository-only, no DB).
 *
 * Output (deterministic):
 *   curriculum/review/g4-math/README.md          how to review, batch index, status table
 *   curriculum/review/g4-math/unit-<n>.md        one batch per MOE unit, every objective in full
 *   curriculum/review/g4-math/review-ledger.json decisions (created as PENDING; never overwritten)
 *
 * The generator never records a review decision. Existing ledger decisions are
 * preserved verbatim; only missing objectives are added as PENDING.
 *
 * Inputs it validates but never writes:
 *   review-support.json            uncertainty dispositions and per-objective notes
 *   reviewer-recommendations.json  a reviewer's per-objective recommendation, the review
 *                                  decisions it applied and the product-gap register. A
 *                                  recommendation is not a founder decision; each one pins
 *                                  the payload sha256 it was made against, so any later
 *                                  content change fails the build until it is re-assessed.
 *
 * Usage: npx tsx scripts/build-g4-math-review-package.ts [--check]
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { GRADE4_MATH_DRAFT_LESSONS, type DraftLesson } from "@/lib/curriculum/authority/grade4Math";
import { GRADE4_FRACTIONS_LESSON, GRADE4_FRACTIONS_LESSON_2026_2 } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_2026_2_ADDITIONS } from "@/lib/learning-authority/releases/grade4Math2026_2";
import type { StructuredCurriculumItem } from "@/lib/learning-authority/structuredCurriculumAuthority";

const OUT = path.resolve("curriculum/review/g4-math");
const LEDGER = path.join(OUT, "review-ledger.json");
/** Reviewer support: uncertainty dispositions and per-objective notes. Never a decision. */
const SUPPORT = path.join(OUT, "review-support.json");
/** A reviewer's recommendations. Never a decision: decisions live only in the ledger. */
const RECOMMENDATIONS = path.join(OUT, "reviewer-recommendations.json");
const CLASSIFICATIONS = ["SOURCE_RESOLVED", "LIBERIALEARN_CLARIFICATION_REQUIRED", "HUMAN_POLICY_DECISION_REQUIRED"] as const;
type Disposition = { classification: (typeof CLASSIFICATIONS)[number]; resolution: string; evidence: string[]; proposedCorrection: string | null; decisionNeeded?: string; appliedDecision?: string };
const RECOMMENDATION_VALUES = ["READY_FOR_FOUNDER_APPROVAL", "REVISE", "BLOCKED_SOURCE", "BLOCKED_POLICY"] as const;
type Recommendation = (typeof RECOMMENDATION_VALUES)[number];
type Recommendations = {
  review: { id: string; date: string; isFounderApproval: false; isMoeApproval: false; summary: string };
  recommendedBy: string;
  values: Record<Recommendation, string>;
  decisions: Record<string, { kind: "POLICY" | "REVISION"; objective?: string; title: string; text: string }>;
  productGaps: Record<string, { kind: "TOOL" | "EVIDENCE"; need: string; objectives: string[]; description: string; blocksApproval: false }>;
  objectives: Record<string, { recommendation: Recommendation; reviewedContent: { contentId: string; version: string; payloadSha256: string }; decisionsApplied: string[]; productGaps: string[]; note: string }>;
};
const payloadSha256 = (payload: unknown) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");
type ObjectiveSupport = { risks?: string[]; answers?: string; wording?: { moeDerived?: string; liberiaLearnExplanatory?: string; exampleData?: string }; gradeAppropriate?: string; alignment?: string; interaction?: string };
type Support = {
  defaults: { answers: string; wording: { moeDerived: string; liberiaLearnExplanatory: string; exampleData: string }; gradeAppropriate: string; alignment: string; interaction: string };
  uncertainties: Record<string, Disposition>;
  objectives: Record<string, ObjectiveSupport>;
};
const mdCell = (text: string) => text.replace(/\|/g, "/");

/** Reviewer-facing uncertainties that the data cannot express on its own. Keyed by objective id suffix. */
const KNOWN_UNCERTAINTIES: Record<string, string[]> = {
  "p1-numeration-addition-and-subtraction-obj4": ["MOE table text may continue past the parsed boundary ('... births, deaths, and migration'). Population figures in the lesson are invented example data."],
  "p2-multiplication-and-division-of-whole-numbers-obj6": ["Parsed from a continuation page; confirm it belongs to this topic on the source page."],
  "p3-number-theory-and-fraction-obj3": ["MOE says 'Find LCM and GCF', and the topic's activities include prime factors. The lesson uses listing methods only (no prime factorisation); confirm that depth is right for Grade 4."],
  "p3-number-theory-and-fraction-obj4": ["The 2026.1 founder-authored lesson teaches part of a whole; MOE says 'Find parts of a set', and in 2026.1 the set model appears only in its activities."],
  "p3-number-theory-and-fraction-obj7": ["MOE says 'Add fractions' without scope. The lesson covers like denominators plus related denominators (halves/quarters/eighths); confirm unlike denominators are out of scope for Grade 4."],
  "p3-number-theory-and-fraction-obj8": ["Same scope question as adding fractions."],
  "p3-number-theory-and-fraction-obj9": ["MOE wording is circular ('Solve problems involving multi-step problems'); the lesson interprets it as multi-operation word problems."],
  "p4-multiplication-and-division-of-2-digits-multipli-obj6": ["Source text is truncated ('Divide 2, 3, or 4-Digit numbers by 2-Digit'); read as 'by 2-digit divisors'. Letter spacing was repaired automatically."],
  "p4-multiplication-and-division-of-2-digits-multipli-obj7": ["The MOE topic title says 'decimals to hundredths' while the objectives are mostly multiplication/division; confirm decimals belong in this unit."],
  "p5-measurement-obj5": ["The lesson treats weight and mass together, using everyday customary units (ounce, pound). Confirm terminology."],
  "p5-measurement-obj9": ["No Grade 4-6 grid tool is enabled online; interaction relies on squared paper."],
  "p5-measurement-obj2": ["No Grade 4-6 clock tool is enabled online; interaction relies on paper-plate clocks."],
  "p6-geometry-and-statistics-obj1": ["MOE source says 'interesting lines'; read as 'intersecting lines'."],
  "p6-geometry-and-statistics-obj2": ["Grade 4 does not measure degrees; the lesson uses a folded-paper right-angle tester. Protractor tool is enabled only for Grades 7+."],
  "p6-geometry-and-statistics-obj3": ["MOE source says 'pentago n' (spacing artifact) for pentagon."],
  "p6-geometry-and-statistics-obj5": ["Solids benefit from spatial inspection (hidden faces), but no 3D engine exists; real objects must carry the objective."],
  "p6-geometry-and-statistics-obj6": ["MOE combines graphs with 'mode, mean, median & average'. The lesson introduces the words only; calculation is in the next objective."],
  "p6-geometry-and-statistics-obj7": ["LOW extraction confidence (ambiguous column). MOE says 'medium'; read as 'median'. Data is invented example data."],
};

type Ledger = Record<string, { decision: "PENDING" | "APPROVE" | "REVISE" | "REJECT"; reviewer: string | null; reviewedAt: string | null; notes: string; reviewedContentId?: string }>;

function main() {
  const check = process.argv.includes("--check");
  const structured = JSON.parse(fs.readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: StructuredCurriculumItem[] };
  const items = new Map(structured.items.map((item) => [item.id, item]));
  const drafts = new Map<string, DraftLesson>(GRADE4_MATH_DRAFT_LESSONS.map((lesson) => [lesson.moeObjectiveId, lesson]));
  const cell = GRADE4_MATH_TEMPLATE_CELL;

  const existing: Ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
  const support = JSON.parse(fs.readFileSync(SUPPORT, "utf8")) as Support;
  const recs = JSON.parse(fs.readFileSync(RECOMMENDATIONS, "utf8")) as Recommendations;
  const errors: string[] = [];
  if (recs.review.isFounderApproval !== false || recs.review.isMoeApproval !== false) errors.push("recommendations must not claim founder or MOE approval");
  const recCounts: Record<string, number> = Object.fromEntries(RECOMMENDATION_VALUES.map((v) => [v, 0]));
  const matrixRows: string[] = [];
  const cellGaps = new Map<string, Set<string>>();
  const disposed = new Set<string>();
  const dispositionRows: string[] = [];
  const counts: Record<string, number> = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0]));
  let openCount = 0;
  const ledger: Ledger = {};
  const files = new Map<string, string>();
  const rows: string[] = [];

  cell.units.forEach((unit, unitIndex) => {
    const n = unitIndex + 1;
    const first = items.get(unit.objectives[0]!.moeItemId)!;
    const parts: string[] = [`# Batch ${n}: ${first.topic}`, "", `Unit \`${unit.id}\`, MOE semester ${first.semester}, period ${first.period}. Source: \`${first.provenance.sourceMember}\` (${first.provenance.archiveDocument}, sha256 \`${first.provenance.memberChecksum?.slice(0, 12)}…\`).`, "",
      "For each objective, record APPROVE / REVISE / REJECT in `review-ledger.json`. Nothing in this file changes lesson status.", ""];
    unit.objectives.forEach((objective, objectiveIndex) => {
      const item = items.get(objective.moeItemId)!;
      const draft = drafts.get(objective.moeItemId);
      const governed = !draft && objective.moeItemId.endsWith("p3-number-theory-and-fraction-obj4");
      const suffix = objective.moeItemId.replace(/^moe-math-g4-s\d-/, "");
      const lessonStatus = governed ? "FOUNDER-AUTHORED, NOT YET PUBLISHED (release-bound, awaiting publication)" : "DRAFT_UNREVIEWED";
      const title = draft?.title ?? GRADE4_FRACTIONS_LESSON.title;
      const contentId = draft?.contentId ?? GRADE4_FRACTIONS_LESSON.contentId;
      const version = draft?.version ?? GRADE4_FRACTIONS_LESSON.version;
      const exampleLabels = draft ? [...new Set(JSON.stringify(draft.payload).match(/\((example [a-z]+|illustrative)\)|example data/gi) ?? [])] : [];
      // Stable ids: <objective>#confidence, #known-<n>, #tool-gap. Each needs a disposition in review-support.json.
      const uncertainties = [
        ...(item.confidence !== "HIGH" ? [{ id: `${objective.moeItemId}#confidence`, text: `MOE extraction confidence ${item.confidence}${item.qualityFlags.length ? ` (${item.qualityFlags.join(", ")})` : ""}.` }] : []),
        ...(KNOWN_UNCERTAINTIES[suffix] ?? []).map((text, i) => ({ id: `${objective.moeItemId}#known-${i + 1}`, text })),
        ...(objective.interaction.need !== "NONE" && objective.interaction.tools.length === 0 && objective.interaction.need !== "PRACTICAL" ? [{ id: `${objective.moeItemId}#tool-gap`, text: `Interaction ${objective.interaction.need} has no enabled online tool; offline fallback only.` }] : []),
      ];
      const id = `${n}.${objectiveIndex + 1}`;
      const dispositionLines: string[] = [];
      for (const u of uncertainties) {
        const d = support.uncertainties[u.id];
        disposed.add(u.id);
        if (!d) { errors.push(`missing disposition: ${u.id}`); continue; }
        if (!CLASSIFICATIONS.includes(d.classification)) errors.push(`invalid classification: ${u.id}`);
        for (const ref of d.evidence) {
          const moeId = ref.split(" ")[0]!;
          if (moeId.startsWith("moe-") && !items.has(moeId)) errors.push(`unknown MOE evidence ${moeId} in ${u.id}`);
        }
        if (d.classification === "HUMAN_POLICY_DECISION_REQUIRED" && !d.decisionNeeded) errors.push(`policy decision not stated: ${u.id}`);
        const applied = d.appliedDecision ? recs.decisions[d.appliedDecision] : undefined;
        if (d.appliedDecision && !applied) errors.push(`unknown applied decision ${d.appliedDecision} in ${u.id}`);
        counts[d.classification] = (counts[d.classification] ?? 0) + 1;
        if (d.classification !== "SOURCE_RESOLVED" && !applied) openCount += 1;
        const state = applied ? `${d.classification}; settled by ${d.appliedDecision}` : d.classification === "SOURCE_RESOLVED" ? d.classification : `${d.classification} (OPEN)`;
        dispositionRows.push(`| ${id} | ${mdCell(u.text)} | ${state} | ${mdCell(applied ? `${applied.title}: ${applied.text}` : d.decisionNeeded ?? d.proposedCorrection ?? d.resolution)} |`);
        dispositionLines.push(`- ${u.text}`, `  - **${d.classification}.** ${d.resolution}`, `  - Evidence: ${d.evidence.length ? d.evidence.join("; ") : "n/a (no online tool is registered; see the toolkit registry)"}`,
          ...(d.proposedCorrection ? [`  - ${applied ? "Correction" : "Proposed correction"}: ${d.proposedCorrection}`] : []),
          ...(d.decisionNeeded && !applied ? [`  - Founder decision needed: ${d.decisionNeeded}`] : []),
          ...(applied ? [`  - Settled by review decision ${d.appliedDecision} (${applied.title}; not founder approval): ${applied.text}`] : []));
      }
      const note = support.objectives[objective.moeItemId];
      if (!note) errors.push(`missing objective support: ${objective.moeItemId}`);
      const merged = { ...support.defaults, ...note, wording: { ...support.defaults.wording, ...note?.wording } };
      ledger[objective.moeItemId] = existing[objective.moeItemId] ?? { decision: "PENDING", reviewer: null, reviewedAt: null, notes: "" };

      // The reviewed content: the draft, or for 3.4 the 2026.2 candidate (2026.1 is immutable and already reviewed).
      const reviewed = draft ?? GRADE4_FRACTIONS_LESSON_2026_2;
      const reviewedSha = payloadSha256(reviewed.payload);
      const rec = recs.objectives[objective.moeItemId];
      const planned = objective.interaction.plannedEnhancement ?? null;
      if (planned) cellGaps.set(planned.gapCode, (cellGaps.get(planned.gapCode) ?? new Set()).add(objective.moeItemId));
      if (!rec) errors.push(`missing recommendation: ${objective.moeItemId}`);
      else {
        if (!RECOMMENDATION_VALUES.includes(rec.recommendation)) errors.push(`invalid recommendation: ${objective.moeItemId}`);
        if (rec.reviewedContent.contentId !== reviewed.contentId || rec.reviewedContent.version !== reviewed.version || rec.reviewedContent.payloadSha256 !== reviewedSha)
          errors.push(`stale recommendation (content changed since it was assessed): ${objective.moeItemId} expects ${reviewed.contentId}@${reviewed.version} ${reviewedSha}`);
        for (const ref of rec.decisionsApplied) if (!recs.decisions[ref]) errors.push(`unknown decision ${ref} in recommendation ${objective.moeItemId}`);
        for (const code of rec.productGaps) if (!recs.productGaps[code]?.objectives.includes(objective.moeItemId)) errors.push(`product gap ${code} not registered for ${objective.moeItemId}`);
        if (planned && !rec.productGaps.includes(planned.gapCode)) errors.push(`recommendation omits planned-enhancement gap ${planned.gapCode}: ${objective.moeItemId}`);
        if (rec.recommendation !== "READY_FOR_FOUNDER_APPROVAL" && !rec.note.trim()) errors.push(`non-ready recommendation needs a note: ${objective.moeItemId}`);
        recCounts[rec.recommendation] = (recCounts[rec.recommendation] ?? 0) + 1;
        matrixRows.push(`| ${id} | ${mdCell(item.text)} | \`${reviewed.contentId}\` v${reviewed.version} | ${objective.interaction.need} | ${rec.decisionsApplied.length ? rec.decisionsApplied.map((r) => r.replace("CPR-2026-09-26-", "")).join(", ") : "none"} | ${rec.productGaps.length ? rec.productGaps.join(", ") : "none"} | **${rec.recommendation}** | ${ledger[objective.moeItemId]!.decision} |`);
      }
      rows.push(`| ${id} | ${item.text.replace(/\|/g, "/")} | ${title} | ${governed ? "founder-authored" : "draft"} | ${objective.interaction.need} | ${uncertainties.length} | ${rec?.recommendation ?? "missing"} | ${ledger[objective.moeItemId]!.decision} |`);

      parts.push(`## ${id} ${item.text}`, "",
        "| Field | Value |", "|---|---|",
        `| MOE objective id | \`${objective.moeItemId}\` |`,
        `| Source page | ${item.provenance.pages.join(", ")} (${item.provenance.extractionMethod}, parser ${item.provenance.parser}) |`,
        `| MOE approval | ${item.moeApprovalState} (source provenance is not approval) |`,
        `| Lesson | ${title} (\`${contentId}\` v${version}) |`,
        `| Status | ${lessonStatus} |`,
        `| Interaction | ${objective.interaction.need}${objective.interaction.tools.length ? ` via ${objective.interaction.tools.join(", ")}` : ""}${objective.interaction.rationale ? `. ${objective.interaction.rationale}` : ""} |`,
        `| Interaction offline | ${objective.interaction.offlineFallback ?? "n/a"} |`,
        `| Planned enhancement | ${planned ? `${planned.gapCode} (${planned.need}), NOT IMPLEMENTED: ${planned.description}` : "none"} |`,
        `| Evidence | ${objective.interaction.evidence}${objective.interaction.safety ? `; safety: ${objective.interaction.safety}` : ""} |`,
        `| Example-data labels | ${exampleLabels.length ? exampleLabels.join(", ") : "none"} |`,
        `| Reviewed content | \`${reviewed.contentId}\` v${reviewed.version}, payload sha256 \`${reviewedSha}\` |`,
        `| Reviewer recommendation | **${rec?.recommendation ?? "missing"}** (${recs.review.id}; not a founder decision)${rec?.decisionsApplied.length ? `. Decisions applied: ${rec.decisionsApplied.join(", ")}` : ""}${rec?.note ? `. ${mdCell(rec.note)}` : ""} |`,
        "");
      parts.push(`**Known uncertainties:** ${uncertainties.length ? "" : "none recorded."}`, ...dispositionLines, "");
      parts.push("### Reviewer support (not a decision)", "",
        `- **Content risks:** ${merged.risks?.length ? "" : "none found."}`, ...(merged.risks ?? []).map((r) => `  - ${r}`),
        `- **Answers:** ${merged.answers}`,
        `- **Wording provenance.** MOE-derived: ${merged.wording.moeDerived} LiberiaLearn explanatory: ${merged.wording.liberiaLearnExplanatory} Example data: ${merged.wording.exampleData}`,
        `- **Grade appropriateness:** ${merged.gradeAppropriate}`,
        `- **Component alignment:** ${merged.alignment}`,
        `- **Interaction classification (${objective.interaction.need}):** ${merged.interaction}`, "");
      if (draft) {
        const pl = draft.payload;
        parts.push("### Explanation", "", pl.body, "",
          "### Objectives", "", ...pl.objectives.map((o) => `- ${o}`), "",
          "### Classwork", "", ...pl.activities.map((a) => `- ${a}`), "",
          "### Practice", "", ...pl.practice.map((x, i) => `${i + 1}. ${x.prompt} **Answer:** ${x.answer}`), "",
          "### Homework", "", ...pl.homework.map((x, i) => `${i + 1}. ${x.prompt} **Answer:** ${x.answer}`), "",
          "### Quiz", "", ...pl.quiz.map((q, i) => `${i + 1}. ${q.prompt} (${q.options.join(" / ")}) **Answer:** ${q.answer}`), "",
          "### Diagnostic check (before the lesson)", "", `${pl.diagnosticCheck.prompt} (${pl.diagnosticCheck.options.join(" / ")}) **Answer:** ${pl.diagnosticCheck.answer}`, "",
          "### Exit assessment", "", `${pl.assessment.prompt} (${pl.assessment.options.join(" / ")}) **Answer:** ${pl.assessment.answer}`, "",
          "### Teacher notes", "", pl.teacherNotes, "",
          "### Materials", "", pl.materials.join(", "), "",
          "### Offline behavior", "", pl.offline, "", `Duration: ${pl.durationMins} minutes.`, "", "---", "");
      } else {
        const pl = GRADE4_FRACTIONS_LESSON.payload;
        parts.push("### Explanation", "", pl.body, "",
          "### Objectives", "", ...pl.objectives.map((o) => `- ${o}`), "",
          "### Classwork", "", ...pl.activities.map((a) => `- ${a}`), "",
          "### Practice", "", "Governed item `g4-frac-practice-equivalence` is bound to the equivalence concept, not this objective. No practice set in the lesson payload.", "",
          "### Homework", "", pl.homework, "",
          "### Quiz", "", "None in the lesson payload (gap).", "",
          "### Diagnostic check", "", "Governed item `g4-frac-diagnostic-equal-parts`: Which fraction represents three equal parts out of four? (1/4 / 2/4 / 3/4 / 4/3) **Answer:** 3/4", "",
          "### Exit assessment", "", `${pl.assessment.question} (${pl.assessment.options.join(" / ")}) **Answer:** ${pl.assessment.correctAnswer}`, "",
          "### Teacher notes / materials / offline", "", "Not present as separate fields in the founder lesson payload; the activities use paper folding and bottle caps and are fully offline.", "", `Duration: ${pl.durationMins} minutes.`, "");
        const next = GRADE4_FRACTIONS_LESSON_2026_2;
        const np = next.payload;
        const itemsById = new Map(GRADE4_MATH_2026_2_ADDITIONS.flatMap((addition) => addition.items).map((entry) => [entry.id, entry]));
        const governedItem = (ref: { itemId: string; itemVersion: string }) => {
          const entry = itemsById.get(ref.itemId);
          return entry
            ? `\`${entry.id}\` v${entry.version}: ${entry.prompt} (${entry.options.join(" / ")}) **Answer:** ${entry.options[entry.correctIndex]}`
            : `\`${ref.itemId}\` v${ref.itemVersion} (released in 2026.1, unchanged)`;
        };
        parts.push(`### Candidate successor: ${next.title} (\`${next.contentId}\` v${next.version})`, "",
          `PENDING founder review. Supersedes \`${next.supersedes.contentId}\` v${next.supersedes.version} in the 2026.2 release candidate only; the 2026.1 lesson above is unchanged. A decision for this objective should name the version reviewed.`, "",
          "#### Explanation", "", np.body, "",
          "#### Objectives", "", ...np.objectives.map((o) => `- ${o}`), "",
          "#### Classwork", "", ...np.activities.map((a) => `- ${a}`), "",
          "#### Practice", "", ...np.practice.map((x, i) => `${i + 1}. ${x.prompt} **Answer:** ${x.answer}`), "",
          "#### Homework", "", ...np.homework.map((x, i) => `${i + 1}. ${x.prompt} **Answer:** ${x.answer}`), "",
          "#### Quiz", "", ...np.quiz.map((q, i) => `${i + 1}. ${q.prompt} (${q.options.join(" / ")}) **Answer:** ${q.answer}`), "",
          "#### Diagnostic check (before the lesson)", "", `${np.diagnosticCheck.prompt} (${np.diagnosticCheck.options.join(" / ")}) **Answer:** ${np.diagnosticCheck.answer}`, "",
          "#### Exit assessment", "", `${np.assessment.question} (${np.assessment.options.join(" / ")}) **Answer:** ${np.assessment.correctAnswer}`, "",
          "#### Optional extension (not assessed)", "", np.optionalExtension, "",
          "#### Governed evidence items (release 2026.2 candidate)", "",
          `- Diagnostic: ${governedItem(np.evidence.diagnostic)}`,
          ...np.evidence.practice.map((ref) => `- Practice: ${governedItem(ref)}`),
          `- End of lesson (assesses parts of a set): ${governedItem(np.evidence.endOfLesson)}`,
          ...np.evidence.supporting.map((ref) => `- Supporting check: ${governedItem(ref)}`), "",
          "#### Teacher notes", "", np.teacherNotes, "",
          "#### Materials", "", np.materials.join(", "), "",
          "#### Offline behavior", "", np.offline, "", `Duration: ${np.durationMins} minutes.`, "", "---", "");
      }
    });
    files.set(`unit-${n}.md`, parts.join("\n").replace(/[ \t]+(?=\r?$)/gm, ""));
  });

  for (const id of Object.keys(support.uncertainties)) if (!disposed.has(id)) errors.push(`orphan disposition: ${id}`);
  for (const id of Object.keys(support.objectives)) if (!ledger[id]) errors.push(`orphan objective support: ${id}`);
  for (const id of Object.keys(recs.objectives)) if (!ledger[id]) errors.push(`orphan recommendation: ${id}`);
  // The product-gap register and the cell's planned enhancements must agree exactly.
  for (const [code, objectives] of cellGaps) {
    const registered = recs.productGaps[code];
    if (!registered || registered.kind !== "TOOL") { errors.push(`planned enhancement ${code} missing from the product-gap register`); continue; }
    if ([...objectives].sort().join() !== [...registered.objectives].sort().join()) errors.push(`product gap ${code} objectives differ from the cell`);
  }
  for (const [code, gap] of Object.entries(recs.productGaps)) {
    if (gap.kind === "TOOL" && !cellGaps.has(code)) errors.push(`registered tool gap ${code} has no planned enhancement in the cell`);
    if (gap.blocksApproval !== false) errors.push(`product gap ${code} must not block approval without a policy decision`);
  }
  if (errors.length) { console.error(`review support invalid:\n${errors.join("\n")}`); process.exit(1); }
  const decided = Object.values(ledger).filter((entry) => entry.decision !== "PENDING").length;
  files.set("README.md", [
    "# Grade 4 Math founder review package",
    "",
    `Generated from \`lib/curriculum/authority/grade4Math/\`, \`lib/curriculum/authority/grade4FractionsLesson.ts\`, \`lib/learning-authority/cells/grade4Math.ts\` and \`curriculum/structured/moe-structured-v1.json\` by \`scripts/build-g4-math-review-package.ts\`. Do not edit the unit files by hand; edit the lessons and regenerate.`,
    "",
    "## How to review",
    "",
    "1. Take one batch (one unit file) at a time. Each objective shows the MOE text and page, the lesson in full with answers, the interaction classification and known uncertainties.",
    "2. Record a decision per objective in `review-ledger.json`: `APPROVE`, `REVISE` (put what to change in `notes`) or `REJECT`, with your name as `reviewer` and an ISO `reviewedAt`. For 3.4 (two lesson versions exist) also add `reviewedContentId` naming the lesson you reviewed; the publication script refuses without it.",
    "3. A ledger decision is a record of your review, not a publication. Promotion to a governed lesson and publication are separate, explicitly authorized steps through the canonical curriculum workflow.",
    "4. Nothing here is MOE approval. MOE approval needs its own recorded evidence.",
    "5. `reviewer-recommendations.json` holds a reviewer's recommendation per objective (below). A recommendation is input to your decision, not a decision: it never changes the ledger.",
    "",
    `**Status:** ${decided}/${Object.keys(ledger).length} objectives decided (founder ledger).`,
    "",
    `## Reviewer recommendations (${recs.review.id}, not founder approval)`,
    "",
    `${recs.review.summary} Recommended by: ${recs.recommendedBy}.`,
    "",
    `**Result:** ${RECOMMENDATION_VALUES.map((v) => `${recCounts[v]} ${v}`).join(", ")}.`,
    "",
    ...RECOMMENDATION_VALUES.map((v) => `- \`${v}\`: ${recs.values[v]}`),
    "",
    "| # | MOE objective | Content assessed | Interaction | Review decisions applied | Product gaps | Recommendation | Founder ledger |",
    "|---|---|---|---|---|---|---|---|",
    ...matrixRows,
    "",
    "### Review decisions applied",
    "",
    "| Id | Kind | Objective | Decision |",
    "|---|---|---|---|",
    ...Object.entries(recs.decisions).map(([ref, d]) => `| ${ref} | ${d.kind} | ${d.objective ?? "all"} | **${d.title}.** ${mdCell(d.text)} |`),
    "",
    "### Product and tool gaps (none blocks lesson approval)",
    "",
    "| Gap | Kind | Need | Objectives | Description |",
    "|---|---|---|---|---|",
    ...Object.entries(recs.productGaps).map(([code, g]) => `| ${code} | ${g.kind} | ${g.need} | ${g.objectives.map((o) => o.replace(/^moe-math-g4-s\d-/, "")).join(", ")} | ${mdCell(g.description)} |`),
    "",
    "## Batches",
    "",
    ...cell.units.map((unit, i) => `- [Batch ${i + 1}: ${items.get(unit.objectives[0]!.moeItemId)!.topic}](unit-${i + 1}.md), ${unit.objectives.length} objectives`),
    "",
    "## Uncertainty dispositions",
    "",
    `${disposed.size} flagged uncertainties, each resolved from source context where possible (details and evidence in each batch file; data in \`review-support.json\`): ${CLASSIFICATIONS.map((c) => `${counts[c]} ${c}`).join(", ")}. ${openCount} remain open; the other non-source items were settled by a named review decision (not founder approval). MOE text is never normalized in place.`,
    "",
    "| # | Uncertainty | Disposition | Proposed correction or decision needed |",
    "|---|---|---|---|",
    ...dispositionRows,
    "",
    "## All objectives",
    "",
    "| # | MOE objective | Lesson | Lesson status | Interaction | Uncertainties | Recommendation | Decision |",
    "|---|---|---|---|---|---:|---|---|",
    ...rows,
    "",
  ].join("\n").replace(/[ \t]+(?=\r?$)/gm, ""));
  files.set("review-ledger.json", `${JSON.stringify(ledger, null, 2)}\n`);

  if (check) {
    const stale = [...files.entries()].filter(([name, text]) => !fs.existsSync(path.join(OUT, name)) || fs.readFileSync(path.join(OUT, name), "utf8") !== text);
    if (stale.length) { console.error(`review package stale: ${stale.map(([name]) => name).join(", ")}`); process.exit(1); }
    console.log("review package matches a fresh run");
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, text] of files) fs.writeFileSync(path.join(OUT, name), text);
  console.log(JSON.stringify({ out: OUT, files: [...files.keys()], objectives: Object.keys(ledger).length, decided }));
}

main();
