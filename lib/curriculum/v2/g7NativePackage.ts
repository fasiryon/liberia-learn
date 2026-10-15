/**
 * Builds the committed Grade 7 Native Curriculum V1 review package (curriculum/review/g7-native-v1/).
 * Deterministic: tests regenerate it in memory and fail when the committed files are stale, so the
 * package always describes exactly what the candidates and code produce.
 *
 * The package informs a qualified human reviewer. It records no decision: approval is recorded only
 * through governed curriculum review (HUMAN_REVIEW) against the exact hashes listed here, and release
 * binding needs authority this repository does not have yet (see release-binding.json).
 */
import { readFileSync } from "fs";
import path from "path";
import type { CurriculumOntologyRelease } from "@/lib/learning-authority/governedGrade4Math";
import { validateReleaseManifest, type ReleaseManifest } from "@/lib/learning-authority/releaseManifests";
import { CANDIDATE_LESSON_V2_CONTRACT, CURRICULUM_LESSON_V2_CONTRACT } from "./contract";
import { RUNTIME_SCENARIOS } from "./deliverability";
import {
  evaluateG7Candidate, G7_ASSET_DIR, G7_AUTHORED_AT, G7_CANDIDATE_DIR, G7_CANDIDATE_VERSION, G7_NATIVE_LESSONS, G7_NATIVE_PACKAGE_VERSION,
  g7LearnerProjection, sha256, textFileSha256, type G7CandidateOutcome, type G7NativeLesson,
} from "./g7Native";
import { G7_EXIT_ITEMS, G7_REVISION_LEDGER, G7_WRITING_RUBRIC } from "./g7NativeReview";
import { sceneDetailLines } from "./reviewPackage";
import { words } from "./validate";

export const G7_PACKAGE_DIR = "curriculum/review/g7-native-v1";

const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n+/g, " ");
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** Candidate release identifiers: "candidate" marks them as unregistered; no "moe" because no MOE authority is claimed. */
export function candidateReleaseId(lesson: G7NativeLesson): string {
  return lesson.subject === "MATH" ? "lr-candidate-g7-math-number-sense-2026.1" : "lr-candidate-g7-literacy-essay-writing-2026.1";
}

export function candidateReleaseManifest(lesson: G7NativeLesson): ReleaseManifest {
  return {
    manifestVersion: "1.0.0",
    releaseId: candidateReleaseId(lesson),
    grade: 7,
    subject: lesson.subject,
    // No ontology release is attached: none exists, and none may be invented. UNKNOWN until an authorized reviewer sets it.
    provenance: { sourceRef: `${G7_PACKAGE_DIR}/${lesson.key}/review.md`, authority: "UNKNOWN", moeApprovalStatus: "NOT_CLAIMED" },
  };
}

