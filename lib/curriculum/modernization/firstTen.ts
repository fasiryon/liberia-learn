/**
 * First-ten modernization contract: renders the human-readable specification from the single
 * machine-readable source (curriculum/modernization/v1/first-ten/spec.json). Pure; no database,
 * ledger writer, release or publication code.
 */
import { MODERNIZATION_DIR } from "./build";

export const FIRST_TEN_SPEC_FILE = `${MODERNIZATION_DIR}/first-ten/spec.json`;
export const FIRST_TEN_SPEC_DOC = "docs/curriculum/modernization/FIRST_TEN_MODERNIZATION_SPEC_V1.md";
export const FIRST_TEN_BINDINGS_FILE = `${MODERNIZATION_DIR}/first-ten/source-bindings.json`;

type Dependencies = Record<string, number>;
type Identity = {
  contentId: string; contentPk: string; legacyTitle: string; grade: number; subject: string; unitId: string | null; publicationStatus: string;
  track: string; wave: { wave: number; rank: number } | null; dependencies: Dependencies;
  legacy: { revisionId: string; contentHash: string }; audit: { reviewOutcome: string; blocking: number; major: number };
};
type LessonSpec = Identity & {
  key: string; selectionReasons: string[]; selectionNote: string;
  defects: { id: string; severity: string; kind: string; where: string; legacy: string; correction: string; verification: string; evidence?: { sourceId: string; supports: string }[] }[];
  objectives: { id: string; statement: string; layer: string }[];
  prerequisites: { statement: string; diagnostic: string; fallbackRoute: string }[];
  progression: string[]; vocabulary: string[]; liberianContexts: string[];
  visualAndInteractive: { requirement: string; offlineFallback: string }[];
  guidedPractice: string[];
  independentAssessment: { endOfLesson: { id: string; objectiveIds: string[]; kind: string; scoring: string; task: string }[]; selectedResponseMaxShare: number };
  misconceptions: { id: string; misconceptionId?: string; description: string; probe: string; feedback: string }[];
  retention: { delayDays: number; items: string[]; policyRef?: string };
  transfer: { context: string; scoring: string; task: string };
  extension: { task: string };
  teacherReview: string[];
  moeWaec: { moe: string; waec: string; ceiling: string };
  correctionNotice: { recommended: boolean; reason: string; audience: string };
  openDecisions: { id: string; question: string; authorRecommendation: string; status?: string }[];
  advisoryReview?: { verdicts: Record<string, number>; disputed: { defectId: string; reason: string }[]; adoptedIntoSpec: string[]; correctionNoticeWarranted: boolean; countsAsIndependentReview: false; files: Record<string, { path: string; sha256: string }> };
};
export type FirstTenSpec = {
  contractVersion: string; status: string;
  basis: { repositoryCommit: string; pullRequest: number; inventory: { version: string; extractSha256: string; capturedAt: string; lessons: number }; ledger: { head: string; events: number }; standards: string[]; factoryCompatibility: string };
  selection: { method: string; gradeSkewNote: string; classConcentrationNote: string; excludedAlreadyInReview: string[] };
  subjectPolicy?: Record<string, string>;
  sources?: { accessed: string; registry: { id: string; kind: string; authority: string; title: string; publisher: string; url: string }[]; officialSourcesNotYetObtained: string[] };
  sourceBindings?: { path: string; sha256: string; shape: string; exportStatus: string };
  retentionPolicy?: { policyId: string; version: string; status: string; statusSource: string; intervalsDays: number[]; minimumDelayDays: number };
  misconceptionCatalog?: { id: string; version: string; rule: string };
  factoryCompatibility?: { target: string; verdict: string; checks: { check: string; result: string }[]; interfaceRules: string[]; blockers: string[] };
  sharedLessonContract: { version?: string; stages: string[]; rules: string[] };
  verificationValues: Record<string, string>;
  lessons: LessonSpec[];
  alternates: (Identity & { note: string })[];
  prohibited: string[];
};

