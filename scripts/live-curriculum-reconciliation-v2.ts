/**
 * Live curriculum reconciliation V2 (READ-ONLY).
 *
 * Joins live production curriculum records with repository curriculum
 * authority (K-12 scope, MOE source archives, page-localized extraction,
 * executable ontology releases, ToolPolicies, lab runtime registry) and
 * classifies each of the declared grade x subject cells.
 *
 * Safety: every query runs inside one `SET TRANSACTION READ ONLY` transaction.
 * Nothing is written to the database. Unknown values stay `null`, never 0.
 *
 * Usage: DIRECT_URL=<read connection> npx tsx scripts/live-curriculum-reconciliation-v2.ts [--out <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getCanonicalSubjectCode } from "@/lib/curriculum/subjectTaxonomy";
import { publishedReleases } from "@/lib/learning-authority/publishedReleases";
import { LAB_IDS, labRegistry } from "@/lib/labs/registry";

type Row = Record<string, any>;
type CellKey = `${number}|${string}`;

const outDir = path.resolve(
  process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1]! : "artifacts/curriculum-reconciliation-v2",
);
const readJson = (p: string) => JSON.parse(fs.readFileSync(path.resolve(p), "utf8"));

const scopeFile = readJson("curriculum/releases/k12-scope.json");
const GRADES: number[] = scopeFile.scope.grades;
const SUBJECTS: string[] = scopeFile.scope.subjects;
const key = (g: number, s: string): CellKey => `${g}|${s}`;

// Secondary subject map used by the repository MOE source inventory
// (lib/learning-authority/repositorySourceInventory.ts). The runtime taxonomy
// does not map these values; results using it are flagged.
const SOURCE_INVENTORY_SUBJECT_MAP: Record<string, string> = {
  ENGLISH: "LITERACY", ENGLISH_GRAMMAR: "LITERACY", GENERAL_SCIENCE: "SCIENCE",
  BIOLOGY: "SCIENCE", CHEMISTRY: "SCIENCE", PHYSICS: "SCIENCE", MATH: "MATH",
  SOCIAL_STUDIES: "SOCIAL_STUDIES", GEOGRAPHY: "SOCIAL_STUDIES", HISTORY: "SOCIAL_STUDIES",
};

type SubjectResolution = { canonical: string | null; via: "TAXONOMY" | "SOURCE_INVENTORY_MAP" | "UNMAPPED" };
function resolveSubject(raw: string | null | undefined): SubjectResolution {
  if (!raw) return { canonical: null, via: "UNMAPPED" };
  const t = getCanonicalSubjectCode(raw);
  if (t) return { canonical: t, via: "TAXONOMY" };
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (SOURCE_INVENTORY_SUBJECT_MAP[upper]) return { canonical: SOURCE_INVENTORY_SUBJECT_MAP[upper]!, via: "SOURCE_INVENTORY_MAP" };
  return { canonical: null, via: "UNMAPPED" };
}

const nonEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v as object).some(nonEmpty);
  return true;
};
const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const APPROVED_STATUS = new Set(["APPROVED", "PUBLISHED"]);

// Lesson payload sections reported per cell (non-empty values only).
const PAYLOAD_SECTIONS = {
  objectives: ["objectives", "learningObjectives"],
  activities: ["activities"],
  classwork: ["studentWorksheet", "guidedPractice"],
  homework: ["homeworkSet"],
  practice: ["independentPractice", "problemSets", "workedExamples"],
  quiz: ["quiz"],
  assessmentQuestions: ["assessmentQuestions", "assessment"],
  formativeChecks: ["formativeChecks"],
  labs: ["labs"],
  labDefinitionSpecs: ["labDefinitionSpecs"],
  teacherResources: ["teacherGuide", "teacherNotes", "teacherNotesSummary"],
  guardianOutputs: ["guardianSupport"],
  remediation: ["remediation"],
  misconceptions: ["commonMisconceptions"],
  moeAlignmentsPayload: ["moeAlignments"],
} as const;
type SectionName = keyof typeof PAYLOAD_SECTIONS;

async function main() {
  const url = process.env.DIRECT_URL?.trim();
  if (!url) throw new Error("DIRECT_URL is required");
  const prisma = new PrismaClient({ datasourceUrl: url, log: [] });

  const live = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const q = <T = Row>(sql: string) => tx.$queryRawUnsafe<T[]>(sql);
    const identity = (await q(`select current_database() db, inet_server_addr()::text addr, now() as at`))[0];
    return {
      identity,
      contents: await q(`select c.id, c."contentId", c.title, c.grade, c.subject, c."contentType", c.status, c."unitId", c."versionId",
          c."moeAlignments", c."teacherCreated", c.payload,
          p."lifecycleState"::text lifecycle, p."provenanceCompleteness"::text completeness, p."currentRevisionId" rev_id,
          r."originKind"::text origin, r."revisionKind"::text revision_kind
        from "CurriculumContent" c
        left join "CurriculumProvenance" p on p."curriculumContentId" = c.id
        left join "CurriculumContentRevision" r on r.id = p."currentRevisionId"`),
      events: await q(`select e."eventType"::text event, e."approvalBasis"::text basis, e."reviewAuthority"::text authority, e."occurredAt", p."curriculumContentId" content_id
        from "CurriculumGovernanceEvent" e join "CurriculumContentRevision" r on r.id = e."revisionId"
        join "CurriculumProvenance" p on p.id = r."provenanceId"`),
      evidence: await q(`select p."curriculumContentId" content_id, count(*)::int n from "CurriculumEvidence" e
        join "CurriculumContentRevision" r on r.id = e."revisionId" join "CurriculumProvenance" p on p.id = r."provenanceId" group by 1`),
      lessonPlans: await q(`select lp."curriculumContentId" content_id, u.grade, u.subject from "CurriculumLessonPlan" lp
        join "CurriculumWeek" w on w.id = lp."weekId" join "CurriculumUnit" u on u.id = w."unitId"`),
      units: await q(`select u.id, u."unitId" unit_key, u.grade, u.subject, (select count(*)::int from "CurriculumWeek" w where w."unitId" = u.id) weeks from "CurriculumUnit" u`),
      prereqs: await q(`select "lessonId", "prerequisiteLessonId" from "LessonPrerequisite"`),
      audio: await q(`select "lessonId" id, status from "LessonAudio"`),
      video: await q(`select "lessonId" id, status from "LessonVideo"`),
      variants: await q(`select "lessonId" id, count(*)::int n from "LessonVariant" group by 1`),
      homework: await q(`select h."contentId", c."gradeLevel" grade, c.subject from "Homework" h join "Class" c on c.id = h."classId"`),
      assignments: await q(`select a."contentId", c."gradeLevel" grade, c.subject from "Assignment" a join "Class" c on c.id = a."classId"`),
      exams: await q(`select e.id, e.grade, e.subject, e.status::text status, (select count(*)::int from "ExamQuestion" x where x."examId" = e.id) questions from "Exam" e`),
      waec: await q(`select grade, count(*)::int n from "WaecPracticeItem" group by 1`),
      practiceItems: await q(`select s.subject::text subject, s.band::text band, count(*)::int n from "PracticeItem" pi join "Skill" s on s.id = pi."skillId" group by 1,2`),
      aiLiteracy: await q(`select "lessonId" id, count(*)::int n from "AILiteracyExercise" group by 1`),
      codeExercises: await q(`select "lessonId" id, count(*)::int n from "CodeExercise" group by 1`),
      moeObjectives: await q(`select grade, subject, "verificationStatus"::text status, count(*)::int n from "MoeCurriculumObjective" group by 1,2,3`),
      learningTargets: await q(`select grade, subject, "verificationStatus"::text status, count(*)::int n from "CurriculumLearningTarget" group by 1,2,3`),
      authoritySources: await q(`select "authorityType"::text type, subject, "gradeMin", "gradeMax", status::text from "CurriculumAuthoritySource"`),
      standards: await q(`select subject::text subject, band::text band, count(*)::int n from "Standard" group by 1,2`),
      ragChunks: await q(`select "sourceType", grade, subject, count(*)::int n from "RagChunk" group by 1,2,3`),
      textbooks: await q(`select grade, subject, status, "storageUrl" is not null has_file from "TextbookGenerationJob"`),
      virtualLabs: await q(`select grade, subject, status from "VirtualLab"`),
      labSessions: (await q(`select count(*)::int n from "LabSession"`))[0]?.n ?? null,
      capstones: (await q(`select count(*)::int n from "CapstoneProject"`))[0]?.n ?? null,
      policyConfigs: (await q(`select count(*)::int n from "PolicyConfig"`))[0]?.n ?? null,
      curriculumVersions: await q(`select status::text status, count(*)::int n from "CurriculumVersion" group by 1`),
      standardCodes: (await q(`select code from "Standard"`)).map((r) => r.code as string),
      targetCodes: (await q(`select code from "CurriculumLearningTarget"`)).map((r) => r.code as string),
      skillIds: (await q(`select id from "Skill"`)).map((r) => r.id as string),
    };
  }, { timeout: 180_000 });
  await prisma.$disconnect();

  // ---------------- Repository authority ----------------
  const inventory = readJson("curriculum/sources/repository-source-inventory.json");
  const extraction: Row[] = [];
  for (const f of ["GRADE-1-6", "GRADE-7-9", "Grade-10-12"]) {
    for (const m of readJson(`curriculum/sources/intermediate/${f}.json`).manifests) {
      const e = m.extraction;
      const sentence = (o: Row) => String(o.text ?? "").trim().split(/\s+/).length >= 5;
      extraction.push({
        archive: f, member: m.source?.member ?? m.source?.memberPath ?? null, scope: m.scope,
        pages: e.pageCount, decodedPages: e.decodedPageCount, unreadablePages: e.unreadablePageCount,
        undecodedPages: e.pageCount - e.decodedPageCount, reviewQueue: e.reviewQueue.length,
        objectiveCandidates: e.objectives.length, objectiveSentences: e.objectives.filter(sentence).length,
        standardCandidates: e.standards.length, standardSentences: e.standards.filter(sentence).length,
        assessmentReferences: e.assessmentReferences.length, resourceReferences: e.resourceReferences.length,
      });
    }
  }
  const releases = publishedReleases();
  // Resolve every binding reference of each executable release against live rows.
  const collect = (v: unknown, field: string, out = new Set<string>()): Set<string> => {
    if (Array.isArray(v)) v.forEach((x) => collect(x, field, out));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) k === field && typeof x === "string" ? out.add(x) : collect(x, field, out);
    return out;
  };
  const liveContentIds = new Set(live.contents.map((c) => c.contentId as string));
  const liveSets: Record<string, Set<string>> = {
    contentId: liveContentIds, standardCode: new Set(live.standardCodes),
    learningTargetCode: new Set(live.targetCodes), skillId: new Set(live.skillIds),
  };
  const releaseBindings = releases.map((r: Row) => ({
    releaseId: r.id, grade: r.grade, subject: r.subject, status: r.status ?? null,
    references: Object.fromEntries(Object.entries(liveSets).map(([field, set]) => {
      const refs = [...collect(r, field)];
      return [field, { referenced: refs, missingLive: refs.filter((x) => !set.has(x)) }];
    })),
  }));
  const staleRelease = new Set(releaseBindings.filter((b) => Object.values(b.references).some((x: Row) => x.missingLive.length)).map((b) => b.releaseId));
  const labs = Object.values(labRegistry as Record<string, Row>).map((l) => {
    const band = String(l.gradeBand ?? "").match(/(\d+)\s*-\s*(\d+)/);
    return { id: l.id, subject: l.subject, canonical: "SCIENCE", gradeMin: band ? +band[1]! : null, gradeMax: band ? +band[2]! : null, visualization: l.visualizationType ?? l.modality ?? null };
  });
  const declaredLabIds: string[] = [...LAB_IDS];

  // ---------------- Content-level analysis ----------------
  const eventsByContent = new Map<string, Row[]>();
  for (const e of live.events) eventsByContent.set(e.content_id, [...(eventsByContent.get(e.content_id) ?? []), e]);
  const evidenceByContent = new Map(live.evidence.map((e) => [e.content_id, e.n]));
  const planned = new Set(live.lessonPlans.map((p) => p.content_id));
  const prereqIds = new Set(live.prereqs.flatMap((p) => [p.lessonId, p.prerequisiteLessonId]));
  const audioIds = new Set(live.audio.filter((a) => /ready|complete|generated/i.test(a.status)).map((a) => a.id));
  const videoIds = new Set(live.video.filter((a) => /ready|complete|generated/i.test(a.status)).map((a) => a.id));
  const contentIds = new Set(live.contents.map((c) => c.contentId));
  const contentPks = new Set(live.contents.map((c) => c.id));
  const contentByContentId = new Map(live.contents.map((c) => [c.contentId, c]));
  // CurriculumContent.unitId is a soft link to CurriculumUnit.unitId.
  const unitKeys = new Set(live.units.map((u) => u.unit_key));

  const governance = (c: Row) => {
    const evs = (eventsByContent.get(c.id) ?? []).sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
    const last = [...evs].reverse().find((e) => ["APPROVED", "REVOKED", "REINSTATED"].includes(e.event));
    const approved = last && last.event !== "REVOKED";
    if (approved && last.basis === "HUMAN_REVIEW") return last.authority === "MOE" ? "MOE_APPROVED" : "LIBERIALEARN_HUMAN_REVIEWED";
    if (approved && last.basis === "AUTOMATED_RISK_POLICY") return "AUTOMATED_POLICY_APPROVED";
    if (last?.event === "REVOKED") return "REVOKED";
    return APPROVED_STATUS.has(String(c.status).toUpperCase()) ? "LEGACY_STATUS_ONLY_NO_GOVERNANCE_RECORD" : "NOT_APPROVED";
  };

  type ContentAnalysis = Row & { cell: CellKey | null; subjectVia: string; gov: string; sections: Record<SectionName, boolean> };
  const analyses: ContentAnalysis[] = live.contents.map((c) => {
    const r = resolveSubject(c.subject);
    const inScope = r.canonical && SUBJECTS.includes(r.canonical) && GRADES.includes(c.grade);
    const payload = (c.payload && typeof c.payload === "object" ? c.payload : {}) as Row;
    const sections = Object.fromEntries(
      (Object.keys(PAYLOAD_SECTIONS) as SectionName[]).map((s) => [s, PAYLOAD_SECTIONS[s].some((k) => nonEmpty(payload[k]))]),
    ) as Record<SectionName, boolean>;
    const payloadApproval = String(payload.approvalStatus ?? "").toUpperCase();
    return {
      id: c.id, contentId: c.contentId, title: c.title, grade: c.grade, rawSubject: c.subject, status: c.status,
      cell: inScope ? key(c.grade, r.canonical!) : null, subjectVia: r.via, canonical: r.canonical,
      gov: governance(c), lifecycle: c.lifecycle, completeness: c.completeness, origin: c.origin,
      hasProvenance: !!c.lifecycle, evidence: evidenceByContent.get(c.id) ?? 0,
      // CurriculumLessonPlan.curriculumContentId references CurriculumContent.contentId.
      planned: planned.has(c.contentId), unitBound: !!c.unitId && unitKeys.has(c.unitId), unitLinkDangling: !!c.unitId && !unitKeys.has(c.unitId),
      versionBound: !!c.versionId, prereq: prereqIds.has(c.id), // LessonPrerequisite ids -> CurriculumContent.id
      audio: audioIds.has(c.contentId), video: videoIds.has(c.contentId), sections, // LessonAudio/LessonVideo.lessonId -> contentId
      statusPayloadConflict: APPROVED_STATUS.has(String(c.status).toUpperCase()) && /NEEDS_REVIEW|PENDING/.test(payloadApproval),
      aiGeneratedNeedsReview: /NEEDS_REVIEW/i.test(String(payload.trustSignal?.reviewStatus ?? "")) || payload.reviewStage === "AI_UPGRADED_DRAFT",
      systemApprover: typeof payload.approvedBy === "string" && /^(system:|phase6)/.test(payload.approvedBy) ? payload.approvedBy : null,
      moeClaim: /moe[_ -]?approved|approved by (the )?(moe|ministry)/i.test(JSON.stringify(payload)),
      normTitle: normTitle(String(c.title ?? "")),
    };
  });

  // Duplicate lessons: same cell + normalized title.
  const dupGroups = new Map<string, ContentAnalysis[]>();
  for (const a of analyses) if (a.cell) dupGroups.set(`${a.cell}|${a.normTitle}`, [...(dupGroups.get(`${a.cell}|${a.normTitle}`) ?? []), a]);
  const duplicateLessonGroups = [...dupGroups.values()].filter((g) => g.length > 1);

  // ---------------- Per-cell matrix ----------------
  const bandOf = (g: number) => (g <= 3 ? "G1_3" : g <= 6 ? "G4_6" : g <= 9 ? "G7_9" : "G10_12");
  const subjMatch = (raw: string | null, s: string) => resolveSubject(raw).canonical === s;
  const cells = GRADES.flatMap((g) => SUBJECTS.map((s) => {
    const k = key(g, s);
    const lessons = analyses.filter((a) => a.cell === k);
    const lessonIds = new Set(lessons.map((l) => l.contentId));
    const count = (pred: (a: ContentAnalysis) => boolean) => lessons.filter(pred).length;
    const sectionCounts = Object.fromEntries((Object.keys(PAYLOAD_SECTIONS) as SectionName[]).map((n) => [n, count((a) => a.sections[n])]));
    const srcArchives = inventory.sources.filter((src: Row) => src.gradeMin <= g && src.gradeMax >= g &&
      src.subjects.some((x: string) => SOURCE_INVENTORY_SUBJECT_MAP[x] === s));
    const members = extraction.filter((e) => e.scope?.subject === s && e.scope.gradeMin <= g && e.scope.gradeMax >= g);
    const cellLabs = labs.filter((l) => l.canonical === s && l.gradeMin !== null && l.gradeMin <= g && (l.gradeMax ?? 0) >= g);
    const cellReleases = releases.filter((r: Row) => r.grade === g && r.subject === s);
    // Subject-less authority rows (WAEC examination scope) are not a curriculum source for a subject.
    const liveAuthority = live.authoritySources.filter((a) => a.status === "ACTIVE" && a.subject !== null && (a.gradeMin ?? 0) <= g && (a.gradeMax ?? 99) >= g && subjMatch(a.subject, s));
    const hw = live.homework.filter((h) => (h.contentId && lessonIds.has(h.contentId)) || (!h.contentId && h.grade === g && subjMatch(h.subject, s)));
    const asg = live.assignments.filter((h) => (h.contentId && lessonIds.has(h.contentId)) || (!h.contentId && h.grade === g && subjMatch(h.subject, s)));
    const exams = live.exams.filter((e) => e.grade === g && subjMatch(e.subject, s));
    const units = live.units.filter((u) => u.grade === g && subjMatch(u.subject, s));
    const row = {
      grade: g, subject: s,
      live: {
        lessons: lessons.length,
        lessonsByGovernance: Object.fromEntries([...new Set(lessons.map((l) => l.gov))].map((gv) => [gv, count((a) => a.gov === gv)])),
        lessonsViaSecondarySubjectMap: count((a) => a.subjectVia === "SOURCE_INVENTORY_MAP"),
        lessonsNonCanonicalSubjectValue: count((a) => a.rawSubject !== s),
        provenanceVerifiedOrPartial: count((a) => a.completeness === "VERIFIED" || a.completeness === "PARTIAL"),
        withEvidenceRecords: count((a) => a.evidence > 0),
        statusPayloadConflicts: count((a) => a.statusPayloadConflict),
        aiGeneratedNeedsReview: count((a) => a.aiGeneratedNeedsReview),
        systemApproved: count((a) => !!a.systemApprover),
        moeApprovalClaims: count((a) => a.moeClaim),
        boundToLessonPlan: count((a) => a.planned),
        boundToUnit: count((a) => a.unitBound),
        boundToVersion: count((a) => a.versionBound),
        inPrerequisiteGraph: count((a) => a.prereq),
        withReadyAudio: count((a) => a.audio),
        withReadyVideo: count((a) => a.video),
        payloadSections: sectionCounts,
        units: units.length, weeks: units.reduce((n, u) => n + u.weeks, 0),
        moeObjectives: live.moeObjectives.filter((o) => o.grade === g && subjMatch(o.subject, s)).reduce((n, o) => n + o.n, 0),
        learningTargets: live.learningTargets.filter((o) => o.grade === g && subjMatch(o.subject, s)).reduce((n, o) => n + o.n, 0),
        standardsForBand: live.standards.filter((x) => x.subject === s && x.band === bandOf(g)).reduce((n, x) => n + x.n, 0),
        practiceItemsForBand: live.practiceItems.filter((x) => x.subject === s && x.band === bandOf(g)).reduce((n, x) => n + x.n, 0),
        homework: hw.length, homeworkLinkedToLesson: hw.filter((h) => h.contentId).length,
        assignments: asg.length, assignmentsLinkedToLesson: asg.filter((h) => h.contentId).length,
        exams: exams.length, examsPublished: exams.filter((e) => e.status === "PUBLISHED").length, examQuestions: exams.reduce((n, e) => n + e.questions, 0),
        waecPracticeItems: s === "MATH" ? (live.waec.find((w) => w.grade === g)?.n ?? 0) : null, // WAEC items carry subjectId only; subject join UNKNOWN except where verified
        textbooks: live.textbooks.filter((t) => t.grade === g && subjMatch(t.subject, s)).length,
        ragChunks: live.ragChunks.filter((r) => r.grade === g && subjMatch(r.subject, s)).reduce((n, r) => n + r.n, 0),
        virtualLabs: live.virtualLabs.filter((v) => v.grade === g && subjMatch(v.subject, s)).length,
        activeAuthoritySources: liveAuthority.length,
      },
      repository: {
        moeArchiveSources: srcArchives.map((x: Row) => x.id),
        moeArchiveReviewState: srcArchives.length ? [...new Set(srcArchives.map((x: Row) => x.reviewState))] : [],
        extractionMembers: members.map((m) => ({ archive: m.archive, scope: m.scope, pages: m.pages, decodedPages: m.decodedPages, unreadablePages: m.unreadablePages, objectiveSentences: m.objectiveSentences, objectiveCandidates: m.objectiveCandidates })),
        executableReleases: cellReleases.map((r: Row) => r.id),
        staleReleaseBindings: cellReleases.filter((r: Row) => staleRelease.has(r.id)).map((r: Row) => r.id),
        toolPolicies: cellReleases.reduce((n: number, r: Row) => n + (r.toolPolicies?.length ?? 0), 0),
        typedLabDefinitions: cellLabs.map((l) => l.id),
      },
    };
    return { ...row, classification: classify(row), gaps: gapsFor(row) };
  }));

  // ---------------- Orphans / reusable ----------------
  const outOfScope = analyses.filter((a) => !a.cell);
  const orphanHomework = live.homework.filter((h) => h.contentId && !contentIds.has(h.contentId)).length;
  const orphanAssignments = live.assignments.filter((h) => h.contentId && !contentIds.has(h.contentId)).length;
  const unitsOutOfScope = live.units.filter((u) => { const r = resolveSubject(u.subject).canonical; return !r || !SUBJECTS.includes(r); });
  const reusableUnpublished = analyses.filter((a) => a.cell && !APPROVED_STATUS.has(String(a.status).toUpperCase()) && a.status !== "REVOKED" && (a.sections.objectives || a.sections.activities));

  const count = <T,>(xs: T[], p: (x: T) => boolean) => xs.filter(p).length;
  const report = {
    mission: "LIVE CURRICULUM RECONCILIATION V2",
    readOnly: true,
    generatedAt: new Date().toISOString(),
    database: { addr: live.identity.addr, db: live.identity.db, readAt: live.identity.at },
    scope: { grades: GRADES, subjects: SUBJECTS, cells: GRADES.length * SUBJECTS.length },
    totals: {
      curriculumContent: live.contents.length,
      lessonsInScopeCells: count(analyses, (a) => !!a.cell),
      lessonsOutOfScope: outOfScope.length,
      byGovernance: Object.fromEntries([...new Set(analyses.map((a) => a.gov))].map((gv) => [gv, count(analyses, (a) => a.gov === gv)])),
      provenanceRecords: count(analyses, (a) => a.hasProvenance),
      provenanceUnverified: count(analyses, (a) => a.completeness === "UNVERIFIED"),
      legacyUnknownOrigin: count(analyses, (a) => a.origin === "LEGACY_UNKNOWN"),
      statusPayloadConflicts: count(analyses, (a) => a.statusPayloadConflict),
      aiGeneratedNeedsReview: count(analyses, (a) => a.aiGeneratedNeedsReview),
      systemApproved: count(analyses, (a) => !!a.systemApprover),
      moeApprovalClaims: count(analyses, (a) => a.moeClaim),
      duplicateLessonGroups: duplicateLessonGroups.length,
      duplicateLessonRows: duplicateLessonGroups.reduce((n, g) => n + g.length, 0),
      lessonsWithoutObjectives: count(analyses, (a) => !!a.cell && !a.sections.objectives),
      danglingUnitLinks: count(analyses, (a) => a.unitLinkDangling),
      lessonsWithoutPlanOrUnit: count(analyses, (a) => !!a.cell && !a.planned && !a.unitBound),
      units: live.units.length, unitsOutOfScope: unitsOutOfScope.length,
      moeObjectives: live.moeObjectives.reduce((n, o) => n + o.n, 0),
      learningTargets: live.learningTargets.reduce((n, o) => n + o.n, 0),
      homework: live.homework.length, assignments: live.assignments.length,
      orphanHomework, orphanAssignments,
      homeworkWithoutLessonLink: count(live.homework, (h) => !h.contentId),
      assignmentsWithoutLessonLink: count(live.assignments, (h) => !h.contentId),
      prerequisiteEdges: live.prereqs.length,
      prerequisiteEdgesDangling: count(live.prereqs, (p) => !contentPks.has(p.lessonId) || !contentPks.has(p.prerequisiteLessonId)),
      lessonVariantsOrphaned: live.variants.filter((v) => !contentPks.has(v.id)).reduce((n, v) => n + v.n, 0),
      aiLiteracyExercisesOrphaned: live.aiLiteracy.filter((v) => !contentPks.has(v.id)).reduce((n, v) => n + v.n, 0),
      codeExercisesOrphaned: live.codeExercises.filter((v) => !contentPks.has(v.id)).reduce((n, v) => n + v.n, 0),
      exams: live.exams.length, examQuestions: live.exams.reduce((n, e) => n + e.questions, 0),
      practiceItems: live.practiceItems.reduce((n, x) => n + x.n, 0),
      waecPracticeItems: live.waec.reduce((n, x) => n + x.n, 0),
      aiLiteracyExercises: live.aiLiteracy.reduce((n, x) => n + x.n, 0),
      codeExercises: live.codeExercises.reduce((n, x) => n + x.n, 0),
      textbookJobs: live.textbooks.length,
      virtualLabs: live.virtualLabs.length, labSessions: live.labSessions, capstoneProjects: live.capstones,
      policyConfigs: live.policyConfigs, curriculumVersions: live.curriculumVersions,
      executableReleases: releases.length, toolPolicies: releases.reduce((n: number, r: Row) => n + (r.toolPolicies?.length ?? 0), 0),
      typedLabDefinitions: labs.length, declaredLabIds: declaredLabIds.length,
    },
    classificationCounts: Object.fromEntries([...new Set(cells.map((c) => c.classification))].map((cl) => [cl, cells.filter((c) => c.classification === cl).length])),
    extraction,
    releaseBindings,
    labs: { typed: labs, declaredWithoutDefinition: declaredLabIds.filter((id) => !labs.some((l) => l.id === id)) },
    outOfScopeContentBySubject: Object.fromEntries([...new Set(outOfScope.map((a) => `${a.rawSubject}`))].map((s) => [s, count(outOfScope, (a) => a.rawSubject === s)])),
    unitsOutOfScopeBySubject: Object.fromEntries([...new Set(unitsOutOfScope.map((u) => u.subject))].map((s) => [s, count(unitsOutOfScope, (u) => u.subject === s)])),
    duplicateLessonGroups: duplicateLessonGroups.map((g) => ({ cell: g[0]!.cell, title: g[0]!.title, contentIds: g.map((x) => x.contentId), statuses: g.map((x) => x.status) })),
    reusableUnpublished: reusableUnpublished.map((a) => ({ cell: a.cell, contentId: a.contentId, title: a.title, status: a.status })),
    cells,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "live-reconciliation-v2.json"), `${JSON.stringify(report, null, 2)}\n`);
  const csvCols = ["grade", "subject", "classification", "lessons", "humanReviewed", "legacyStatusOnly", "objectivesInPayload", "classwork", "homework", "practice", "quiz", "assessmentQuestions", "labsInPayload", "typedLabs", "units", "moeObjectives", "exams", "moeArchive", "releases", "gaps"];
  const csv = [csvCols.join(",")].concat(cells.map((c) => [
    c.grade, c.subject, c.classification, c.live.lessons,
    c.live.lessonsByGovernance.LIBERIALEARN_HUMAN_REVIEWED ?? 0, c.live.lessonsByGovernance.LEGACY_STATUS_ONLY_NO_GOVERNANCE_RECORD ?? 0,
    c.live.payloadSections.objectives, c.live.payloadSections.classwork, c.live.payloadSections.homework, c.live.payloadSections.practice,
    c.live.payloadSections.quiz, c.live.payloadSections.assessmentQuestions, c.live.payloadSections.labs, c.repository.typedLabDefinitions.length,
    c.live.units, c.live.moeObjectives, c.live.exams, c.repository.moeArchiveSources.length ? "yes" : "no", c.repository.executableReleases.length,
    `"${c.gaps.join(";")}"`,
  ].join(",")));
  fs.writeFileSync(path.join(outDir, "cell-matrix.csv"), `${csv.join("\n")}\n`);
  console.log(JSON.stringify({ outDir, totals: report.totals, classificationCounts: report.classificationCounts }, null, 2));
}

type CellRow = { grade: number; subject: string; live: Row; repository: Row };

function classify(c: CellRow): string {
  const L = c.live, R = c.repository;
  const hasLive = L.lessons > 0;
  const hasSource = R.moeArchiveSources.length > 0 || L.activeAuthoritySources > 0;
  // A registered release whose bindings do not resolve live cannot execute.
  if (R.executableReleases.length > 0 && (!hasLive || R.staleReleaseBindings.length > 0)) return "RELEASE_BINDING_GAP";
  if (hasLive) {
    if (R.executableReleases.length > 0) return gapsFor(c).length === 0 ? "LIVE_EXECUTABLE_COMPLETE" : "LIVE_PARTIAL";
    if (L.statusPayloadConflicts > 0 || (L.lessonsByGovernance.LEGACY_STATUS_ONLY_NO_GOVERNANCE_RECORD ?? 0) === L.lessons && L.moeApprovalClaims > 0) return "AUTHORITY_CONFLICT";
    if (L.boundToLessonPlan === 0 && L.boundToUnit === 0 && L.payloadSections.objectives === 0) return "ORPHANED_LIVE_CONTENT";
    return "RELEASE_BINDING_GAP";
  }
  if (hasSource) return "SOURCE_EXISTS_NOT_IMPORTED";
  if (R.executableReleases.length > 0 || R.typedLabDefinitions.length > 0) return "REPOSITORY_ONLY";
  return "NO_VERIFIED_SOURCE";
}

function gapsFor(c: CellRow): string[] {
  const L = c.live, R = c.repository, P = L.payloadSections, g: string[] = [];
  if (L.lessons === 0) g.push("NO_LIVE_LESSONS");
  if (!R.moeArchiveSources.length && !L.activeAuthoritySources) g.push("NO_VERIFIED_SOURCE");
  if (L.moeObjectives + L.learningTargets === 0) g.push("NO_GOVERNED_OBJECTIVES");
  if (L.lessons && P.objectives < L.lessons) g.push("LESSONS_WITHOUT_OBJECTIVES");
  if (L.lessons && (L.lessonsByGovernance.LIBERIALEARN_HUMAN_REVIEWED ?? 0) + (L.lessonsByGovernance.MOE_APPROVED ?? 0) < L.lessons) g.push("LESSONS_WITHOUT_HUMAN_REVIEW");
  if (L.provenanceVerifiedOrPartial < L.lessons) g.push("UNVERIFIED_PROVENANCE");
  if (!P.classwork) g.push("NO_CLASSWORK");
  if (!P.homework && !L.homework) g.push("NO_HOMEWORK");
  if (!P.practice && !L.practiceItemsForBand) g.push("NO_PRACTICE");
  if (!P.quiz && !P.assessmentQuestions) g.push("NO_QUIZ_OR_ITEMS");
  if (!L.exams) g.push("NO_TEST_OR_EXAM");
  g.push("NO_DIAGNOSTIC_BINDING");
  if (!L.units) g.push("NO_UNIT_STRUCTURE");
  if (!L.textbooks) g.push("NO_TEXTBOOK_RESOURCE");
  if (!R.executableReleases.length) g.push("NO_EXECUTABLE_RELEASE");
  if (R.staleReleaseBindings.length) g.push("STALE_RELEASE_BINDING");
  if (!R.toolPolicies) g.push("NO_TOOL_POLICY");
  if (c.subject === "SCIENCE" && !R.typedLabDefinitions.length) g.push("NO_TYPED_LAB");
  if (L.lessonsNonCanonicalSubjectValue) g.push("NON_CANONICAL_SUBJECT_BINDING");
  return g;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
