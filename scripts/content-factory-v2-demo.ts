import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { candidateBundle } from "../lib/content-factory/v2/demo";
import { reviewerAssessmentPreview } from "../lib/content-factory/v2/quality";
import { runFactory } from "../lib/content-factory/v2/manager";
import { demoBlueprint, demoExecutors } from "../lib/content-factory/v2/demo";
import { digest } from "../lib/content-factory/v2/blueprint";

async function main() {
  const output = path.resolve("artifacts/content-factory-v2/demo");
  await mkdir(output, { recursive: true });
  // Retain every run's audit and content together. Regeneration never overwrites prior artifacts.
  const runDirectory = path.join(output, `run-${Date.now()}`);
  await mkdir(runDirectory);
  const result = await runFactory({ blueprint: demoBlueprint(), executors: demoExecutors(), appendAudit: async event => {
    await writeFile(path.join(runDirectory, `event-${String(event.sequence).padStart(3, "0")}.json`), `${JSON.stringify(event, null, 2)}\n`, { flag: "wx" });
  }, persistArtifact: async artifact => {
    await writeFile(path.join(runDirectory, `artifact-${artifact.id}.json`), `${JSON.stringify(artifact, null, 2)}\n`, { flag: "wx" });
  } });
  const safe = result.artifacts.map(artifact => {
    const { payload, contentHash, ...envelope } = artifact;
    // Reviewer preview only. This is not an admitted offline package or learner route.
    const projection = { ...envelope, sourceContentHash: contentHash, payload: payload.kind === "ASSESSMENT" ? { kind: "ASSESSMENT_REFERENCE", definitionId: payload.definition.definitionId, definitionVersion: payload.definition.version, contentHash: payload.definition.contentHash, formId: payload.form.formId, formHash: payload.form.formHash, itemPins: payload.form.items } : payload };
    return { ...projection, projectionHash: digest("factory-review-projection/2.0.0", projection) };
  });
  const protectedArtifacts = result.artifacts.filter(a => a.payload.kind === "ASSESSMENT");
  const files: Record<string, unknown> = {
    "unit-blueprint.json": result.blueprint,
    "candidate-resources.json": safe,
    "REVIEWER_ONLY-assessment-material.json": protectedArtifacts,
    "candidate-bundle.json": candidateBundle(result.blueprint, result.artifacts),
    "assessment-keyless-review-preview.json": { blueprint: { blueprintId: result.blueprint.blueprintId, version: result.blueprint.version, contentHash: result.blueprint.contentHash }, label: "REVIEWER_PREVIEW_UNRELEASED", official: false, items: reviewerAssessmentPreview(result.artifacts) },
    "quality-report.json": result.quality,
    "audit-events.json": result.events,
    "manifest.json": { status: result.status, generationMode: "LOCAL_DETERMINISTIC_TEMPLATES_SYNTHETIC_CONTENT", blueprint: { id: result.blueprint.blueprintId, version: result.blueprint.version, contentHash: result.blueprint.contentHash }, artifacts: result.artifacts.map(a => ({ id: a.id, version: a.version, contentHash: a.contentHash })), reviewerIndependence: result.reviewerIndependence, audience: "AUTHORIZED_REVIEWERS_ONLY", official: false, liveProductionInventory: "NOT_ACCESSED", runDirectory: path.relative(process.cwd(), runDirectory).replaceAll("\\", "/") },
  };
  for (const [file, data] of Object.entries(files)) await writeFile(path.join(runDirectory, file), `${JSON.stringify(data, null, 2)}\n`, { flag: "wx" });
  const markdown = result.artifacts.filter(a => a.payload.kind !== "ASSESSMENT").map(a => {
    const p = a.payload;
    if (p.kind === "DOCUMENT") return `## ${p.title}\n\n${p.sections.map(s => `### ${s.heading}\n\n${s.text}`).join("\n\n")}`;
    if (p.kind === "LESSON") return `## ${p.candidate.title}\n\n${p.candidate.scenes.map(s => `### ${s.title}\n\n${s.content.body}\n\n${s.interaction.kind === "FREE_RESPONSE" ? s.interaction.prompts.map(p => p.prompt).join("\n") : ""}`).join("\n\n")}`;
    if (p.kind === "ACTIVITY") return `## ${p.definition.content.title}\n\n${p.definition.content.instructions.learner.map((s, i) => `${i + 1}. ${s.text}`).join("\n")}`;
    return "";
  }).join("\n\n");
  await writeFile(path.join(runDirectory, "REVIEWER_PACKAGE.md"), `# Grade 7 candidate unit\n\nUNRELEASED. Authorized reviewer demonstration only. Not an official curriculum, assessment or evidence of student learning.\n\nBlueprint ${result.blueprint.blueprintId}@${result.blueprint.version}, SHA-256 ${result.blueprint.contentHash}. All generated resources pin this revision. Protected scoring is in the separate REVIEWER_ONLY file.\n\n${markdown}\n\n## Release blockers\n\n${result.quality.releaseBlockers.map(g => `- ${g}`).join("\n")}\n`, { flag: "wx" });
  await writeFile(path.join(output, "latest.json"), `${JSON.stringify({ runDirectory: path.relative(output, runDirectory).replaceAll("\\", "/") })}\n`);
  process.stdout.write(`${JSON.stringify({ status: result.status, artifactCount: result.artifacts.length, failures: result.quality.failures, output: path.relative(process.cwd(), runDirectory) })}\n`);
  if (result.status !== "AWAITING_HUMAN_REVIEW") process.exitCode = 1;
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "demo_failed"}\n`); process.exitCode = 1; });