const SUBJECT: Record<string, string> = { MATH: "Math", SCIENCE: "Science", CIVICS: "Civics", LITERACY: "Literacy", ENGLISH: "English" };
const LAYER: Record<string, string> = { NATIONAL_FOUNDATION: "NF", LIBERIALEARN_MASTERY: "LM", GLOBAL_EXCELLENCE: "GE" };
const cell = (value: unknown) => String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
const trackLetter = (track: string) => track.split("_")[0];
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

export function renderFirstTenSpec(spec: FirstTenSpec): string {
  const out: string[] = [];
  const w = (line = "") => out.push(line);
  const { basis, selection } = spec;

  w("# First Ten Lessons: Modernization Specification V1");
  w();
  w(`Contract \`${spec.contractVersion}\` · status **${spec.status}** · machine-readable source [\`curriculum/modernization/v1/first-ten/spec.json\`](../../../curriculum/modernization/v1/first-ten/spec.json) · acceptance rubric [\`FIRST_TEN_ACCEPTANCE_RUBRIC_V1.md\`](FIRST_TEN_ACCEPTANCE_RUBRIC_V1.md)`);
  w();
  w("This specification fixes the first 10 live legacy lessons to modernise after the 6 pilot candidates already under review, and defines what each modernised lesson must achieve. **It approves, publishes and changes nothing.** No production lesson, ledger event, learner record, grade or mastery value is touched. The specification author may not review their own work: every defect still needs confirmation by a qualified human reviewer, and the AI advisory reviews recorded here do not count as independent review. Bulk rewriting does not start until the owner approves this contract.");
  w();
  w("Generated from `spec.json` by `npx tsx scripts/render-first-ten-modernization-spec.ts`. Edit the JSON, not this file.");
  w();
  w("## Basis");
  w();
  w(`- Repository commit \`${basis.repositoryCommit}\` (PR #${basis.pullRequest} head, stacked on PR #191).`);
  w(`- Inventory \`${basis.inventory.version}\`, read-only extract \`${basis.inventory.extractSha256.slice(0, 12)}…\` captured ${basis.inventory.capturedAt} (${basis.inventory.lessons} lessons).`);
  w(`- Ledger head \`${basis.ledger.head.slice(0, 12)}…\` (${basis.ledger.events} events). This specification appends **no** events.`);
  w(`- Standards: ${basis.standards.map((s) => (s.includes("/") && !s.includes(" ") ? `\`${s}\`` : s)).join("; ")}.`);
  w(`- ${basis.factoryCompatibility}`);
  w();
  if (spec.subjectPolicy) {
    w("## Subject policy");
    w();
    for (const [subject, rule] of Object.entries(spec.subjectPolicy)) if (subject !== "decidedBy") w(`- **${subject}:** ${rule}`);
    if (spec.subjectPolicy.decidedBy) w(`- Decided by: ${spec.subjectPolicy.decidedBy}.`);
    w();
  }
  w("## How the ten were chosen");
  w();
  w(selection.method);
  w();
  w(`- ${selection.gradeSkewNote}`);
  w(`- ${selection.classConcentrationNote}`);
  w(`- Excluded because they already have candidates awaiting review: ${selection.excludedAlreadyInReview.map((c) => `\`${c}\``).join(", ")}.`);
  w();
  w("## Shortlist");
  w();
  w("| # | Lesson (exact contentId) | Grade · subject | Track · wave | Scheduled work / progress / learning events | Most serious defect (author-identified; reviewer confirms) |");
  w("|---:|---|---|---|---|---|");
  spec.lessons.forEach((lesson, index) => {
    const d = lesson.dependencies;
    const wave = lesson.wave ? `w${lesson.wave.wave}` : "-";
    w(`| ${index + 1} | \`${lesson.contentId}\`<br>${cell(lesson.legacyTitle)} | G${lesson.grade} ${SUBJECT[lesson.subject]} | ${trackLetter(lesson.track)} · ${wave} | ${d.scheduledWork} / ${d.studentProgress} / ${d.learningEvents} | ${cell(clip(lesson.defects[0].correction, 150))} |`);
  });
  w();
  const notices = spec.lessons.filter((lesson) => lesson.correctionNotice.recommended).length;
  w(`Coverage: Math 3 (G2, G7, G7), Civics 3, Science 2 (G5, G7), Literacy 1 and English 1. Correction notices are recommended for ${notices} lessons whose learners were taught false answers (see each lesson).`);
  w();
  w("### Alternates");
  w();
  for (const alternate of spec.alternates) w(`- \`${alternate.contentId}\` (G${alternate.grade} ${SUBJECT[alternate.subject]}, ${trackLetter(alternate.track)}): ${alternate.note}`);
  w();
  w("## Shared lesson contract");
  w();
  w("Every modernised lesson implements these stages, in this order where they apply. The learning loop and teacher view consume them as declared stages:");
  w();
  w(`${spec.sharedLessonContract.stages.map((stage) => `\`${stage}\``).join(", ")}.`);
  w();
  for (const rule of spec.sharedLessonContract.rules) w(`- ${rule}`);
  w();
  if (spec.sharedLessonContract.version) w(`Lesson contract version \`${spec.sharedLessonContract.version}\` (pin it as \`contractRef.version\`). Every lesson carries \`stageBindings\` for each learner stage (Lesson Player V2 \`sceneIds\`, Assessment V2 \`assessmentDefinitionId\`, \`required\`, \`fallback\`), null until built. End-of-lesson tasks are SUMMATIVE, retention is RETENTION and transfer is TRANSFER/NEW. \`misconceptionId\` is the stable catalog id that Assessment V2 must emit.`);
  if (spec.retentionPolicy) w(`Retention policy: \`${spec.retentionPolicy.policyId}@${spec.retentionPolicy.version}\` (${spec.retentionPolicy.status}; ${spec.retentionPolicy.statusSource}), intervals ${spec.retentionPolicy.intervalsDays.join(" and ")} days, minimum delay ${spec.retentionPolicy.minimumDelayDays} days. A lesson cannot override it.`);
  if (spec.misconceptionCatalog) w(`Misconception catalog \`${spec.misconceptionCatalog.id}@${spec.misconceptionCatalog.version}\`: ${spec.misconceptionCatalog.rule}`);
  w();
  w(`Defect verification values: ${Object.entries(spec.verificationValues).map(([k, v]) => `\`${k}\`: ${v}`).join("; ")}`);
  w();
  if (spec.factoryCompatibility) {
    const fc = spec.factoryCompatibility;
    w("## Content Factory V2 compatibility");
    w();
    w(`Target: ${fc.target}. **Verdict: ${fc.verdict}.**`);
    w();
    w("| Check | Result |");
    w("|---|---|");
    for (const c of fc.checks) w(`| ${cell(c.check)} | ${c.result} |`);
    w();
    w("Interface rules:");
    w();
    for (const r of fc.interfaceRules) w(`- ${r}`);
    w();
    w("Blockers before real candidate authoring:");
    w();
    for (const b of fc.blockers) w(`- ${b}`);
    w();
    if (spec.sourceBindings) {
      w(`Source bindings: [\`${spec.sourceBindings.path}\`](../../../${spec.sourceBindings.path}) (sha256 \`${spec.sourceBindings.sha256.slice(0, 16)}…\`, ${spec.sourceBindings.shape}; ${spec.sourceBindings.exportStatus}).`);
      w();
    }
  }
  spec.lessons.forEach((lesson, index) => {
    w(`## ${index + 1}. ${cell(lesson.legacyTitle)}`);
    w();
    w(`\`${lesson.contentId}\` · revision \`${lesson.legacy.revisionId}\` · hash \`${lesson.legacy.contentHash.slice(0, 16)}…\` · G${lesson.grade} ${lesson.subject} · ${lesson.unitId ? `unit \`${lesson.unitId}\`` : "no unit"} · ${lesson.publicationStatus} · ${lesson.track} · audit ${lesson.audit.reviewOutcome} (${lesson.audit.blocking} blocking, ${lesson.audit.major} major)`);
    w();
    const deps = Object.entries(lesson.dependencies).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ");
    w(`Dependencies (counts): ${deps}. Selection: ${lesson.selectionReasons.join(", ")}. ${lesson.selectionNote}`);
    w();
    w("**Current deficiencies and factual corrections**");
    w();
    w("| | Severity · kind | Where | Legacy text | Correction | Verification | Evidence |");
    w("|---|---|---|---|---|---|---|");
    for (const d of lesson.defects) w(`| ${d.id} | ${d.severity} · ${d.kind} | ${cell(d.where)} | “${cell(d.legacy)}” | ${cell(d.correction)} | ${d.verification} | ${(d.evidence ?? []).map((e) => `${e.sourceId}: ${cell(e.supports)}`).join("<br>") || "—"} |`);
    w();
    w("**Learning objectives**");
    w();
    for (const o of lesson.objectives) w(`- \`${o.id}\` (${LAYER[o.layer]}) ${o.statement}`);
    w();
    w("**Prerequisite diagnostics**");
    w();
    for (const p of lesson.prerequisites) w(`- ${p.statement} Diagnostic: ${p.diagnostic} Fallback: ${p.fallbackRoute}`);
    w();
    w(`**Conceptual depth and progression:** ${lesson.progression.join(" → ")}.`);
    w();
    w(`**Academic vocabulary:** ${lesson.vocabulary.join(", ")}.`);
    w();
    w(`**Liberian examples:** ${lesson.liberianContexts.join("; ")}.`);
    w();
    w("**Visual and interactive teaching**");
    w();
    for (const v of lesson.visualAndInteractive) w(`- ${v.requirement} Offline: ${v.offlineFallback}`);
    w();
    w(`**Guided practice (fading):** ${lesson.guidedPractice.join("; ")}.`);
    w();
    const assessment = lesson.independentAssessment;
    w(`**Independent assessment** (end of lesson, scaffold NONE; selected response ≤ ${Math.round(assessment.selectedResponseMaxShare * 100)}%; keys never shown to learners)`);
    w();
    for (const t of assessment.endOfLesson) w(`- \`${t.id}\` [${t.objectiveIds.join(", ")}] ${t.kind} · ${t.scoring}: ${t.task}`);
    w();
    w("**Misconception detection**");
    w();
    w("| | Misconception | Probe | Corrective feedback |");
    w("|---|---|---|---|");
    for (const m of lesson.misconceptions) w(`| ${m.id}${m.misconceptionId ? `<br>\`${m.misconceptionId}\`` : ""} | ${cell(m.description)} | ${cell(m.probe)} | ${cell(m.feedback)} |`);
    w();
    const policy = lesson.retention.policyRef ? `, policy \`${lesson.retention.policyRef}\`` : "";
    w(`**Retention** (≥ ${lesson.retention.delayDays} days${policy}): ${lesson.retention.items.join("; ")}.`);
    w();
    w(`**Transfer** (${lesson.transfer.context} context, ${lesson.transfer.scoring}): ${lesson.transfer.task}`);
    w();
    w(`**Optional extension** (non-gating): ${lesson.extension.task}`);
    w();
    w("**Teacher review criteria**");
    w();
    for (const t of lesson.teacherReview) w(`- ${t}`);
    w();
    w(`**MOE / WAEC:** ${lesson.moeWaec.moe} ${lesson.moeWaec.waec} Ceiling: ${lesson.moeWaec.ceiling}`);
    w();
    const notice = lesson.correctionNotice;
    w(`**Correction notice:** ${notice.recommended ? "recommended" : "not required"}. ${notice.reason} (${notice.audience}.)`);
    w();
    if (lesson.openDecisions.length) {
      w(`**Open decisions:** ${lesson.openDecisions.map((od) => `\`${od.id}\`${od.status ? ` (${od.status})` : ""}: ${od.question} *Author recommends:* ${od.authorRecommendation}`).join(" ")}`);
      w();
    }
    if (lesson.advisoryReview) {
      const r = lesson.advisoryReview;
      const counts = Object.entries(r.verdicts).map(([k, v]) => `${k} ${v}`).join(", ");
      const disputed = r.disputed.length ? `Not confirmed: ${r.disputed.map((d) => `${d.defectId} (${cell(clip(d.reason, 160))})`).join("; ")}. ` : "";
      w(`**Advisory review** (blind, AI, does not count as independent): ${counts}. ${disputed}Adopted into this version: ${r.adoptedIntoSpec.length ? r.adoptedIntoSpec.join("; ") : "none"}. Reviewer says a correction notice is warranted: ${r.correctionNoticeWarranted ? "yes" : "no"}.`);
      w();
    }
  });
  if (spec.sources) {
    w(`## Source registry (accessed ${spec.sources.accessed})`);
    w();
    w("| Id | Authority | Source |");
    w("|---|---|---|");
    for (const r of spec.sources.registry) w(`| ${r.id} | ${r.authority} · ${r.kind} | [${cell(r.title)}](${r.url}), ${cell(r.publisher)} |`);
    w();
    w("Not yet obtained:");
    w();
    for (const n of spec.sources.officialSourcesNotYetObtained) w(`- ${n}`);
    w();
  }
  w("## Prohibited by this contract");
  w();
  const prohibited = spec.prohibited.join(", ");
  w(`${prohibited.charAt(0).toUpperCase()}${prohibited.slice(1)}.`);
  w();
  return out.join("\n");
}

