import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { FIRST_TEN_BASELINE, FIRST_TEN_INTAKE_VERSION, firstTenBlueprint, loadFirstTenSources, rawSha256 } from "../lib/content-factory/v2/firstTen";
import { digest } from "../lib/content-factory/v2/blueprint";

function main() {
  if (process.env.CONTENT_FACTORY_TEN_CANDIDATES !== "1") throw new Error("content_factory_ten_disabled");
  const [extractDirectory, outputDirectory, specFile] = process.argv.slice(2);
  if (!extractDirectory || !outputDirectory) throw new Error("Usage: <existing-extract-directory> <new-restricted-output-directory> [exact-spec.json]");
  const output = path.resolve(outputDirectory);
  const relative = path.relative(process.cwd(), output);
  if (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error("first_ten_source_output_must_be_outside_repository");
  const git = specFile ? null : spawnSync("git", ["show", `${FIRST_TEN_BASELINE.sourceCommit}:${FIRST_TEN_BASELINE.specPath}`]);
  if (git?.status) throw new Error("first_ten_baseline_git_object_unavailable_supply_exact_spec_file");
  const specBytes = specFile ? fs.readFileSync(specFile) : git!.stdout;
  const sources = loadFirstTenSources(specBytes, extractDirectory);
  // Validate the complete cohort and every blueprint before creating any output.
  const blueprints = sources.lessons.map((_, i) => firstTenBlueprint(sources, i));
  const inputHash = digest(FIRST_TEN_INTAKE_VERSION, { spec: sources.specSha256, manifest: sources.manifestSha256, extract: sources.extractSha256, blueprints: blueprints.map(b => b.contentHash) });
  if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink() || !fs.existsSync(path.join(output, "manifest.json"))) throw new Error("first_ten_intake_incomplete_or_linked_output");
    const existing = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    const { manifestHash, ...body } = existing;
    if (existing.inputHash !== inputHash || manifestHash !== digest(FIRST_TEN_INTAKE_VERSION, body)) throw new Error("first_ten_intake_immutable_or_tampered");
    const files = fs.readdirSync(output).filter(file => file !== "manifest.json").sort();
    if (JSON.stringify(files) !== JSON.stringify(Object.keys(existing.files).sort())) throw new Error("first_ten_intake_file_set_mismatch");
    for (const file of files) if (path.basename(file) !== file || fs.lstatSync(path.join(output, file)).isSymbolicLink() || rawSha256(fs.readFileSync(path.join(output, file))) !== existing.files[file]) throw new Error("first_ten_intake_file_hash_mismatch");
    process.stdout.write(JSON.stringify({ manifestHash, reused: true, lessons: sources.lessons.length }) + "\n"); return;
  }
  fs.mkdirSync(output);
  const write = (file: string, value: unknown) => fs.writeFileSync(path.join(output, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  const lessons = sources.lessons.map(({ lesson, source, sourceRef, index }) => {
    const file = `${lesson.key}.json`;
    write(file, { schemaVersion: FIRST_TEN_INTAKE_VERSION, evidence: "LOCAL_READ_ONLY_EXPORT_UNATTESTED", state: "DRAFT", approved: false, released: false, independentReview: "NOT_PERFORMED",
      source: { ...sourceRef, snapshotSchemaVersion: source.revision.snapshotSchemaVersion, contentSnapshot: source.revision.contentSnapshot, dependencyCounts: source.dependencies, exportedVerificationClaims: source.verification },
      originalSpecification: lesson, blueprint: blueprints[index],
      assessmentKindCrosswalk: lesson.independentAssessment.endOfLesson.map(t => ({ originalKind: t.kind, taskId: t.id, normalizedKind: blueprints[index].assessmentPlan.find(a => a.id === t.id)?.kind })),
      authoringState: "BRIEF_ONLY_NO_CANDIDATE_OUTPUT", authoringBlockers: blueprints[index].unresolved,
    });
    return { key: lesson.key, ...sourceRef, subject: lesson.subject, grade: lesson.grade, blueprintHash: blueprints[index].contentHash, file };
  });
  const files = Object.fromEntries(fs.readdirSync(output).sort().map(file => [file, rawSha256(fs.readFileSync(path.join(output, file)))]));
  const body = { schemaVersion: FIRST_TEN_INTAKE_VERSION, inputHash, reviewedBaselineCommit: FIRST_TEN_BASELINE.sourceCommit, specSha256: sources.specSha256, sourceManifestSha256: sources.manifestSha256, extractSha256: sources.extractSha256,
    evidence: "LOCAL_READ_ONLY_EXPORT_UNATTESTED", compatibility: "EXPLICIT_ADAPTER_REQUIRED_BLUEPRINTS_VALIDATED_AUTHORING_BLOCKED", candidateCount: 0, state: "DRAFT", approved: false, released: false,
    blockers: ["LESSON_SPECIFIC_GENERATION_DRAFTS_KEYS_RUBRICS_AND_VISUAL_ASSETS_REQUIRED", "QUALIFIED_CURRICULUM_MAPPING_AND_REVIEW_PENDING", "SOURCE_OPERATOR_AND_PRIVACY_ATTESTATIONS_PENDING", "LIVE_ROW_ASSERTION_NOT_INDEPENDENTLY_PROVEN", "FULL_FACTORY_PRODUCTION_CAPTURE_NOT_AVAILABLE"], lessons, files,
  };
  const manifestHash = digest(FIRST_TEN_INTAKE_VERSION, body);
  write("manifest.json", { ...body, manifestHash });
  process.stdout.write(JSON.stringify({ manifestHash, reused: false, lessons: lessons.length }) + "\n");
}
try { main(); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "intake_failed"}\n`); process.exitCode = 1; }