function sceneManifest(outcome: G7CandidateOutcome) {
  const { lesson, candidate } = outcome;
  const projection = g7LearnerProjection(lesson, candidate);
  return {
    packageVersion: G7_NATIVE_PACKAGE_VERSION,
    lessonId: lesson.lessonId,
    candidateVersion: G7_CANDIDATE_VERSION,
    contracts: { candidate: CANDIDATE_LESSON_V2_CONTRACT, assembledTarget: CURRICULUM_LESSON_V2_CONTRACT, learnerProjection: projection.contractVersion },
    authoredAt: G7_AUTHORED_AT,
    origin: "AUTHORED_FIXTURE",
    candidate: { path: `${G7_CANDIDATE_DIR}/${lesson.file}`, sha256: outcome.candidateSha256 },
    learnerProjection: { path: `${G7_PACKAGE_DIR}/${lesson.key}/learner-projection.json`, sha256: sha256(projection) },
    assessmentReview: { path: `${G7_PACKAGE_DIR}/${lesson.key}/assessment-review.json`, sha256: sha256(assessmentReview(lesson)) },
    scenes: candidate.scenes.map((scene, index) => ({
      position: index + 1, id: scene.id, type: scene.type, purpose: scene.purpose, objectiveIds: scene.objectiveIds, interaction: scene.interaction.kind,
      fallback: scene.fallback?.kind ?? null, evidence: scene.evidence.kind, completion: scene.completion, words: words(scene.content.body), sha256: sha256(scene),
      media: (scene.media ?? []).map((media) => ({ id: media.id, kind: media.kind, requirement: media.requirement, asset: lesson.assets[media.id] ? { path: `${G7_ASSET_DIR}/${lesson.assets[media.id]}`, sha256: textFileSha256(`${G7_ASSET_DIR}/${lesson.assets[media.id]}`), governance: "CANDIDATE_ASSET_REVIEW_REQUIRED" } : null })),
    })),
    sources: [
      { path: lesson.legacy.snapshot.path, role: "Read-only metadata of the legacy row (body not included)", sha256: sha256(JSON.parse(readFileSync(path.join(process.cwd(), lesson.legacy.snapshot.path), "utf8"))) },
      { path: "curriculum/structured/moe-structured-v1.json", role: "Structured MOE source (objective relationships)", sha256: sha256(JSON.parse(readFileSync(path.join(process.cwd(), "curriculum/structured/moe-structured-v1.json"), "utf8"))) },
      ...(lesson.subject === "LITERACY" ? [{ path: "curriculum/sources/ocr/GRADE-7-9--English-7-9.json", role: "OCR of MOE English 7-9 (Grade 7 paragraph writing, p.4)", sha256: sha256(JSON.parse(readFileSync(path.join(process.cwd(), "curriculum/sources/ocr/GRADE-7-9--English-7-9.json"), "utf8"))) }] : []),
      ...lesson.reusedMaterial.map((material) => ({ path: material.path, role: material.what, sha256: textFileSha256(material.path) })),
    ],
    governance: { state: "DRAFT", humanReviewRequired: true, published: false, moeApprovalState: "NOT_CLAIMED", requiredApprovalBasis: "HUMAN_REVIEW", qualifiedReview: "NOT_STARTED", publication: "DISABLED" },
  };
}

function assessmentReview(lesson: G7NativeLesson) {
  return {
    audience: "REVIEWER_ONLY",
    notice: "Contains answer keys. Never include in a learner projection, offline package or client bundle.",
    lessonKey: lesson.key,
    itemShape: "GovernedItem (lib/learning-authority/governedGrade4Math.ts)",
    items: G7_EXIT_ITEMS[lesson.key].map((entry) => ({ ...entry, sha256: sha256(entry.item) })),
    ...(G7_WRITING_RUBRIC.lessonKey === lesson.key ? { writingRubric: G7_WRITING_RUBRIC } : {}),
  };
}

