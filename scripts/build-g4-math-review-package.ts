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
 * Usage: npx tsx scripts/build-g4-math-review-package.ts [--check]
 */
import fs from "node:fs";
import path from "node:path";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { GRADE4_MATH_DRAFT_LESSONS, type DraftLesson } from "@/lib/curriculum/authority/grade4Math";
import { GRADE4_FRACTIONS_LESSON } from "@/lib/curriculum/authority/grade4FractionsLesson";
import type { StructuredCurriculumItem } from "@/lib/learning-authority/structuredCurriculumAuthority";

const OUT = path.resolve("curriculum/review/g4-math");
const LEDGER = path.join(OUT, "review-ledger.json");

/** Reviewer-facing uncertainties that the data cannot express on its own. Keyed by objective id suffix. */
const KNOWN_UNCERTAINTIES: Record<string, string[]> = {
  "p1-numeration-addition-and-subtraction-obj4": ["MOE table text may continue past the parsed boundary ('... births, deaths, and migration'). Population figures in the lesson are invented example data."],
  "p2-multiplication-and-division-of-whole-numbers-obj6": ["Parsed from a continuation page; confirm it belongs to this topic on the source page."],
  "p3-number-theory-and-fraction-obj3": ["MOE says 'Find LCM and GCF'. The lesson uses listing methods only (no prime factorisation); confirm that depth is right for Grade 4."],
  "p3-number-theory-and-fraction-obj4": ["Covered by the founder-authored lesson (part of a whole). MOE says 'parts of a set'; the set model appears only in its activities."],
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
  "p6-geometry-and-statistics-obj5": ["Classified THREE_D; no 3D engine exists, so real objects are the required fallback."],
  "p6-geometry-and-statistics-obj6": ["MOE combines graphs with 'mode, mean, median & average'. The lesson introduces the words only; calculation is in the next objective."],
  "p6-geometry-and-statistics-obj7": ["LOW extraction confidence (ambiguous column). MOE says 'medium'; read as 'median'. Data is invented example data."],
};

type Ledger = Record<string, { decision: "PENDING" | "APPROVE" | "REVISE" | "REJECT"; reviewer: string | null; reviewedAt: string | null; notes: string }>;

function main() {
  const check = process.argv.includes("--check");
  const structured = JSON.parse(fs.readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: StructuredCurriculumItem[] };
  const items = new Map(structured.items.map((item) => [item.id, item]));
  const drafts = new Map<string, DraftLesson>(GRADE4_MATH_DRAFT_LESSONS.map((lesson) => [lesson.moeObjectiveId, lesson]));
  const cell = GRADE4_MATH_TEMPLATE_CELL;

  const existing: Ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
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
      const uncertainties = [
        ...(item.confidence !== "HIGH" ? [`MOE extraction confidence ${item.confidence}${item.qualityFlags.length ? ` (${item.qualityFlags.join(", ")})` : ""}.`] : []),
        ...(KNOWN_UNCERTAINTIES[suffix] ?? []),
        ...(objective.interaction.need !== "NONE" && objective.interaction.tools.length === 0 && objective.interaction.need !== "PRACTICAL" ? [`Interaction ${objective.interaction.need} has no enabled online tool; offline fallback only.`] : []),
      ];
      const id = `${n}.${objectiveIndex + 1}`;
      ledger[objective.moeItemId] = existing[objective.moeItemId] ?? { decision: "PENDING", reviewer: null, reviewedAt: null, notes: "" };
      rows.push(`| ${id} | ${item.text.replace(/\|/g, "/")} | ${title} | ${governed ? "founder-authored" : "draft"} | ${objective.interaction.need} | ${uncertainties.length} | ${ledger[objective.moeItemId]!.decision} |`);

      parts.push(`## ${id} ${item.text}`, "",
        "| Field | Value |", "|---|---|",
        `| MOE objective id | \`${objective.moeItemId}\` |`,
        `| Source page | ${item.provenance.pages.join(", ")} (${item.provenance.extractionMethod}, parser ${item.provenance.parser}) |`,
        `| MOE approval | ${item.moeApprovalState} (source provenance is not approval) |`,
        `| Lesson | ${title} (\`${contentId}\` v${version}) |`,
        `| Status | ${lessonStatus} |`,
        `| Interaction | ${objective.interaction.need}${objective.interaction.tools.length ? ` via ${objective.interaction.tools.join(", ")}` : ""}${objective.interaction.rationale ? `. ${objective.interaction.rationale}` : ""} |`,
        `| Interaction offline | ${objective.interaction.offlineFallback ?? "n/a"} |`,
        `| Evidence | ${objective.interaction.evidence}${objective.interaction.safety ? `; safety: ${objective.interaction.safety}` : ""} |`,
        `| Example-data labels | ${exampleLabels.length ? exampleLabels.join(", ") : "none"} |`,
        "");
      parts.push(`**Known uncertainties:** ${uncertainties.length ? "" : "none recorded."}`, ...uncertainties.map((u) => `- ${u}`), "");
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
          "### Teacher notes / materials / offline", "", "Not present as separate fields in the founder lesson payload; the activities use paper folding and bottle caps and are fully offline.", "", `Duration: ${pl.durationMins} minutes.`, "", "---", "");
      }
    });
    files.set(`unit-${n}.md`, parts.join("\n"));
  });

  const decided = Object.values(ledger).filter((entry) => entry.decision !== "PENDING").length;
  files.set("README.md", [
    "# Grade 4 Math founder review package",
    "",
    `Generated from \`lib/curriculum/authority/grade4Math/\`, \`lib/curriculum/authority/grade4FractionsLesson.ts\`, \`lib/learning-authority/cells/grade4Math.ts\` and \`curriculum/structured/moe-structured-v1.json\` by \`scripts/build-g4-math-review-package.ts\`. Do not edit the unit files by hand; edit the lessons and regenerate.`,
    "",
    "## How to review",
    "",
    "1. Take one batch (one unit file) at a time. Each objective shows the MOE text and page, the lesson in full with answers, the interaction classification and known uncertainties.",
    "2. Record a decision per objective in `review-ledger.json`: `APPROVE`, `REVISE` (put what to change in `notes`) or `REJECT`, with your name as `reviewer` and an ISO `reviewedAt`.",
    "3. A ledger decision is a record of your review, not a publication. Promotion to a governed lesson and publication are separate, explicitly authorized steps through the canonical curriculum workflow.",
    "4. Nothing here is MOE approval. MOE approval needs its own recorded evidence.",
    "",
    `**Status:** ${decided}/${Object.keys(ledger).length} objectives decided.`,
    "",
    "## Batches",
    "",
    ...cell.units.map((unit, i) => `- [Batch ${i + 1}: ${items.get(unit.objectives[0]!.moeItemId)!.topic}](unit-${i + 1}.md), ${unit.objectives.length} objectives`),
    "",
    "## All objectives",
    "",
    "| # | MOE objective | Lesson | Lesson status | Interaction | Uncertainties | Decision |",
    "|---|---|---|---|---|---:|---|",
    ...rows,
    "",
  ].join("\n"));
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
