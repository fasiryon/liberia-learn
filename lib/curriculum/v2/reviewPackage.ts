/**
 * Curriculum V2 review package: what a qualified human reviewer needs to judge one structured
 * lesson revision. It extends the existing curriculum review practice (curriculum/review/*):
 * the package informs a decision; the decision itself is recorded through the governed
 * HUMAN_REVIEW approval of the exact revision, never by editing this file.
 */
import type { CurriculumLessonV2 } from "./contract";
import { RUNTIME_SCENARIOS, type SceneDeliverability } from "./deliverability";
import { words } from "./validate";

const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n+/g, " ");

export function reviewPackageMarkdown(input: { lesson: CurriculumLessonV2; status: string; deliverability: readonly SceneDeliverability[]; artifactHash: string }): string {
  const { lesson } = input;
  const out: string[] = [];
  out.push(`# ${lesson.identity.title}`, "");
  out.push(`- Lesson: \`${lesson.identity.lessonId}\` v${lesson.identity.version} · Grade ${lesson.identity.grade} ${lesson.identity.subject} · unit \`${lesson.identity.unitId}\``);
  out.push(`- Pipeline status: **${input.status}** · governance: ${lesson.governance.state}, human review required, not published, MOE approval not claimed`);
  out.push(`- Artifact hash: \`${input.artifactHash}\` (approve this exact revision only)`);
  out.push(`- Pinned context: release \`${lesson.authoring.releaseId}\` (identity \`${lesson.authoring.releaseIdentity.slice(0, 16)}…\`), cell \`${lesson.authoring.cellId}@${lesson.authoring.cellVersion}\`, context \`${lesson.authoring.contextHash.slice(0, 16)}…\``);
  out.push(`- Source: \`${lesson.authoring.source.sourceMember}\` (archive \`${lesson.authoring.source.archiveChecksum.slice(0, 12)}…\`)`);
  out.push(`- Provenance: ${lesson.provenance.origin} by ${lesson.provenance.generatorName}@${lesson.provenance.generatorVersion}; prompt ${lesson.provenance.promptKey ?? "none"}@${lesson.provenance.promptVersion ?? "-"}; candidate \`${lesson.provenance.candidateSha256.slice(0, 16)}…\``);
  if (lesson.pedagogy) out.push(`- Strategy: ${lesson.pedagogy.primaryStrategy} — ${lesson.pedagogy.rationale}`);
  const migration = lesson.provenance.migration;
  if (migration) {
    out.push(`- Migrated from \`${migration.sourceContentId}\` v${migration.sourceVersion} (source \`${migration.sourceSha256.slice(0, 16)}…\`) by ${migration.adapterVersion}`);
    out.push(`- Section map: ${migration.sectionMap.map((entry) => `${entry.from} → ${entry.toSceneId ?? "not mapped"}`).join("; ")}`);
    out.push(`- Omitted: ${migration.omissions.join("; ")}`);
  }
  out.push("", "## Objective alignment", "");
  out.push("| Objective | Statement (MOE source) | Source | Concepts | Standards / skills |", "| --- | --- | --- | --- | --- |");
  for (const objective of lesson.objectives) out.push(`| \`${objective.id}\` | ${cell(objective.statement)} | p.${objective.sourcePages.join(",")} (${objective.sourceConfidence}) | ${objective.conceptIds.join(", ") || "— (unbound)"} | ${[...objective.standardCodes, ...objective.skillIds].join(", ") || "— (unbound)"} |`);
  if (lesson.prerequisites.conceptIds.length || lesson.prerequisites.assumptions.length) {
    out.push("", "Prerequisites:", ...lesson.prerequisites.conceptIds.map((id) => `- concept \`${id}\``), ...lesson.prerequisites.assumptions.map((text) => `- ${text}`));
  }
  out.push("", "## Scene sequence", "");
  out.push("| # | Scene | Type / purpose | Objectives | Interaction | Words | Tools | Evidence | Offline |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  lesson.scenes.forEach((scene, index) => {
    const evidence = scene.evidence.kind === "NONE" ? "—" : `${scene.evidence.kind} (${scene.evidence.evidenceType}): ${scene.evidence.responses.map((response) => `${response.responseKey}→${response.objectiveId.split("-").slice(-1)[0]}`).join(", ")}`;
    out.push(`| ${index + 1} | ${cell(scene.title)} | ${scene.type} / ${scene.purpose} | ${scene.objectiveIds.map((id) => id.split("-").slice(-1)[0]).join(", ") || "—"} | ${scene.interaction.kind}${scene.fallback ? ` (fallback: ${scene.fallback.kind})` : ""} | ${words(scene.content.body)} | ${scene.tools.requested.join(", ") || "—"}${scene.tools.prohibited.length ? `; prohibits ${scene.tools.prohibited.join(", ")}` : ""} | ${cell(evidence)} | ${scene.offline.mode} |`);
  });
  out.push("", "## Scenes in full", "");
  for (const scene of lesson.scenes) {
    out.push(`### ${scene.title} (\`${scene.id}\`)`, "", `Learner action: ${scene.learnerAction}`, "", scene.content.body, "");
    if (scene.content.keyPoints?.length) out.push(...scene.content.keyPoints.map((point) => `- ${point}`), "");
    const interaction = scene.interaction;
    if (interaction.kind === "DIAGRAM_REVEAL") out.push(...interaction.steps.map((step, i) => `${i + 1}. **${step.label}** — ${step.description}`), "");
    if (interaction.kind === "SINGLE_CHOICE") for (const item of interaction.items) out.push(`- ${item.prompt} — options: ${item.options.map((option) => `${option.text}${option.id === item.formativeKey.expectedOptionId ? " (expected)" : ""}`).join(" / ")}`);
    if (interaction.kind === "FREE_RESPONSE") out.push(...interaction.prompts.map((prompt) => `- ${prompt.prompt} (min ${prompt.minLength} chars)`));
    if ("elements" in interaction) out.push(`- Requested ${interaction.kind}: ${interaction.prompt} [${interaction.elements.join("; ")}]`);
    if (scene.fallback) out.push(`- Fallback (${scene.fallback.kind}, objective preserved: ${scene.fallback.objectivePreserved}): ${scene.fallback.content}`);
    if (scene.expectedObservation) out.push(`- Expected observation (reviewer only): ${scene.expectedObservation}`);
    if (scene.hints.length) out.push(`- Hints: ${scene.hints.join(" | ")}`);
    if (scene.media?.length) out.push(...scene.media.map((media) => `- Media ${media.kind} (${media.requirement}): ${media.description} — alt: ${media.altText}`));
    out.push(`- Accessibility: ${scene.accessibility.textAlternative} · keyboard: ${scene.accessibility.keyboardPath}${scene.accessibility.nonPointerAlternative ? ` · non-pointer: ${scene.accessibility.nonPointerAlternative}` : ""}`);
    out.push(`- Offline (${scene.offline.mode}): ${scene.offline.note}`, "");
  }
  out.push("## Misconceptions", "");
  out.push(...(lesson.misconceptions.length ? lesson.misconceptions.map((m) => `- \`${m.id}\` (${m.objectiveId.split("-").slice(-1)[0]}): ${m.description} → ${m.response}`) : ["- none declared"]));
  out.push("", "## Lab candidate links", "");
  out.push(...(lesson.labLinks.length ? lesson.labLinks.map((entry) => `- \`${entry.link.experience.labId}@${entry.link.experience.labVersion}\` for \`${entry.link.objectiveIds.join(", ")}\` at scene \`${entry.link.placement.sceneId}\` — status ${entry.link.status}; student eligible: ${entry.eligibility.studentEligible} (${entry.eligibility.reasons.join(", ")}); checks: ${entry.link.evidenceMapping.map((mapping) => mapping.labCheckId).join(", ") || "none"}. ${entry.rationale}`) : ["- none"]));
  out.push("", "## Assessment handoffs (Assessment Player V2)", "");
  out.push(...lesson.assessmentHandoffs.map((handoff) => `- \`${handoff.requestId}\`: ${handoff.interaction}, ${handoff.evidenceType}, ${handoff.difficulty}; scoring ${handoff.scoring}; governed items: ${handoff.governedItems.map((item) => `${item.itemId}@${item.itemVersion}`).join(", ") || "none yet"}; tools allowed ${handoff.tools.allowed.join(", ") || "none"}, prohibited ${handoff.tools.prohibited.join(", ") || "none"}; offline ${handoff.offline}`));
  out.push("", "## Runtime deliverability", "", `| Scene | ${RUNTIME_SCENARIOS.join(" | ")} |`, `| --- | ${RUNTIME_SCENARIOS.map(() => "---").join(" | ")} |`);
  for (const report of input.deliverability) out.push(`| ${report.sceneId} | ${RUNTIME_SCENARIOS.map((scenario) => report.byScenario[scenario]).join(" | ")} |`);
  out.push("", "## Review gaps", "");
  out.push(...(lesson.reviewGaps.length ? lesson.reviewGaps.map((gap) => `- **${gap.severity}** ${gap.code}${gap.sceneId ? ` (\`${gap.sceneId}\`)` : ""}: ${gap.detail}`) : ["- none"]));
  out.push("", "## Reviewer decision", "", "Record APPROVE / REVISE / REJECT through the governed curriculum review for this exact artifact hash. Approval requires HUMAN_REVIEW by a qualified reviewer; automated, policy and AI review cannot approve native Curriculum V2.", "");
  return out.join("\n");
}