function reviewMarkdown(outcome: G7CandidateOutcome): string {
  const { lesson, candidate } = outcome;
  const manifest = sceneManifest(outcome);
  const ledger = G7_REVISION_LEDGER[lesson.key];
  const out: string[] = [];
  out.push(`# ${candidate.title}`, "");
  out.push(`- Candidate: \`${lesson.lessonId}\` v${G7_CANDIDATE_VERSION} · Grade 7 ${lesson.subject} · ${lesson.strand}`);
  out.push(`- Pipeline status: **${outcome.status}** · governance: DRAFT, human review required, not published, MOE approval not claimed, qualified review not started`);
  out.push(`- Candidate hash: \`${outcome.candidateSha256}\` · learner projection hash: \`${manifest.learnerProjection.sha256}\` (review this exact revision only)`);
  out.push(`- Origin: AUTHORED_FIXTURE in the \`${CANDIDATE_LESSON_V2_CONTRACT}\` generator format (no live model call); strict parser, deterministic validator and deliverability checks passed with ${outcome.errors.length} errors`);
  out.push(`- Not assembled into \`${CURRICULUM_LESSON_V2_CONTRACT}\`: assembly needs a Grade 7 template cell and ontology release that do not exist (see Review gaps)`);
  if (candidate.pedagogy) out.push(`- Strategy: ${candidate.pedagogy.primaryStrategy} — ${candidate.pedagogy.rationale}`);
  out.push("", "## Source and provenance", "");
  const legacy = lesson.legacy;
  out.push(`- Legacy row (not modified): \`${legacy.contentId}\` (pk \`${legacy.contentPk}\`), "${legacy.title}", status ${legacy.status}, payload approval ${legacy.payloadApprovalStatus ?? "none"}, unit \`${legacy.unitId}\`, ${legacy.sectionCount} sections, current revision \`${legacy.currentRevisionId}\``);
  out.push(`- Unit verification: ${legacy.unitVerification}`);
  out.push(`- Recorded from \`${legacy.snapshot.path}\` (captured ${legacy.snapshot.capturedAt}). Learner history attached to the legacy row: ${legacy.learnerReferences.map((ref) => `${ref.table} ${ref.rows} (${ref.policy})`).join(", ")}. The candidate never touches these rows.`);
  out.push("- The legacy lesson body was **not available** to the author (no database access). Preservation of correct legacy material is therefore unverified; see the revision ledger.");
  for (const material of lesson.reusedMaterial) out.push(`- Reused repository material: \`${material.path}\` — ${material.what}`);
  out.push("", "## Objective alignment", "");
  out.push("No structured MOE Grade 7 OBJECTIVE item matches this lesson. Its objectives are LiberiaLearn candidates; each MOE item below is a relationship, not a binding.", "");
  out.push("| Candidate objective | Statement | MOE relationships (verbatim source text) |", "| --- | --- | --- |");
  for (const objective of lesson.objectives) {
    const refs = objective.moeReferences.map((ref) => `${ref.relation}: ${ref.moeItemId ? `\`${ref.moeItemId}\`` : "OCR only (no structured item)"} — G${ref.grade}, ${ref.sourceMember} p.${ref.pages.join(",")} — "${cell(ref.text)}"`).join("<br>");
    out.push(`| \`${objective.id}\` | ${cell(objective.statement)} | ${refs} |`);
  }
  out.push("", "Prerequisites assumed:", ...candidate.prerequisiteAssumptions.map((text) => `- ${text}`));
  out.push("", "## Teaching sequence and scene manifest", "");
  out.push("| # | Scene | Type / purpose | Objectives | Interaction | Evidence | Words | Visual | Scene hash |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const scene of manifest.scenes) {
    const visual = scene.media.map((media) => media.asset ? `\`${path.basename(media.asset.path)}\`` : media.id).join(", ") || "—";
    out.push(`| ${scene.position} | \`${scene.id}\` | ${scene.type} / ${scene.purpose} | ${scene.objectiveIds.map((id) => `\`${id.replace(/^ll-g7-(math|lit)-/, "")}\``).join(", ") || "—"} | ${scene.interaction}${scene.fallback ? ` (fallback ${scene.fallback})` : ""} | ${scene.evidence} | ${scene.words} | ${visual} | \`${scene.sha256.slice(0, 12)}…\` |`);
  }
  out.push("", "Full hashes, asset digests and source digests are in `scene-manifest.json`.", "");
  out.push("## Scenes in full", "", ...sceneDetailLines(candidate.scenes));
  out.push("## Misconceptions", "", ...candidate.misconceptions.map((m) => `- \`${m.id}\` (\`${m.objectiveId}\`): ${m.description} → ${m.response}`));
  out.push("", "## Assessment handoff (Assessment Player V2)", "");
  for (const request of candidate.assessmentRequests) out.push(`- \`${request.id}\`: ${request.interaction}, ${request.evidenceType}, ${request.difficulty}; scoring SERVER_AUTHORITY; governed items: none yet; ${G7_EXIT_ITEMS[lesson.key].length} candidate items in [assessment-review.md](assessment-review.md) (reviewer only); tools prohibited ${request.tools.prohibited.join(", ") || "none"}; offline ${request.offline}`);
  out.push("", "## Instructional revision ledger", "");
  out.push(`- Title: "${ledger.titleRevision.from}" → "${ledger.titleRevision.to}". ${ledger.titleRevision.rationale}`);
  out.push(`- Legacy body comparison: **${ledger.legacyComparison}** (revision \`${legacy.currentRevisionId}\`).`, "");
  out.push("| Scene | Change | Source | Rationale |", "| --- | --- | --- | --- |", ...ledger.entries.map((entry) => `| \`${entry.sceneId}\` | ${entry.change} | ${cell(entry.source)} | ${cell(entry.rationale)} |`));
  out.push("", "## Runtime deliverability (Lesson Player V2 today)", "", `| Scene | ${RUNTIME_SCENARIOS.join(" | ")} |`, `| --- | ${RUNTIME_SCENARIOS.map(() => "---").join(" | ")} |`);
  for (const report of outcome.deliverability) out.push(`| ${report.sceneId} | ${RUNTIME_SCENARIOS.map((scenario) => report.byScenario[scenario]).join(" | ")} |`);
  out.push("", "## Review gaps", "", ...outcome.gaps.map((gap) => `- **${gap.severity}** ${gap.code}${gap.sceneId ? ` (\`${gap.sceneId}\`)` : ""}: ${gap.detail}`));
  out.push("", "## Reviewer decision", "", "Use [reviewer-checklist.md](reviewer-checklist.md). Record APPROVE / REVISE / REJECT only through governed curriculum review for the exact candidate hash above. Approval requires HUMAN_REVIEW by a qualified reviewer; automated, policy and AI review cannot approve native Curriculum V2, and nothing in this folder is a decision.", "");
  return out.join("\n");
}

function assessmentMarkdown(lesson: G7NativeLesson): string {
  const review = assessmentReview(lesson);
  const out: string[] = [`# Exit-ticket review — ${lesson.key}`, "", "**REVIEWER ONLY. Contains answer keys.** These items are never part of the learner projection, offline package or client bundle. They are candidates in the governed item shape; Assessment Player V2 cannot score them until a qualified reviewer approves them and a Grade 7 ontology release binds them.", ""];
  review.items.forEach((entry, index) => {
    out.push(`## ${index + 1}. \`${entry.item.id}@${entry.item.version}\` → \`${entry.objectiveId}\``, "", entry.item.prompt, "");
    entry.item.options.forEach((option, optionIndex) => out.push(`- ${optionIndex === entry.item.correctIndex ? "**[key]** " : ""}${option}${entry.distractorMisconceptions[optionIndex] ? ` _(catches \`${entry.distractorMisconceptions[optionIndex]}\`)_` : ""}`));
    out.push("", `- Hint (released after scoring): ${entry.item.hint}`, `- Worked example (released after scoring): ${entry.item.workedExample}`, `- Machine verification: ${entry.verification ? `${entry.verification.kind} (checked by __tests__/curriculum-v2-g7-native.test.ts)` : "none — reviewer judgement"}`, `- Item hash: \`${entry.sha256}\``, "");
  });
  if ("writingRubric" in review && review.writingRubric) {
    const rubric = review.writingRubric;
    out.push(`## Writing rubric — scene \`${rubric.sceneId}\``, "", rubric.use, "", "| Criterion | Secure | Developing | Beginning |", "| --- | --- | --- | --- |", ...rubric.criteria.map((criterion) => `| ${criterion.label} | ${cell(criterion.secure)} | ${cell(criterion.developing)} | ${cell(criterion.beginning)} |`), "");
  }
  return out.join("\n");
}

function checklistMarkdown(outcome: G7CandidateOutcome): string {
  const { lesson } = outcome;
  const literacy = lesson.subject === "LITERACY";
  const box = (text: string) => `- [ ] ${text}`;
  return [
    `# Reviewer checklist — ${outcome.candidate.title}`, "",
    `Candidate \`${lesson.lessonId}\` v${G7_CANDIDATE_VERSION}, candidate hash \`${outcome.candidateSha256}\`.`, "",
    "| Field | Value |", "| --- | --- |",
    "| Status | CANDIDATE ONLY |", "| Qualified review | NOT STARTED (no reviewer assigned) |", "| Approval | NONE |", "| MOE approval | NOT CLAIMED |", "| Publication | DISABLED |", "| Release | NONE (candidate manifest only, see ../release-binding.json) |", "",
    "A qualified reviewer completes this list through governed curriculum review. Ticking boxes in this file records nothing.", "",
    "## Instructional correctness", "",
    box(literacy ? "Every model sentence, thesis and PEEL paragraph is grammatical and models the skill it claims to model." : "Every number, place name, expanded form and word form in the scenes is correct."),
    box("Every formative item has exactly one defensible expected option, and every option's feedback is accurate."),
    box("Every exit-ticket key in assessment-review.md is correct and each distractor is plausible but clearly wrong."),
    box(literacy ? "Evidence examples are framed as examples and no statement presents an unverified fact or figure as true." : "Machine verifications passed (see the test) and the reviewer agrees with the word-form convention used (\"and twenty-seven hundredths\" / \"point two seven\")."),
    box("Explanations are no longer than needed and the sequence moves from modelled to guided to independent work."),
    "", "## Accessibility", "",
    box("Each scene's text alternative teaches the same idea without the diagram."),
    box("Each diagram's alt text matches the diagram exactly (assets listed in scene-manifest.json)."),
    box("All interactions work with keyboard only and with a screen reader; declared-but-unrendered interactions have a usable written fallback."),
    box("Reading level suits Grade 7 learners, including those still building English fluency."),
    box("Screens were checked at phone width (390 px) and desktop width (see artifacts/g7-native-curriculum-v1/screenshots)."),
    "", "## Liberian relevance", "",
    box(literacy ? "The school-garden, PTA, library and reading-time contexts are realistic for Liberian schools and communities." : "The library fund in Liberian dollars, market weights and cocoa cooperative contexts are realistic and respectful."),
    box("Names, places and money are used correctly; no context stereotypes a county, group or gender."),
    box("Activities work in a classroom with no devices (paper chart, counters, teacher-read questions)."),
    "", ...curriculumMappingDecisions(lesson, box),
    "", "## Decision (recorded only in governed review)", "",
    "- APPROVE requires: all boxes above, closed BLOCKING gaps, a Grade 7 template cell and ontology release, released exit-ticket items.",
    "- REVISE: list scene ids and changes; the author edits the candidate and the package is regenerated with new hashes.",
    "- REJECT: state why; the legacy row remains as it is.", "",
  ].join("\n");
}

export function releaseBindingPlan() {
  const lessons = G7_NATIVE_LESSONS.map((lesson) => {
    const outcome = evaluateG7Candidate(lesson);
    const manifest = candidateReleaseManifest(lesson);
    const report = validateReleaseManifest(manifest);
    const projection = g7LearnerProjection(lesson, outcome.candidate);
    const prefix = lesson.subject === "MATH" ? "g7-math" : "g7-lit";
    const toolProhibited = [...new Set(outcome.candidate.assessmentRequests.flatMap((request) => request.tools.prohibited))];
    return {
      lessonKey: lesson.key,
      manifest,
      manifestValidation: { ok: report.ok, identity: report.identity, errors: report.errors, warnings: report.warnings, coverageGaps: report.gaps.length },
      proposedBindings: {
        note: "Shapes follow CurriculumOntologyRelease (governedGrade4Math.ts). Every PROPOSED value needs reviewer acceptance; every REQUIRED_FROM_AUTHORITY value must come from an authorized source and cannot be generated.",
        concepts: lesson.objectives.map((objective) => ({ proposedConceptId: `${prefix}-${objective.id.replace(/^ll-g7-(math|lit)-/, "")}`, revision: 1, label: objective.statement, objectiveId: objective.id, status: "PROPOSED" })),
        contentBinding: { contentId: lesson.lessonId, contentVersion: G7_CANDIDATE_VERSION, contentType: "LESSON", candidateSha256: outcome.candidateSha256, learnerProjectionSha256: sha256(projection), contentSha256: "REQUIRED_FROM_AUTHORITY: digest of the assembled CurriculumLessonV2 once a template cell and release exist", toolPolicyId: `${prefix}-instruction-tools`, status: "PROPOSED" },
        constructBindings: G7_EXIT_ITEMS[lesson.key].map((entry) => ({
          itemId: entry.item.id, itemVersion: entry.item.version, itemSha256: sha256(entry.item), objectiveId: entry.objectiveId,
          conceptId: `PROPOSED:${prefix}-${entry.objectiveId.replace(/^ll-g7-(math|lit)-/, "")}`, skillId: "REQUIRED_FROM_AUTHORITY", learningTargetCode: "REQUIRED_FROM_AUTHORITY", standardCode: "REQUIRED_FROM_AUTHORITY",
          evidencePolicyId: "REQUIRED_FROM_AUTHORITY: exit-ticket context (GovernedItem.context is DIAGNOSTIC | PRACTICE; candidates use PRACTICE pending decision)",
          toolPolicyId: `${prefix}-exit-ticket-tools`,
        })),
        toolPolicies: [
          { id: `${prefix}-instruction-tools`, context: "INSTRUCTION", allowed: [...new Set(outcome.candidate.scenes.filter((scene) => scene.type !== "MASTERY_CHECK").flatMap((scene) => scene.tools.requested))], prohibited: [], status: "PROPOSED" },
          { id: `${prefix}-exit-ticket-tools`, context: "CONTROLLED_ASSESSMENT", allowed: [], prohibited: toolProhibited, status: "PROPOSED" },
        ],
      },
      requiredFromQualifiedReviewer: [
        "HUMAN_REVIEW of the exact candidate hash by an identified, qualified curriculum reviewer (lib/curriculum/v2/governance.ts).",
        "Objective basis decision: accept the LiberiaLearn candidate objectives with their MOE relationships, or rebind to MOE objectives.",
        ...(lesson.subject === "LITERACY" ? ["Grade-scope decision for argumentative writing (MOE Grade 9, p.32).", "Correction of the Grade 7 English paragraph-writing structuring defect through the source-structuring process."] : []),
        "Comparison with the legacy body revision and restoration of any correct legacy material.",
        "Approval, revision or rejection of each candidate exit-ticket item and its key.",
      ],
      requiredFromCurriculumAuthority: [
        `A governed Grade 7 ${lesson.subject} template cell (lib/learning-authority/cells) placing the objectives in a unit with interaction classifications.`,
        `A Grade 7 ${lesson.subject} ontology release (status PUBLISHED, reviewStatus APPROVED, a named authority) with concepts, standard/skill bindings, the approved items, an evidence policy and the tool policies.`,
        "Registration of that release in curriculum/releases/k12-scope.json (absent today; this package does not register anything).",
        "Assembly of the candidate into CurriculumLessonV2 against the new authoring context, producing the hash that a content binding pins.",
      ],
    };
  });
  return {
    packageVersion: G7_NATIVE_PACKAGE_VERSION,
    publication: "DISABLED",
    registeredInK12Scope: false,
    executableRelease: false,
    notice: "Candidate release manifests carry no ontology release. They validate under releaseManifests.ts as content-gap-only manifests and cannot execute, publish or score anything.",
    lessons,
  };
}

/** A release in the proposed shape that is not PUBLISHED/APPROVED can never execute (validateOntologyRelease fails closed). */
export function draftReleaseShape(lesson: G7NativeLesson): CurriculumOntologyRelease {
  return {
    id: candidateReleaseId(lesson), version: "2026.1-candidate", status: "DRAFT", reviewStatus: "PENDING", authority: "PLATFORM_REVIEW", provenanceRef: `${G7_PACKAGE_DIR}/${lesson.key}/review.md`,
    grade: 7, subject: lesson.subject, items: G7_EXIT_ITEMS[lesson.key].map((entry) => entry.item), concepts: [], prerequisites: [], bindings: [], contentBindings: [], evidencePolicies: [], toolPolicies: [],
  };
}

function bindingMarkdown(plan: ReturnType<typeof releaseBindingPlan>): string {
  const out: string[] = ["# Release-binding preparation — Grade 7 native V1", "", `Publication: **${plan.publication}**. Registered in k12-scope: **no**. Executable release: **no**.`, "", plan.notice, ""];
  for (const lesson of plan.lessons) {
    out.push(`## ${lesson.lessonKey}`, "", `- Candidate manifest \`${lesson.manifest.releaseId}\`: authority ${lesson.manifest.provenance.authority}, MOE approval ${lesson.manifest.provenance.moeApprovalStatus}`);
    out.push(`- validateReleaseManifest: ok=${lesson.manifestValidation.ok}, errors ${lesson.manifestValidation.errors.length ? lesson.manifestValidation.errors.join(", ") : "none"}, warnings ${lesson.manifestValidation.warnings.join(", ")}; identity \`${lesson.manifestValidation.identity}\``);
    out.push(`- Content binding (proposed): \`${lesson.proposedBindings.contentBinding.contentId}@${lesson.proposedBindings.contentBinding.contentVersion}\`, candidate \`${lesson.proposedBindings.contentBinding.candidateSha256}\``);
    out.push(`- Construct bindings (proposed): ${lesson.proposedBindings.constructBindings.map((binding) => `\`${binding.itemId}@${binding.itemVersion}\``).join(", ")}`);
    out.push("", "Required from the qualified reviewer:", ...lesson.requiredFromQualifiedReviewer.map((text) => `- ${text}`));
    out.push("", "Required from curriculum authority:", ...lesson.requiredFromCurriculumAuthority.map((text) => `- ${text}`), "");
  }
  return out.join("\n");
}

export function buildG7NativePackageFiles(): Map<string, string> {
  const files = new Map<string, string>();
  const rows: string[] = [];
  for (const lesson of G7_NATIVE_LESSONS) {
    const outcome = evaluateG7Candidate(lesson);
    const manifest = sceneManifest(outcome);
    files.set(`${lesson.key}/review.md`, reviewMarkdown(outcome));
    files.set(`${lesson.key}/scene-manifest.json`, json(manifest));
    files.set(`${lesson.key}/learner-projection.json`, json(g7LearnerProjection(lesson, outcome.candidate)));
    files.set(`${lesson.key}/assessment-review.json`, json(assessmentReview(lesson)));
    files.set(`${lesson.key}/assessment-review.md`, assessmentMarkdown(lesson));
    files.set(`${lesson.key}/reviewer-checklist.md`, checklistMarkdown(outcome));
    const blocking = outcome.gaps.filter((gap) => gap.severity === "BLOCKING").map((gap) => gap.code);
    rows.push(`| ${outcome.candidate.title} | \`${lesson.legacy.contentId}\` | ${outcome.status} | ${outcome.candidate.scenes.length} scenes, ${Object.keys(lesson.assets).length} diagrams | ${[...new Set(blocking)].join(", ")} | [review](${lesson.key}/review.md) · [checklist](${lesson.key}/reviewer-checklist.md) · [exit ticket](${lesson.key}/assessment-review.md) |`);
  }
  const plan = releaseBindingPlan();
  files.set("release-binding.json", json(plan));
  files.set("release-binding.md", bindingMarkdown(plan));
  files.set("README.md", [
    "# Grade 7 Native Curriculum V1 — candidate review packages",
    "",
    "Generated by `scripts/build-curriculum-v2-g7-native.ts` from `curriculum/v2/g7/candidates/`. Do not edit by hand: edit a candidate (or `lib/curriculum/v2/g7NativeReview.ts`) and regenerate with `npx tsx scripts/build-curriculum-v2-g7-native.ts`. A test fails if these files are stale.",
    "",
    "Every lesson here is a **DRAFT candidate**. None is reviewed, approved, released, published or MOE-approved, and the live legacy rows they may later replace are untouched. Candidates were written offline in the Curriculum V2 generator format (`AUTHORED_FIXTURE`) and passed the strict parser, deterministic validator and deliverability checks with zero errors. They are not assembled into `curriculum-lesson-v2`, because no Grade 7 template cell or ontology release exists; see each lesson's Authority gaps and [release-binding.md](release-binding.md).",
    "",
    "| Lesson | Legacy row (unchanged) | Status | Structure | Blocking gaps | Package |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "Files per lesson: `review.md` (provenance, alignment, full scenes, revision ledger, deliverability, gaps), `scene-manifest.json` (exact hashes of candidate, scenes, assets, projection and sources), `learner-projection.json` (what Lesson Player V2 would deliver; no exit-ticket keys), `assessment-review.*` (**reviewer only**: exit-ticket keys and rubric), `reviewer-checklist.md`.",
    "",
    "Dev-only preview (never in production builds): `LAB_REVIEW_HARNESS=1 npm run dev`, then `/lab-review/experience/cv2-cand-g7-math-number-sense-place-value` and `/lab-review/experience/cv2-cand-g7-literacy-essay-structure-argument`.",
    "",
  ].join("\n"));
  return files;
}

