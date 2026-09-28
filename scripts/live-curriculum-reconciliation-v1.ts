import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), process.env.AUDIT_ENV ?? ".env.local"), override: true });

const prisma = new PrismaClient();
const scope = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "curriculum/releases/k12-scope.json"), "utf8"));
const grades: number[] = scope.scope.grades;
const subjects: string[] = scope.scope.subjects;
const cells = grades.flatMap((grade) => subjects.map((subject) => ({ grade, subject })));
const approvedStatuses = new Set(["APPROVED", "PUBLISHED", "published", "approved"]);

type AnyRow = Record<string, any>;
const count = (rows: AnyRow[], predicate: (row: AnyRow) => boolean) => rows.reduce((n, row) => n + (predicate(row) ? 1 : 0), 0);
const nonEmpty = (value: unknown) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
const text = (value: unknown) => typeof value === "string" ? value.toUpperCase() : "";
const jsonObject = (value: unknown): AnyRow => value && typeof value === "object" && !Array.isArray(value) ? value as AnyRow : {};

async function main() {
  const [contents, provenances, revisions, events, evidences, objectives, targets, standards, skills, units, lessons, assessments, assessmentItems, practiceItems, classes, assignments, labs, textbooks, policies, sources, sourceVersions, curriculumVersions, baselineSubjects, placementItems] = await Promise.all([
    prisma.curriculumContent.findMany({ select: { id: true, contentId: true, title: true, grade: true, subject: true, contentType: true, status: true, payload: true, moeAlignments: true, unitId: true, learningObjectives: true, versionId: true, publishedAt: true, teacherCreated: true, visibility: true, lessonType: true } }),
    prisma.curriculumProvenance.findMany({ select: { curriculumContentId: true, provenanceCompleteness: true, lifecycleState: true, currentRevisionId: true } }),
    prisma.curriculumContentRevision.findMany({ select: { id: true, provenanceId: true, originKind: true, revisionKind: true, authorUserId: true, createdAt: true } }),
    prisma.curriculumGovernanceEvent.findMany({ select: { revisionId: true, eventType: true, actorType: true, approvalBasis: true, reviewAuthority: true, lifecycleResult: true, occurredAt: true } }),
    prisma.curriculumEvidence.findMany({ select: { revisionId: true, evidencePurpose: true, status: true, uri: true, documentRef: true, citation: true, locator: true } }),
    prisma.moeCurriculumObjective.findMany({ select: { code: true, grade: true, subject: true, sourceVersionId: true, verificationStatus: true } }),
    prisma.curriculumLearningTarget.findMany({ select: { code: true, grade: true, subject: true, moeObjectiveId: true, curriculumRevisionId: true, verificationStatus: true } }),
    prisma.standard.findMany({ select: { id: true, code: true, subject: true, band: true } }),
    prisma.skill.findMany({ select: { id: true, subject: true, band: true } }),
    prisma.unit.findMany({ select: { id: true, subject: true, band: true, standardId: true, lessons: { select: { id: true } }, assessments: { select: { id: true, items: { select: { id: true, practiceItemId: true } } } } } }),
    prisma.lesson.findMany({ select: { id: true, unitId: true, objectives: true } }),
    prisma.assessment.findMany({ select: { id: true, unitId: true, classId: true, items: { select: { id: true, practiceItemId: true } } } }),
    prisma.assessmentItem.findMany({ select: { id: true, assessmentId: true, practiceItemId: true } }),
    prisma.practiceItem.findMany({ select: { id: true, skillId: true, AssessmentItem: { select: { id: true } } } }),
    prisma.class.findMany({ select: { id: true, gradeLevel: true, subject: true, assessments: { select: { id: true } }, assignments: { select: { id: true, contentId: true } } } }),
    prisma.assignment.findMany({ select: { id: true, classId: true, contentId: true, moeStandardCodes: true } }),
    prisma.virtualLab.findMany({ select: { id: true, grade: true, subject: true, status: true, primaryContentIds: true, moeStandardCodes: true } }),
    prisma.textbookGenerationJob.findMany({ select: { id: true, grade: true, subject: true, status: true, storageUrl: true, generatedAt: true } }),
    prisma.policyConfig.findMany({ select: { policyKey: true, scope: true, isActive: true, config: true } }),
    prisma.curriculumAuthoritySource.findMany({ select: { id: true, authorityType: true, authorityName: true, subject: true, gradeMin: true, gradeMax: true, status: true, currentVersionId: true } }),
    prisma.curriculumAuthoritySourceVersion.findMany({ select: { id: true, sourceId: true, verificationStatus: true } }),
    prisma.curriculumVersion.findMany({ select: { id: true, versionName: true, status: true, contents: { select: { grade: true, subject: true, contentId: true, status: true } } } }),
    prisma.assessmentBaselineSubject.findMany({ select: { id: true, name: true, gradeMin: true, gradeMax: true, officialSubjectCode: true, competencies: { select: { id: true, sourceVersionId: true } } } }),
    prisma.placementSessionItem.findMany({ select: { subject: true, moeStandard: true, source: true } }),
  ]);

  const provByContent = new Map(provenances.map((p) => [p.curriculumContentId, p]));
  const revById = new Map(revisions.map((r) => [r.id, r]));
  const evidenceByRevision = new Map<string, AnyRow[]>();
  for (const e of evidences) evidenceByRevision.set(e.revisionId, [...(evidenceByRevision.get(e.revisionId) ?? []), e]);
  const eventsByRevision = new Map<string, AnyRow[]>();
  for (const e of events) eventsByRevision.set(e.revisionId, [...(eventsByRevision.get(e.revisionId) ?? []), e]);
  const repoSources = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "curriculum/sources/repository-source-inventory.json"), "utf8"));
  const repoSourceCells = new Set<string>();
  for (const s of repoSources.sources) for (let g = s.gradeMin; g <= s.gradeMax; g++) for (const subj of s.subjects) repoSourceCells.add(`${g}|${subj}`);
  const registered = new Map((scope.registeredReleases ?? []).map((r: AnyRow) => [`${r.grade}|${r.subject}`, r]));
  const repoManifestCells = new Set<string>();
  for (const r of registered.keys()) repoManifestCells.add(r);

  const cellReports = cells.map(({ grade, subject }) => {
    const key = `${grade}|${subject}`;
    const c = contents.filter((x) => x.grade === grade && text(x.subject) === subject);
    const published = c.filter((x) => approvedStatuses.has(x.status));
    const cprov = c.map((x) => provByContent.get(x.id)).filter(Boolean) as AnyRow[];
    const cRevs = cprov.map((p) => revById.get(p.currentRevisionId)).filter(Boolean) as AnyRow[];
    const cEvidence = cRevs.flatMap((r) => evidenceByRevision.get(r.id) ?? []);
    const obj = objectives.filter((x) => x.grade === grade && text(x.subject) === subject);
    const lt = targets.filter((x) => x.grade === grade && text(x.subject) === subject);
    const std = standards.filter((x) => text(x.subject) === subject);
    const sk = skills.filter((x) => text(x.subject) === subject);
    const u = units.filter((x) => text(x.subject) === subject);
    const unitIds = new Set(u.map((x) => x.id));
    const ls = lessons.filter((x) => unitIds.has(x.unitId));
    const as = assessments.filter((x) => x.unitId && unitIds.has(x.unitId));
    const ai = as.flatMap((x) => x.items);
    const cls = classes.filter((x) => x.gradeLevel === grade && text(x.subject) === subject);
    const classIds = new Set(cls.map((x) => x.id));
    const ass = assignments.filter((x) => classIds.has(x.classId));
    const lab = labs.filter((x) => x.grade === grade && text(x.subject) === subject);
    const tb = textbooks.filter((x) => x.grade === grade && text(x.subject) === subject);
    const hasRelease = registered.has(key);
    const gaps: string[] = [];
    if (!published.length) gaps.push("NO_PUBLISHED_LESSON");
    if (!obj.length && !lt.length && !std.length) gaps.push("NO_LIVE_OBJECTIVE_OR_STANDARD");
    if (!cprov.length || cprov.some((p) => p.provenanceCompleteness === "UNVERIFIED")) gaps.push("PROVENANCE");
    if (!cEvidence.length && published.length) gaps.push("EVIDENCE_BINDING");
    if (!hasRelease) gaps.push("RELEASE_BINDING_GAP");
    if (!policies.some((p) => p.isActive && text(p.policyKey).includes("TOOL"))) gaps.push("TOOL_POLICY");
    const sourceExists = repoSourceCells.has(key) || sources.some((s) => s.status === "ACTIVE" && (s.gradeMin == null || grade >= s.gradeMin) && (s.gradeMax == null || grade <= s.gradeMax) && (!s.subject || text(s.subject) === subject));
    let classification = "NO_VERIFIED_SOURCE";
    if (c.length && hasRelease && published.length && cprov.length && cprov.every((p) => p.lifecycleState === "APPROVED")) classification = "LIVE_EXECUTABLE_COMPLETE";
    else if (c.length && c.some((x) => !provByContent.has(x.id))) classification = "ORPHANED_LIVE_CONTENT";
    else if (c.length) classification = "LIVE_PARTIAL";
    else if (sourceExists) classification = repoManifestCells.has(key) ? "REPOSITORY_ONLY" : "SOURCE_EXISTS_NOT_IMPORTED";
    return { grade, subject, classification, liveObjectiveCount: obj.length + lt.length, standardCount: std.length, skillCount: sk.length, curriculumContentCount: c.length, publishedLessonCount: published.length, assignmentPracticeCount: ass.length + ai.length, assessmentCount: ai.length, diagnosticCount: count(placementItems, (x) => text(x.subject) === subject && nonEmpty(x.moeStandard)), resourceTextbookCount: tb.filter((x) => x.status === "COMPLETE" || x.status === "COMPLETED" || nonEmpty(x.storageUrl)).length, labSimulationCount: lab.length, evidenceBindingCount: cEvidence.length, toolPolicyCount: policies.filter((p) => p.isActive && text(p.policyKey).includes("TOOL")).length, executableReleaseCount: hasRelease ? 1 : 0, releaseContentBindingCount: hasRelease ? c.length : 0, provenanceState: c.length ? (cprov.length === c.length ? cprov.map((p) => p.provenanceCompleteness).join(",") : "MISSING_OR_PARTIAL") : (sourceExists ? "REPOSITORY_SOURCE_ONLY" : "NOT_OBSERVED"), reviewState: c.length ? [...new Set(c.map((x) => x.status))] : [], approvalState: scope.registeredReleases?.find((r: AnyRow) => r.grade === grade && r.subject === subject)?.moeApprovalStatus ?? "NOT_CLAIMED", bindingGaps: gaps, trueMissingContent: !published.length, reusableContent: c.filter((x) => approvedStatuses.has(x.status) && provByContent.has(x.id)).map((x) => x.contentId), contentNeedingReview: c.filter((x) => !approvedStatuses.has(x.status)).map((x) => x.contentId), contentNeedingImport: !c.length && sourceExists, contentNeedingAuthoring: !c.length && !sourceExists, furtherPdfExtractionRequired: !c.length && sourceExists && !repoSourceCells.has(key), notes: { sourceExists, liveStatuses: [...new Set(c.map((x) => x.status))], labStatuses: [...new Set(lab.map((x) => x.status))], textbookStatuses: [...new Set(tb.map((x) => x.status))] } };
  });

  const duplicateObjectives = [...objectives.reduce((m, x) => { const k = `${x.grade}|${text(x.subject)}|${x.code}`; m.set(k, [...(m.get(k) ?? []), x]); return m; }, new Map<string, AnyRow[]>()).entries()].filter(([, v]) => v.length > 1).map(([key, rows]) => ({ key, count: rows.length }));
  const duplicateLessons = [...contents.reduce((m, x) => { const k = `${x.grade}|${text(x.subject)}|${(x.title ?? "").trim().toLowerCase()}`; m.set(k, [...(m.get(k) ?? []), x]); return m; }, new Map<string, AnyRow[]>()).entries()].filter(([key, v]) => key.endsWith("|") === false && v.length > 1).map(([key, rows]) => ({ key, count: rows.length, contentIds: rows.map((x) => x.contentId) }));
  const anomalies = { contentWithoutProvenance: contents.filter((x) => !provByContent.has(x.id)).map((x) => x.contentId), duplicateObjectives, duplicateLessons, staleReleaseBindings: [...registered.entries()].filter(([key]) => !cellReports.find((x) => `${x.grade}|${x.subject}` === key)?.reusableContent.length).map(([key, r]) => ({ key, releaseId: r.releaseId })), wrongGradeSubjectContent: contents.filter((x) => !cells.some((c) => c.grade === x.grade && text(x.subject) === c.subject)).map((x) => ({ contentId: x.contentId, grade: x.grade, subject: x.subject })), lessonsWithoutObjectiveBinding: contents.filter((x) => approvedStatuses.has(x.status) && (!Array.isArray(x.learningObjectives) || x.learningObjectives.length === 0) && !nonEmpty(jsonObject(x.payload).objectives)).map((x) => x.contentId), assessmentsWithoutEvidenceBinding: assessmentItems.filter((x) => !practiceItems.find((p) => p.id === x.practiceItemId)?.AssessmentItem?.length).map((x) => x.id), contentWithSourceButNoReview: contents.filter((x) => jsonObject(jsonObject(x.payload).metadata).source && !approvedStatuses.has(x.status) && !jsonObject(x.payload).approvedByUserId).map((x) => x.contentId), founderReviewedMislabeledMoe: contents.filter((x) => text(jsonObject(jsonObject(x.payload).metadata).authority).includes("MOE") && text(jsonObject(jsonObject(x.payload).metadata).reviewAuthority).includes("FOUNDER")).map((x) => x.contentId), legacyAuthorityReferences: contents.filter((x) => { const p=jsonObject(x.payload); return nonEmpty(p.authority) || nonEmpty(p.source) || nonEmpty(jsonObject(p.metadata).source); }).filter((x) => !provByContent.has(x.id)).map((x) => ({ contentId: x.contentId, source: jsonObject(x.payload).source ?? jsonObject(jsonObject(x.payload).metadata).source, authority: jsonObject(x.payload).authority ?? jsonObject(jsonObject(x.payload).metadata).authority })) };
  const totals = { cells: cellReports.length, byClassification: cellReports.reduce((m, x) => { m[x.classification] = (m[x.classification] ?? 0) + 1; return m; }, {} as AnyRow), liveObjectives: objectives.length + targets.length, liveLessons: contents.filter((x) => approvedStatuses.has(x.status)).length, liveAssessments: assessmentItems.length, liveTextbooksResources: textbooks.filter((x) => nonEmpty(x.storageUrl) || x.status === "COMPLETE" || x.status === "COMPLETED").length, liveLabs: labs.length, liveReleases: registered.size, liveSources: sources.length, liveSourceVersions: sourceVersions.length, liveCurriculumVersions: curriculumVersions.length, livePolicies: policies.filter((x) => x.isActive).length, liveEvidence: evidences.length, liveGovernanceEvents: events.length, liveBaselineSubjects: baselineSubjects.length };
  const labAuditPath = path.resolve(process.cwd(), "artifacts/curriculum-reconciliation-v1/lab-engine-audit.json");
  const labEngineAudit = fs.existsSync(labAuditPath) ? JSON.parse(fs.readFileSync(labAuditPath, "utf8")) : null;
  const output = { generatedAt: new Date().toISOString(), evidence: { database: "Supabase via Prisma DATABASE_URL from selected audit environment", readOnly: true, repositoryHead: process.env.GIT_COMMIT ?? "not-set", scopeManifest: "curriculum/releases/k12-scope.json", sourceInventory: "curriculum/sources/repository-source-inventory.json" }, totals, cells: cellReports, anomalies, repository: { registeredReleases: scope.registeredReleases ?? [], sources: repoSources.sources }, labEngineAudit, liveReleaseModel: "No persisted ontology-release/binding model found in prisma/schema.prisma; executable release/tool-policy evidence is repository-defined and separately reported.", limitations: ["Assignments/assessments are class-scoped in the live schema; counts are attributable to a grade/subject only where Class.gradeLevel and Class.subject are present.", "Diagnostic rows are PlacementSessionItem rows and may not represent every diagnostic mechanism.", "MOE source presence is not MOE approval; approval is reported only from explicit live/repository authority fields."] };
  const outDir = path.resolve(process.cwd(), "artifacts/curriculum-reconciliation-v1"); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "live-reconciliation.json"), JSON.stringify(output, null, 2));
  const md = [`# LiberiaLearn live curriculum reconciliation V1`, ``, `Generated: ${output.generatedAt}`, ``, `## Goal status`, `READ-ONLY DISCOVERY COMPLETE; executable K12 coverage is not complete.`, ``, `## Totals`, ``, `- Cells: ${totals.cells}`, `- Live objectives/targets: ${totals.liveObjectives}`, `- Published lesson-like content: ${totals.liveLessons}`, `- Assessment items: ${totals.liveAssessments}`, `- Textbook/resource jobs with output: ${totals.liveTextbooksResources}`, `- Labs/simulations: ${totals.liveLabs}`, `- Registered executable releases: ${totals.liveReleases}`, `- Authority sources: ${totals.liveSources}`, ``, `## Classification`, ``, ...Object.entries(totals.byClassification).map(([k,v]) => `- ${k}: ${v}`), ``, `## Cell inventory`, ``, `| Grade | Subject | Class | Live obj | Lessons | Assessments | Resources | Labs | Releases | Provenance | Approval | Binding gaps |`, `|---:|---|---|---:|---:|---:|---:|---:|---:|---|---|---|`, ...cellReports.map((x) => `| ${x.grade} | ${x.subject} | ${x.classification} | ${x.liveObjectiveCount} | ${x.publishedLessonCount} | ${x.assessmentCount} | ${x.resourceTextbookCount} | ${x.labSimulationCount} | ${x.executableReleaseCount} | ${x.provenanceState} | ${x.approvalState} | ${x.bindingGaps.join(", ") || "—"} |`), ``, `## Detected anomalies`, ``, `- Content without provenance: ${anomalies.contentWithoutProvenance.length}`, `- Duplicate objectives: ${anomalies.duplicateObjectives.length}`, `- Duplicate lessons: ${anomalies.duplicateLessons.length}`, `- Stale release bindings: ${anomalies.staleReleaseBindings.length}`, `- Wrong grade/subject content: ${anomalies.wrongGradeSubjectContent.length}`, `- Lessons without objective binding: ${anomalies.lessonsWithoutObjectiveBinding.length}`, `- Assessment items without evidence binding: ${anomalies.assessmentsWithoutEvidenceBinding.length}`, `- Source but no review: ${anomalies.contentWithSourceButNoReview.length}`, `- Legacy authority references: ${anomalies.legacyAuthorityReferences.length}`, ``, `## Lab engine audit`, ``, `- Existing shared runtime: validate/apply action-state kernel with 12 registered typed labs.`, `- 2D: supported; 3D: new capability required.`, `- Lab mastery: provisional/raw evidence only; canonical mastery update is intentionally disabled.`, `- Offline simulation state/mastery events: unsupported; safe fallback required.`, `- Do not create a duplicate engine; converge definitions onto the existing runtime.`, ``, `## Interpretation`, ``, `- Repository MOE archives are acquired and importable for their listed subjects, but remain ACQUIRED_UNREVIEWED and do not establish MOE approval.`, `- The smallest governed path is: reconcile live content/provenance -> review/import only source-backed cells -> create explicit release and bindings per cell -> validate tool/evidence policies -> release only after authority/review gates.`, `- PDF extraction is required only for source-backed cells whose raw archive is present but no usable structured import exists; the JSON artifact gives the exact cells.`, ``, `The machine-readable artifact is [live-reconciliation.json](./live-reconciliation.json).`].join("\n");
  fs.writeFileSync(path.join(outDir, "LIVE_RECONCILIATION_V1.md"), md);
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
