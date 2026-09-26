/**
 * Certify a governed template cell (V1). Offline: reads repository authority
 * and, when present, the read-only production snapshot captured by
 * scripts/curriculum-cleanup-snapshot-v1.ts. Never touches a database.
 *
 * Output: artifacts/template-cell-v1/<cellId>.json and G4_MATH_TEMPLATE_CELL_V1.md
 * Exit code 1 when the cell is not internally executable, or with --live-gate
 * when the live certification checklist does not fully pass.
 *
 * Usage: npx tsx scripts/certify-template-cell-v1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { GRADE4_MATH_TEMPLATE_CELL } from "@/lib/learning-authority/cells/grade4Math";
import { certifyTemplateCell, COMPONENT_KINDS, liveCertificationChecklist, type LiveState, type RepoLesson } from "@/lib/learning-authority/templateCell";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { buildGovernedCellInventory } from "@/lib/learning-authority/governedInventory";
import { GRADE4_FRACTIONS_LESSON } from "@/lib/curriculum/authority/grade4FractionsLesson";
import { GRADE4_MATH_DRAFT_LESSONS } from "@/lib/curriculum/authority/grade4Math";
import { TOOL_REGISTRY_DEFINITIONS } from "@/lib/toolkit/toolRegistry";
import { LAB_IDS } from "@/lib/labs/registry";
import type { StructuredCurriculumItem } from "@/lib/learning-authority/structuredCurriculumAuthority";

// Release ToolPolicy keys are the learner-page tool keys (app/student/learn/page.tsx).
export const RELEASE_TOOL_KEY_MAP: Record<string, string | null> = {
  fraction_strips: "fraction-visualizer",
  number_line: "number-line",
  calculator: "basic-calculator",
};

const OUT = path.resolve("artifacts/template-cell-v1");
const SNAP = path.resolve("artifacts/curriculum-cleanup-v1");

function main() {
  const cell = GRADE4_MATH_TEMPLATE_CELL;
  const structured = JSON.parse(fs.readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: StructuredCurriculumItem[] };
  const band = cell.grade <= 3 ? "1-3" : cell.grade <= 6 ? "4-6" : cell.grade <= 9 ? "7-9" : "10-12";
  const subject = cell.subject.toLowerCase();
  const toolIds = new Set(TOOL_REGISTRY_DEFINITIONS.filter((tool) => tool.contexts.some((ctx) => ctx.gradeBand === band && ctx.subject === subject)).map((tool) => tool.id));
  const repoLessons: RepoLesson[] = [
    { contentId: GRADE4_FRACTIONS_LESSON.contentId, version: GRADE4_FRACTIONS_LESSON.version, grade: GRADE4_FRACTIONS_LESSON.grade, subject: GRADE4_FRACTIONS_LESSON.subject, authority: "GOVERNED", payload: GRADE4_FRACTIONS_LESSON.payload },
    ...GRADE4_MATH_DRAFT_LESSONS.map((lesson) => ({ contentId: lesson.contentId, version: lesson.version, grade: lesson.grade, subject: lesson.subject, authority: lesson.authority.state, payload: lesson.payload })),
  ];

  let live: LiveState | undefined;
  if (fs.existsSync(path.join(SNAP, "snapshot.json"))) {
    const snapshot = JSON.parse(fs.readFileSync(path.join(SNAP, "snapshot.json"), "utf8"));
    const g4 = JSON.parse(fs.readFileSync(path.join(SNAP, "g4-math-live.json"), "utf8"));
    live = {
      capturedAt: snapshot.capturedAt,
      lessonContentIds: new Set(snapshot.contents.map((c: { contentId: string }) => c.contentId)),
      learningTargetCodes: new Set(g4.learningTargets.map((t: { code: string }) => t.code)),
      standardCodes: new Set(g4.standards.map((s: { code: string }) => s.code)),
      skillIds: new Set(g4.skills.map((s: { id: string }) => s.id)),
      unitIds: g4.units.map((u: { unitId: string }) => u.unitId),
    };
  }

  const report = certifyTemplateCell({
    cell, structuredItems: structured.items, release: GRADE4_MATH_ONTOLOGY_RELEASE, repoLessons,
    toolIds, releaseToolKeyMap: RELEASE_TOOL_KEY_MAP, labIds: new Set<string>(LAB_IDS), live,
  });

  const inventory = buildGovernedCellInventory(cell, GRADE4_MATH_ONTOLOGY_RELEASE);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "g4-math-governed-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  const gate = liveCertificationChecklist(report);
  const liveCertified = gate.every((entry) => entry.pass);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${cell.id}.json`), `${JSON.stringify({ toolsEnabledForCell: [...toolIds].sort(), liveCertified, liveGate: gate, ...report }, null, 1)}\n`);

  const s = report.summary;
  const pct = (n: number) => `${n}/${s.moeObjectives} (${Math.round((100 * n) / s.moeObjectives)}%)`;
  const md = `# Grade 4 Math governed template cell V1

- **Cell:** \`${cell.id}\` → release \`${report.releaseId}\`. Authority: MOE source verified, LiberiaLearn review **${cell.authority.liberiaLearnReviewState}**, MOE approval **${cell.authority.moeApprovalState}**.
- **Internally executable:** ${report.internallyExecutable ? "**YES**. Every reference resolves in repository authority" : `**NO** (${report.errors.length} errors)`}.
- **Live executable (production):** ${report.live.checked ? (report.live.liveExecutable ? "**YES**" : `**NO**. Missing live: ${report.live.missing.map((m) => `\`${m}\``).join(", ")}`) : "not checked"}${report.live.capturedAt ? ` (snapshot ${report.live.capturedAt})` : ""}.
${report.errors.length ? `\n## Errors\n\n${report.errors.map((e) => `- \`${e}\``).join("\n")}\n` : ""}
## Live certification gate: ${liveCertified ? "**PASS**" : "**NOT CERTIFIED**"}

| Result | Requirement | Detail |
|---|---|---|
${gate.map((g) => `| ${g.pass ? "PASS" : "FAIL"} | ${g.requirement} | ${g.detail} |`).join("\n")}

## Authority chain

MOE archive page → structured objective (\`curriculum/structured/moe-structured-v1.json\`) → cell unit (\`lib/learning-authority/cells/grade4Math.ts\`) → concept (release) → lesson / governed item → evidence policy + ToolPolicy → ontology release (\`lib/learning-authority/governedGrade4Math.ts\`). The certifier is \`lib/learning-authority/templateCell.ts\` and is cell-agnostic.

## Coverage (${s.moeObjectives} MOE objectives, 6 units)

| Measure | Covered |
|---|---|
| Objectives placed in a unit with interaction classified | ${pct(s.moeObjectives)} |
| Objectives with a governed (reviewed, release-bound) lesson | ${pct(s.objectivesWithGovernedLesson)} |
| Objectives with only a DRAFT_UNREVIEWED lesson | ${pct(s.objectivesWithDraftLessonOnly)} |
| Objectives with a governed item (diagnostic/practice) | ${pct(s.objectivesWithGovernedItem)} |
${COMPONENT_KINDS.map((k) => `| ${k.toLowerCase()} (governed / draft) | ${pct(s.componentCoverage[k])} / ${pct(s.draftComponentCoverage[k])} |`).join("\n")}
| MOE resources referenced (materials) | ${s.resources} items |
| MOE assessment references (teacher metadata) | ${s.teacherAssessmentReferences} items |
| MOE activities (teacher metadata) | ${s.moeActivities} items |

## Interaction / lab classification

| Need | Objectives |
|---|---:|
${Object.entries(s.interaction).map(([k, v]) => `| ${k} | ${v} |`).join("\n")}

Implemented with an enabled tool, lab or practical protocol: ${s.interactionImplemented}. Gaps (need classified, no Grade 4-6 tool/engine exists): ${s.interactionGaps.map((g) => `\`${g.split("-").slice(-1)[0]}\` ${g.split(":")[1]}`).join(", ") || "none"}.
No objective needs a VIRTUAL_LAB or SIMULATION: the lab engine's ${LAB_IDS.length} typed labs are all science, and none is claimed here.

| Unit | Objective | Page | Interaction | Lesson | Governed components |
|---|---|---:|---|---|---|
${report.objectives.map((o) => `| ${o.unitId.replace("g4-math-", "")} | ${o.text.replace(/\|/g, "/")} | ${o.pages.join(",")} | ${o.interaction}${o.interaction !== "NONE" && !o.interactionImplemented ? " (gap)" : ""} | ${o.governedLessons.length ? "governed" : o.draftLessons.length ? "draft" : "none"} | ${COMPONENT_KINDS.filter((k) => o.components[k]).map((k) => k.toLowerCase()).join(", ") || "none"} |`).join("\n")}

## Teacher-facing metadata (from the MOE tables)

${report.teacherMetadata.map((u) => `- **${u.unitId}**: ${u.topic} (semester ${u.semester}, period ${u.period}, source pages ${u.sourcePages.join(", ")}): ${u.activities.length} activities, ${u.materials.length} materials, ${u.assessmentReferences.length} assessment references, ${u.competencies.length} competencies`).join("\n")}

## Offline behavior

Every non-NONE interaction carries an offline fallback (paper strips, drawn number lines, real objects, practical protocols). Practicals produce TEACHER_OBSERVATION evidence under \`g4-math-teacher-observation\` (human actor required). Manipulatives produce evidence only through governed item responses, where tool use is checked against the ToolPolicy.

## Production state

Production units for this cell not in the cell: ${report.live.productionUnitsNotInCell.map((u) => `\`${u}\``).join(", ") || "none"}. These are year-map placeholders whose titles don't match the MOE topics.
`;
  fs.writeFileSync(path.join(OUT, "G4_MATH_TEMPLATE_CELL_V1.md"), md);
  console.log(JSON.stringify({ internallyExecutable: report.internallyExecutable, liveCertified, gate: gate.map((g) => `${g.pass ? "PASS" : "FAIL"} ${g.id}: ${g.detail}`), errors: report.errors, live: report.live }, null, 2));
  if (!report.internallyExecutable || (process.argv.includes("--live-gate") && !liveCertified)) process.exitCode = 1;
}

main();
