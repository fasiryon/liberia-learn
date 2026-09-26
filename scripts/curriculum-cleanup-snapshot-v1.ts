/**
 * Curriculum cleanup snapshot V1 (READ-ONLY).
 *
 * Captures the production rows the cleanup plan needs (lessons, every lesson
 * reference column, prerequisite edges, variants with full before-images,
 * units) plus the Grade 4 Math cell detail used by the template-cell
 * reconciliation. Every query runs inside one `SET TRANSACTION READ ONLY`
 * transaction. Nothing is written to the database.
 *
 * Output: artifacts/curriculum-cleanup-v1/snapshot.json
 *         artifacts/curriculum-cleanup-v1/g4-math-live.json
 *
 * Usage: DIRECT_URL=<read connection> npx tsx scripts/curriculum-cleanup-snapshot-v1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { CurriculumSnapshot, SnapshotContent, SnapshotReference } from "@/lib/curriculum/cleanup/cleanupPlan";
import { getCanonicalSubjectCode } from "@/lib/curriculum/subjectTaxonomy";

type Row = Record<string, any>;
const OUT = path.resolve("artifacts/curriculum-cleanup-v1");

// Every column that stores a CurriculumContent key (schema-derived, 2026-09-26).
// Key (id vs contentId) is measured per value, not assumed.
// policy REPOINT = forward binding; RETAIN_HISTORY = record of what happened.
// Excluded on purpose: CurriculumProvenance / LessonVersion / CurriculumRegenerationJob
// (per-lesson history), StudentSession / StuckEvent (store ScheduledWork ids),
// LessonPrerequisite / LessonVariant (captured separately).
const REFERENCE_COLUMNS: { table: string; column: string; learnerData: boolean; policy: "REPOINT" | "RETAIN_HISTORY"; uniquePerLesson: boolean }[] = [
  { table: "CurriculumLessonPlan", column: "curriculumContentId", learnerData: false, policy: "REPOINT", uniquePerLesson: true },
  { table: "TimetableAssignment", column: "curriculumContentId", learnerData: false, policy: "REPOINT", uniquePerLesson: false },
  { table: "AssignmentSuggestion", column: "contentId", learnerData: false, policy: "REPOINT", uniquePerLesson: false },
  { table: "TeacherLessonAssignment", column: "contentId", learnerData: true, policy: "REPOINT", uniquePerLesson: false },
  { table: "LearningPathQueue", column: "lessonId", learnerData: true, policy: "REPOINT", uniquePerLesson: false },
  { table: "LessonShare", column: "lessonId", learnerData: false, policy: "REPOINT", uniquePerLesson: false },
  { table: "LessonAudio", column: "lessonId", learnerData: false, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "LessonVideo", column: "lessonId", learnerData: false, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "CodeExercise", column: "lessonId", learnerData: false, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "AILiteracyExercise", column: "lessonId", learnerData: false, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "Assignment", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "Homework", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "ScheduledWork", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "GradedSubmission", column: "lessonId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "LearningEvent", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "LearningEvent", column: "lessonId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "StudentPerformanceEvent", column: "lessonId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "ConfusionSignal", column: "lessonId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "AIInteraction", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "AIInteraction", column: "lessonId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "TeacherAction", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "InterventionRecommendation", column: "lessonId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "CurriculumFlag", column: "lessonId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "DiscussionThread", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "TutorConversation", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "LessonHelpFlag", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "TeachingSession", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
  { table: "TeachingLedger", column: "contentId", learnerData: true, policy: "RETAIN_HISTORY", uniquePerLesson: false },
];

// Same section names as scripts/live-curriculum-reconciliation-v2.ts.
const PAYLOAD_SECTIONS: Record<string, string[]> = {
  objectives: ["objectives", "learningObjectives"], activities: ["activities"],
  classwork: ["studentWorksheet", "guidedPractice"], homework: ["homeworkSet"],
  practice: ["independentPractice", "problemSets", "workedExamples"], quiz: ["quiz"],
  assessmentQuestions: ["assessmentQuestions", "assessment"], formativeChecks: ["formativeChecks"],
  labs: ["labs"], labDefinitionSpecs: ["labDefinitionSpecs"],
  teacherResources: ["teacherGuide", "teacherNotes", "teacherNotesSummary"],
  guardianOutputs: ["guardianSupport"], remediation: ["remediation"], misconceptions: ["commonMisconceptions"],
  textbookRefs: ["textbookReferences", "textbookRefs", "resources", "materials"],
  diagnostic: ["diagnostic", "preAssessment", "diagnosticCheck"], project: ["project", "projects", "practicalWalkthrough"],
};
const nonEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v as object).some(nonEmpty);
  return true;
};
const sectionsOf = (payload: Row) => Object.keys(PAYLOAD_SECTIONS).filter((name) => PAYLOAD_SECTIONS[name]!.some((k) => nonEmpty(payload[k])));

async function main() {
  const url = process.env.DIRECT_URL?.trim();
  if (!url) throw new Error("DIRECT_URL is required");
  const prisma = new PrismaClient({ datasourceUrl: url, log: [] });

  const live = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const q = <T = Row>(sql: string) => tx.$queryRawUnsafe<T[]>(sql);
    const identity = (await q(`select current_database() db, inet_server_addr()::text addr, now() as at`))[0]!;
    const contents = await q(`select c.id, c."contentId", c.title, c.grade, c.subject, c.status, c."unitId", c.payload, c."updatedAt",
        p."currentRevisionId" rev_id
      from "CurriculumContent" c left join "CurriculumProvenance" p on p."curriculumContentId" = c.id`);
    const events = await q(`select e."eventType"::text event, e."approvalBasis"::text basis, e."occurredAt", p."curriculumContentId" content_id
      from "CurriculumGovernanceEvent" e join "CurriculumContentRevision" r on r.id = e."revisionId"
      join "CurriculumProvenance" p on p.id = r."provenanceId"`);
    const references: Row[] = [];
    for (const ref of REFERENCE_COLUMNS) {
      const rows = await q(`select "${ref.column}" v, count(*)::int n from "${ref.table}" where "${ref.column}" is not null group by 1`);
      references.push(...rows.map((row) => ({ ...ref, value: row.v as string, rows: row.n as number })));
    }
    const prerequisites = await q(`select id, "lessonId", "prerequisiteLessonId" from "LessonPrerequisite"`);
    const variants = await q(`select id, "lessonId", "variantType", body, "createdAt" from "LessonVariant"`);
    const units = await q(`select id, "unitId", grade, subject, coalesce(title, name) title, "orderIndex" from "CurriculumUnit"`);

    // Grade 4 Math cell detail (template cell).
    const g4 = {
      units: await q(`select u.id, u."unitId", u.name, u.title, u.subject, u."orderIndex", u."weekStart", u."weekEnd", u."targetStandardCodes",
          (select count(*)::int from "CurriculumWeek" w where w."unitId" = u.id) weeks
        from "CurriculumUnit" u where u.grade = 4 and upper(u.subject) in ('MATH','MATHEMATICS')`),
      learningTargets: await q(`select code, subject, grade, "verificationStatus"::text status from "CurriculumLearningTarget" where grade = 4`),
      moeObjectives: await q(`select * from "MoeCurriculumObjective" where grade = 4`),
      standards: await q(`select code, subject::text subject, band::text band from "Standard" where code like 'LR-MATH-G4%' or (subject::text = 'MATH' and band::text = 'G4_6')`),
      skills: await q(`select id, subject::text subject, band::text band from "Skill" where subject::text = 'MATH' and band::text = 'G4_6'`),
      practiceItems: await q(`select s.id skill, count(*)::int n from "PracticeItem" pi join "Skill" s on s.id = pi."skillId" where s.subject::text = 'MATH' and s.band::text = 'G4_6' group by 1`),
      homework: await q(`select h."contentId", count(*)::int n from "Homework" h join "Class" c on c.id = h."classId" where c."gradeLevel" = 4 and upper(c.subject::text) like 'MATH%' group by 1`),
      assignments: await q(`select a."contentId", count(*)::int n from "Assignment" a join "Class" c on c.id = a."classId" where c."gradeLevel" = 4 and upper(c.subject::text) like 'MATH%' group by 1`),
      exams: await q(`select e.id, e.title, e.status::text status, (select count(*)::int from "ExamQuestion" x where x."examId" = e.id) questions from "Exam" e where e.grade = 4 and upper(e.subject::text) like 'MATH%'`),
      textbooks: await q(`select id, status, "storageUrl" is not null has_file from "TextbookGenerationJob" where grade = 4 and upper(subject) like 'MATH%'`),
      virtualLabs: await q(`select id, title, status from "VirtualLab" where grade = 4 and upper(subject::text) like 'MATH%'`),
      releaseBindingProbe: {
        lesson: await q(`select id, "contentId", status from "CurriculumContent" where "contentId" = 'll-g4-math-fractions-equal-parts-2026.1'`),
        target: await q(`select code from "CurriculumLearningTarget" where code = 'LR-MATH-G4_6-02'`),
        standard: await q(`select code from "Standard" where code = 'LR-MATH-G4_6-02'`),
        skill: await q(`select id from "Skill" where id = 'placement-skill-MATH-G4_6'`),
      },
    };
    return { identity, contents, events, references, prerequisites, variants, units, g4 };
  }, { timeout: 300_000 });
  await prisma.$disconnect();

  // Governance per lesson: last APPROVED/REVOKED/REINSTATED decision.
  const eventsByContent = new Map<string, Row[]>();
  for (const event of live.events) eventsByContent.set(event.content_id, [...(eventsByContent.get(event.content_id) ?? []), event]);
  const lastGovernance = (id: string): SnapshotContent["lastGovernance"] => {
    const decisions = (eventsByContent.get(id) ?? []).filter((e) => ["APPROVED", "REVOKED", "REINSTATED"].includes(e.event))
      .sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
    const last = decisions.at(-1);
    if (!last) return "NONE";
    if (last.event === "REVOKED") return "REVOKED";
    return last.basis === "HUMAN_REVIEW" ? "HUMAN_REVIEW" : "AUTOMATED_RISK_POLICY";
  };

  const contents: SnapshotContent[] = live.contents.map((c) => {
    const payload = (c.payload && typeof c.payload === "object" ? c.payload : {}) as Row;
    return {
      id: c.id, contentId: c.contentId, title: String(c.title ?? ""), grade: c.grade, subject: c.subject,
      canonicalSubject: getCanonicalSubjectCode(c.subject) ?? null, status: c.status, unitId: c.unitId ?? null,
      payloadApprovalStatus: payload.approvalStatus ? String(payload.approvalStatus).toUpperCase() : null,
      sectionCount: sectionsOf(payload).length, currentRevisionId: c.rev_id ?? null,
      lastGovernance: lastGovernance(c.id), updatedAt: new Date(c.updatedAt).toISOString(),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  // Resolve which lesson key each reference value stores; drop values that match no lesson.
  const pks = new Set(contents.map((c) => c.id));
  const cids = new Set(contents.map((c) => c.contentId));
  const unresolved: Record<string, number> = {};
  const references: SnapshotReference[] = [];
  for (const ref of live.references) {
    const key = pks.has(ref.value) ? "id" : cids.has(ref.value) ? "contentId" : null;
    if (!key) { unresolved[`${ref.table}.${ref.column}`] = (unresolved[`${ref.table}.${ref.column}`] ?? 0) + ref.rows; continue; }
    references.push({ table: ref.table, column: ref.column, key, value: ref.value, rows: ref.rows, learnerData: ref.learnerData, policy: ref.policy, uniquePerLesson: ref.uniquePerLesson });
  }
  references.sort((a, b) => `${a.table}.${a.column}:${a.value}`.localeCompare(`${b.table}.${b.column}:${b.value}`));

  const snapshot: CurriculumSnapshot & { unresolvedReferenceRows: Record<string, number> } = {
    capturedAt: new Date(live.identity.at).toISOString(),
    database: { db: live.identity.db, addr: live.identity.addr ?? null },
    contents,
    references,
    prerequisites: live.prerequisites.map((e) => ({ id: e.id, lessonId: e.lessonId, prerequisiteLessonId: e.prerequisiteLessonId })).sort((a, b) => a.id.localeCompare(b.id)),
    variants: live.variants.map((v) => ({ id: v.id, lessonId: v.lessonId, row: { ...v, createdAt: new Date(v.createdAt).toISOString() } })).sort((a, b) => a.id.localeCompare(b.id)),
    units: live.units.map((u) => ({ id: u.id, unitId: u.unitId, grade: u.grade, subject: u.subject, title: String(u.title ?? ""), sequence: u.orderIndex ?? null })).sort((a, b) => a.id.localeCompare(b.id)),
    unresolvedReferenceRows: unresolved,
  };

  // Grade 4 Math lessons with section detail (payload is summarized, not copied).
  const g4Lessons = live.contents.filter((c) => c.grade === 4 && getCanonicalSubjectCode(c.subject) === "MATH").map((c) => {
    const payload = (c.payload && typeof c.payload === "object" ? c.payload : {}) as Row;
    const snap = contents.find((x) => x.id === c.id)!;
    const objectives = [payload.objectives, payload.learningObjectives].find((v) => Array.isArray(v) && v.length) as unknown[] | undefined;
    const labs = Array.isArray(payload.labs) ? payload.labs : [];
    return {
      id: c.id, contentId: c.contentId, title: snap.title, status: c.status, unitId: c.unitId ?? null,
      lastGovernance: snap.lastGovernance, payloadApprovalStatus: snap.payloadApprovalStatus,
      sections: sectionsOf(payload),
      objectives: (objectives ?? []).map((o) => typeof o === "string" ? o : String((o as Row)?.text ?? (o as Row)?.description ?? JSON.stringify(o))),
      moeAlignments: payload.moeAlignments ?? null,
      counts: {
        quiz: Array.isArray(payload.quiz) ? payload.quiz.length : Array.isArray(payload.quiz?.questions) ? payload.quiz.questions.length : 0,
        homework: Array.isArray(payload.homeworkSet) ? payload.homeworkSet.length : Array.isArray(payload.homeworkSet?.problems) ? payload.homeworkSet.problems.length : nonEmpty(payload.homeworkSet) ? 1 : 0,
        labs: labs.length,
      },
      labs: labs.map((lab: Row) => ({ id: lab?.id ?? lab?.labId ?? null, type: lab?.type ?? lab?.kind ?? null, title: lab?.title ?? null })),
      labDefinitionSpecs: Array.isArray(payload.labDefinitionSpecs) ? payload.labDefinitionSpecs.map((s: Row) => ({ id: s?.id ?? null, threeDReady: s?.threeDReady ?? null })) : [],
      offline: payload.offline ?? payload.offlineMode ?? null,
    };
  }).sort((a, b) => a.contentId.localeCompare(b.contentId));

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "snapshot.json"), `${JSON.stringify(snapshot, null, 1)}\n`);
  fs.writeFileSync(path.join(OUT, "g4-math-live.json"), `${JSON.stringify({ capturedAt: snapshot.capturedAt, database: snapshot.database, lessons: g4Lessons, ...live.g4 }, null, 1)}\n`);
  console.log(JSON.stringify({
    database: snapshot.database, capturedAt: snapshot.capturedAt, contents: contents.length, references: references.length,
    prerequisites: snapshot.prerequisites.length, variants: snapshot.variants.length, units: snapshot.units.length,
    unresolvedReferenceRows: unresolved, g4MathLessons: g4Lessons.length, g4ReleaseProbe: live.g4.releaseBindingProbe,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