/** Every curriculum-mapping decision a qualified reviewer must make before any release binding, one box each. */
function curriculumMappingDecisions(lesson: G7NativeLesson, box: (text: string) => string): string[] {
  const literacy = lesson.subject === "LITERACY";
  const prefix = literacy ? "g7-lit" : "g7-math";
  const out: string[] = [
    "## Curriculum-mapping decisions", "",
    "Each decision is recorded through governed curriculum review. Until every box is decided, the lesson stays **candidate-only** with publication disabled. No MOE objective, template cell or release is bound by this package.", "",
    "### Lesson-level decisions", "",
    box(`Objective basis: accept the ${lesson.objectives.length} candidate objectives as a LiberiaLearn extension (with the MOE relationships below), or rebind the lesson to an existing MOE objective (name it).`),
    box(`Unit placement: \`${lesson.legacy.unitId}\` is a LiberiaLearn unit with no verified MOE match. Confirm it, or name the MOE Grade 7 period this lesson belongs to.`),
    ...(literacy ? [
      box("Grade scope: the MOE places argumentative composition (\"develop and defend a point of view\") in Grade 9 (English 7-9 p.32). Choose one: keep as a Grade 7 introduction, rescope to Grade 7 paragraph writing, or move the lesson to Grade 8/9."),
      box("Source structuring defect: the Grade 7 paragraph-writing objectives (English 7-9 p.4) are filed as ACTIVITY items under period I. Request correction through the source-structuring process (needed before any Grade 7 writing objective can bind)."),
    ] : [
      box("Scope: confirm that extending place value to the thousandths serves the MOE Grade 7 decimals, percents and fractions period (Math 7-9 p.10), or limit the lesson to whole numbers."),
    ]),
    box(`Legacy comparison: compare with legacy revision \`${lesson.legacy.currentRevisionId}\` (\`${lesson.legacy.contentId}\`) and list any correct legacy material to restore.`),
    "", "### Objective-by-objective mapping", "",
  ];
  for (const objective of lesson.objectives) {
    out.push(`**\`${objective.id}\`**: ${objective.statement}`, "");
    out.push(box("Statement: accept as worded / revise (give wording) / remove."));
    for (const reference of objective.moeReferences) {
      const source = `${reference.moeItemId ? `\`${reference.moeItemId}\`` : "OCR text only (no structured item)"}, G${reference.grade} p.${reference.pages.join(",")}: "${reference.text}"`;
      out.push(box(`${reference.relation}: ${source} — accept or reject this relationship.`));
    }
    out.push(box(`Proposed concept \`${prefix}-${objective.id.replace(/^ll-g7-(math|lit)-/, "")}\`: accept, rename, or map to an existing concept.`), "");
  }
  out.push("### Release-binding decisions (for the future Grade 7 release)", "",
    box("Release authority: name who authorizes the Grade 7 release (the candidate manifest says UNKNOWN; MOE approval is NOT CLAIMED)."),
    box("Standard, skill and learning-target codes for each exit-ticket item (all marked REQUIRED_FROM_AUTHORITY in ../release-binding.json)."),
    box("Exit-ticket evidence context: governed items allow DIAGNOSTIC or PRACTICE; candidates use PRACTICE pending this decision."),
    box("Tool policy: confirm the proposed instruction tools and the exit-ticket prohibitions in ../release-binding.json."),
    ...(literacy ? [box("Writing evidence: accept teacher-marked formative writing (rubric in assessment-review.md), since Assessment Player V2 has no constructed-response item type.")] : []),
    box("Publication: stays DISABLED until approval, template cell, ontology release and registration in curriculum/releases/k12-scope.json are all complete."),
  );
  return out;
}
