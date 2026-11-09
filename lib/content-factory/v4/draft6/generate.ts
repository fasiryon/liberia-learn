import inputs from "@/curriculum/factory-v4/draft6-inputs.json";
import references from "@/curriculum/factory-v4/draft6-sources/references.json";
import counties from "@/curriculum/factory-v4/draft6-sources/county-capitals.json";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { digest } from "../../v2/blueprint";
import { buildReferenceCandidate, writeImmutableBatch, type ReferenceProfile } from "../referenceBatch";
import { hash, textHash, referenceInputsSchema, verifyReferenceInputs } from "../generation";
import { authorLesson, LESSON_AUTHOR_VERSION } from "./lessonAuthor";
import { DRAFT6_LESSONS } from "./lessons";
import { ACADEMIC_POLICY, validateAcademicCandidate } from "./quality";
import { objectiveCoverage, reviewGuidance } from "./review";
import { geographicMap, heatingDiagram } from "./assets";
import type { V4Lesson } from "@/lib/curriculum/v4/candidates";

export const DRAFT6_PROFILE: ReferenceProfile = { version: "4.0.0-draft.6", executor: LESSON_AUTHOR_VERSION,
  inputPath: "curriculum/factory-v4/draft6-inputs.json", inputs: referenceInputsSchema.parse(inputs), author: authorLesson, lessons: DRAFT6_LESSONS };
export const DRAFT6_ROOT = "curriculum/factory-v4/drafts/4.0.0-draft.6";
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

export async function buildDraft6(lesson: V4Lesson) {
  const built = await buildReferenceCandidate(lesson, DRAFT6_PROFILE);
  const candidate = authorLesson(lesson);
  const review = { version: "draft6-academic-review/1.0.0", candidateVersion: DRAFT6_PROFILE.version, candidateSha256: hash(candidate),
    authorship: "AI_AUTHORED_DETERMINISTIC_RECIPE", humanSubjectExpertReview: "NOT_PERFORMED", academicApproval: "PENDING_EXACT_VERSION_REVIEW",
    policy: ACADEMIC_POLICY, checks: validateAcademicCandidate(candidate, lesson), objectives: objectiveCoverage(lesson, candidate),
    freeResponseAndWritingGuidance: reviewGuidance(lesson, candidate), references, countyCapitalKey: lesson.subject === "CIVICS" ? counties : undefined,
    answerRepresentation: lesson.key.includes("fractions") ? { primary: "EXACT_RATIONAL", accepted: "Equivalent a/b fractions including unreduced; exact finite decimals. No automatic simplification requirement.",
      rounding: "Only explicitly requested two-place estimate: nearest hundredth; halfway rounded away from zero. Use approximate equality. No epsilon acceptance for exact fractions.", typedInput: "FACTORY_CONTRACT_ONLY_T1_INTEGRATION_PENDING", checker: "lib/content-factory/v4/draft6/rational.ts" } : undefined,
    visualContract: lesson.subject === "CIVICS" ? { asset: "liberia-county-map.svg", taskAsset: "liberia-county-outline-task.svg", status: "FACTORY_ASSET_READY_T1_INTEGRATION_PENDING", regionNumbersIdentify: "COUNTY_AREAS_NOT_CAPITAL_POINTS", geographicMastery: "NOT_CLAIMED", license: "CC BY 3.0 IGO", sourceGeometrySha256: references.sources.find(s => s.id === "geoboundaries-lbr-adm1")?.sha256RawGeometry }
      : lesson.subject === "SCIENCE" ? { asset: "heating-curve.svg", runtime: "EXISTING_DATA_PLOT", pointLabels: "A through F in SVG; numeric pairs remain in runtime plot", particleAnimation: "OMITTED_UNVALIDATED_TEMPERATURE_ONLY_MODEL" } : undefined,
  };
  const files = { ...built.files };
  delete files["manifest.json"];
  files["academic-review.json"] = json(review);
  if (lesson.subject === "CIVICS") Object.assign(files, geographicMap());
  if (lesson.subject === "SCIENCE") files["heating-curve.svg"] = heatingDiagram();
  const { packageHash: _oldHash, ...body } = built.manifest;
  const manifestBody = { ...body,
    sourceVerification: "REPOSITORY_PINS_AND_DOCUMENTED_PRIMARY_REFERENCES_CHECKED_NOT_RIGHTS_OR_ACADEMIC_APPROVAL",
    releaseBlockers: [...new Set([...body.releaseBlockers, "EXACT_DRAFT6_RELEASE_AUTHORIZATION_REQUIRED", "CONTENT_RIGHTS_ACCESS_ACCESSIBILITY_SAFETY_REVIEW_PENDING",
      ...(lesson.subject === "CIVICS" ? ["T1_GEOGRAPHIC_MAP_INTEGRATION_REQUIRED"] : []), ...(lesson.key.includes("fractions") ? ["T1_TYPED_RATIONAL_CHECKING_CONTRACT_PENDING"] : [])])],
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, textHash(bytes)])),
  };
  const manifest = { ...manifestBody, packageHash: digest("factory-v4-candidate/1.0.0", manifestBody) };
  files["manifest.json"] = json(manifest);
  return { manifest, review, candidate, files };
}