export const FIRST_TEN_MANIFEST_FILE = `${MODERNIZATION_DIR}/first-ten/manifest.json`;
/** Every file whose bytes make up the contract the owner approves. The manifest cannot list itself. */
export const FIRST_TEN_CONTRACT_FILES: readonly string[] = [
  FIRST_TEN_SPEC_FILE,
  FIRST_TEN_BINDINGS_FILE,
  FIRST_TEN_SPEC_DOC,
  "docs/curriculum/modernization/FIRST_TEN_ACCEPTANCE_RUBRIC_V1.md",
  "lib/curriculum/modernization/firstTen.ts",
  "scripts/render-first-ten-modernization-spec.ts",
  "scripts/verify-first-ten-source-bindings.ts",
  "scripts/build-first-ten-manifest.ts",
  "__tests__/library-modernization/first-ten-spec.test.ts",
];

export type FirstTenManifest = {
  schemaVersion: "liberialearn-first-ten-manifest/1.0.0";
  contractVersion: string; lessonContractVersion: string | null; status: string; baseCommit: string;
  files: { path: string; sha256: string; bytes: number }[];
  advisoryReviews: { path: string; sha256: string }[];
};

export function buildFirstTenManifest(read: (path: string) => Buffer, spec: FirstTenSpec, sha256: (bytes: Buffer) => string): FirstTenManifest {
  const reviews = spec.lessons.flatMap((lesson) => Object.values(lesson.advisoryReview?.files ?? {})).sort((a, b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: "liberialearn-first-ten-manifest/1.0.0",
    contractVersion: spec.contractVersion,
    lessonContractVersion: spec.sharedLessonContract.version ?? null,
    status: spec.status,
    baseCommit: spec.basis.repositoryCommit,
    files: FIRST_TEN_CONTRACT_FILES.map((path) => { const bytes = read(path); return { path, sha256: sha256(bytes), bytes: bytes.length }; }),
    advisoryReviews: reviews.map((file) => ({ path: file.path, sha256: sha256(read(file.path)) })),
  };
}