export function priorDraftHashes() {
  const collect = (dir: string): Record<string, string> => Object.fromEntries(readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? Object.entries(collect(file)) : [[file.replaceAll("\\", "/"), textHash(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))]];
  }));
  return { draft4: hash(collect("curriculum/factory-v4/drafts/4.0.0-draft.4")), draft5: hash(collect("curriculum/factory-v4/drafts/4.0.0-draft.5")) };
}

export async function generateDraft6() {
  verifyReferenceInputs(process.cwd(), DRAFT6_PROFILE.inputs);
  const before = priorDraftHashes();
  const files: Record<string, string> = {};
  const packets = [];
  for (const lesson of DRAFT6_LESSONS) {
    const first = await buildDraft6(lesson), second = await buildDraft6(lesson);
    if (json(first) !== json(second)) throw Error(`nondeterministic_draft6:${lesson.key}`);
    for (const [name, bytes] of Object.entries(first.files)) files[`${lesson.key}/${name}`] = bytes;
    packets.push({ lesson, ...first });
  }
  if (json(priorDraftHashes()) !== json(before)) throw Error("previous_drafts_changed");
  const packet = { version: "complete-academic-packet/4.0.0-draft.6", baselineCommit: "e5d89c34f421f028428cf9e4230ab3d40ff45536", sourcePins: inputs,
    state: "REVIEWER_ONLY_NO_RELEASE_AUTHORIZATION", humanSubjectExpertReview: false, productionWrites: false, priorDraftHashes: before,
    lessons: packets.map(({ lesson, manifest, review, candidate, files: packageFiles }) => ({ lesson, manifest, review, candidate,
      studentVisibleProjection: JSON.parse(packageFiles["learner-projection.json"]), visualTeaching: JSON.parse(packageFiles["visual-teaching.json"]),
      paperAlternative: packageFiles["paper-alternative.txt"], diagrams: Object.fromEntries(Object.entries(packageFiles).filter(([name]) => name.endsWith(".svg"))) })),
  };
  files["review/complete-academic-packet.json"] = json(packet);
  files["review/complete-academic-packet.md"] = ["# LiberiaLearn draft.6 complete academic review packet", "", "All six exact revisions are AI-authored review candidates. No human subject-expert review, MOE/ontology approval, copyright clearance or release authorization is claimed. Formative answers are included; protected Assessment V2 items and keys are absent. Review each exact package hash separately. No student preview is enabled.", "", ...packets.flatMap(p => [
    `## ${p.lesson.key}`, "", `Version: 4.0.0-draft.6. Package SHA-256: ${p.manifest.packageHash}. Candidate SHA-256: ${p.manifest.candidateSha256}.`, "", "### Objectives, sources, answer policies and reviewer guidance", "", "```json", json(p.review), "```", "",
    ...p.candidate.scenes.flatMap(scene => [`### ${scene.title}`, "", scene.content.body, "", `Learner action: ${scene.learnerAction}`, "", "Complete scene, including all questions, options, formative answers, explanations, feedback and accessibility text:", "", "```json", json(scene), "```", ""]),
    ...Object.entries(p.files).filter(([name]) => name.endsWith(".svg")).flatMap(([name, svg]) => [`### ${name}`, "", `![${name}](../${p.lesson.key}/${name})`, "", "Exact diagram source:", "", "```svg", svg, "```", ""]),
    "Full machine packet also includes the learner projection and sidecar. Their file digests are bound by this manifest:", "", "```json", json(p.manifest), "```", "",
  ])].join("\n");
  files["review/controlled-preview-plan.json"] = json({ version: DRAFT6_PROFILE.version, enabled: false, eligiblePackageHashes: [],
    canonicalRecordWrites: false, publishedLessonReplacement: false, requiredBeforeAnyStudentAccess: ["Exact package content authorization by release authority", "Rights review with attribution", "Tenant and role access review", "Keyboard, screen reader and small-screen accessibility review", "Safety review", "T1 integration and runtime verification where required"],
    candidates: packets.map(p => ({ key: p.lesson.key, packageHash: p.manifest.packageHash, state: "BLOCKED", blockers: p.manifest.releaseBlockers })) });
  const receipt = { version: DRAFT6_PROFILE.version, deterministicIndependentBuilds: 2, inputsSha256: hash(inputs), priorDraftHashes: before,
    packages: packets.map(p => ({ key: p.lesson.key, packageHash: p.manifest.packageHash, candidateSha256: p.manifest.candidateSha256 })),
    productionWrites: false, published: false, released: false, previewEnabled: false, protectedAssessmentKeysIncluded: false,
    files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, textHash(bytes)])) };
  files["generation-receipt.json"] = json(receipt);
  writeImmutableBatch(DRAFT6_ROOT, files);
  return receipt;
}
