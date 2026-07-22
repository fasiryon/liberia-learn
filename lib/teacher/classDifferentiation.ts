/**
 * lib/teacher/classDifferentiation.ts, Sprint 7.2
 *
 * Class-wide teacher differentiation rollup. Reuses Sprint 6.7's exact
 * scoring model (lib/student/nextBestAction.ts: scoreCriticalMastery,
 * scoreOverdue, scoreWaecPractice, rankNextBestActions) and the exact pure
 * mastery/readiness math (combinedMastery, alertTier, weightedAssessmentScore
 * from lib/student/adaptiveRecommendations.ts; computeSubjectReadiness from
 * lib/waec/readiness.ts) - never re-derives the scoring logic.
 *
 * What is deliberately NOT duplicated here: the full per-student
 * /api/student/today computation. Real production measurement (a 44-student
 * class, 5 real students) showed that route costs 2.4s-10.4s+ per student on
 * a cold cache, sometimes exceeding the route's own internal 8s degradation
 * shield. Calling it once per student for a 40-60 student class would be
 * untenable. Instead, this module issues a small, fixed number of batched,
 * class-scoped queries (one per signal type, not one per student) and feeds
 * the same per-student pure scoring functions the route already uses.
 *
 * Scope, honestly bounded: this rollup surfaces CRITICAL_MASTERY, OVERDUE,
 * and WAEC_PRACTICE signals only - the three explicitly named in this
 * sub-sprint's plan ("behind on WAEC readiness, stuck on a specific strand,
 * certificate-eligible but not notified"). It does not replicate the lesson-
 * recommendation subsystem behind REVISIT_PREREQUISITE / RETRY_ASSESSMENT /
 * REVIEW / CONTINUE / ADVANCE (that logic maps a weak signal to a specific
 * next lesson via lib/student/adaptiveRecommendations.ts's scheduledWork-
 * based lesson picker) - a teacher who wants that per-student detail can open
 * the student's own /teacher/students/[studentId] or /teacher/intelligence
 * page, which already exists and is unaffected by this sub-sprint.
 *
 * A real existing InterventionRecommendation table looked like it might
 * already provide this signal pre-computed, but investigation found it is
 * empty platform-wide (0 rows) - real infrastructure, no populating process
 * running - so it was not a usable data source and is not read here.
 */

import { prisma } from "@/lib/db";
import type { $Enums } from "@prisma/client";
import {
  combinedMastery,
  weightedAssessmentScore,
  alertTier,
} from "@/lib/student/adaptiveRecommendations";
import { computeSubjectReadiness } from "@/lib/waec/readiness";
import { getWaecSubjects, subjectStrandRefs, type WaecSubjectId } from "@/lib/waec/syllabus";
import { isWaecEligible } from "@/lib/waec/eligibility";
import { getCertificateProximity } from "@/lib/certificates/certificateProgress";
import {
  rankNextBestActions,
  scoreCriticalMastery,
  scoreOverdue,
  scoreWaecPractice,
  type NextActionCandidate,
} from "@/lib/student/nextBestAction";

type Subject = $Enums.Subject;

export type ClassDifferentiationStudent = {
  studentId: string;
  userId: string;
  name: string;
  currentGrade: number | null;
  hero: NextActionCandidate | null;
  interventionCount: number;
  certificateProximity: {
    subject: string;
    completionPct: number;
    remainingLessons: number;
  } | null;
};

export type ClassDifferentiationResult = {
  classId: string;
  className: string;
  studentCount: number;
  generatedAt: string;
  /** Students grouped by their top intervention type, most severe group first. */
  groups: Array<{
    type: NextActionCandidate["type"] | "ON_TRACK";
    label: string;
    students: ClassDifferentiationStudent[];
  }>;
};

const GROUP_LABEL: Record<string, string> = {
  CRITICAL_MASTERY: "Critical mastery gap",
  OVERDUE: "Overdue work",
  WAEC_PRACTICE: "Behind on WAEC readiness",
  ON_TRACK: "On track",
};

function subjectMastery(
  assessmentBySubject: Map<string, number[]>,
  snapshotBySubject: Map<string, number>,
  derivedBySubject: Map<string, number>
): Map<string, number> {
  const allSubjects = new Set([
    ...assessmentBySubject.keys(),
    ...snapshotBySubject.keys(),
    ...derivedBySubject.keys(),
  ]);
  const out = new Map<string, number>();
  for (const subject of allSubjects) {
    const scores = assessmentBySubject.get(subject) ?? [];
    const assessScore = weightedAssessmentScore(scores);
    const snapScore = snapshotBySubject.get(subject) ?? null;
    const derivScore = derivedBySubject.get(subject) ?? null;
    const { score } = combinedMastery(assessScore, snapScore, derivScore);
    out.set(subject, score);
  }
  return out;
}

export async function buildClassDifferentiationRollup(classId: string): Promise<ClassDifferentiationResult> {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, schoolId: true },
  });
  if (!classRecord) throw Object.assign(new Error("Class not found"), { status: 404 });

  const enrollments = await prisma.enrollment.findMany({
    where: { classId },
    select: {
      studentId: true,
      Student: {
        select: { userId: true, currentGrade: true, user: { select: { name: true } } },
      },
    },
  });

  const students = enrollments
    .filter((e) => e.Student)
    .map((e) => ({
      studentId: e.studentId,
      userId: e.Student!.userId,
      name: e.Student!.user?.name ?? "Student",
      currentGrade: e.Student!.currentGrade,
    }));

  if (students.length === 0) {
    return { classId, className: classRecord.name, studentCount: 0, generatedAt: new Date().toISOString(), groups: [] };
  }

  const studentIds = students.map((s) => s.studentId);
  const now = new Date();

  // ── Batched query 1: mastery signals, one query set for the whole class ──
  const [assessmentAttempts, masterySnapshots, derivedProgress] = await Promise.all([
    prisma.assessmentAttempt.findMany({
      where: { studentId: { in: studentIds }, source: "student.lesson.quiz.submit" },
      select: { studentId: true, subject: true, score: true, attemptedAt: true },
      orderBy: { attemptedAt: "desc" },
    }),
    prisma.masterySnapshot.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, subject: true, currentScore: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.derivedStudentProgress.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, subject: true, currentScore: true, derivedAt: true },
      orderBy: { derivedAt: "desc" },
    }),
  ]);

  const assessmentByStudent = new Map<string, Map<string, number[]>>();
  for (const a of assessmentAttempts) {
    if (typeof a.score !== "number") continue;
    const subject = a.subject ?? "GENERAL";
    const bySubject = assessmentByStudent.get(a.studentId) ?? new Map<string, number[]>();
    const scores = bySubject.get(subject) ?? [];
    scores.push(a.score);
    bySubject.set(subject, scores);
    assessmentByStudent.set(a.studentId, bySubject);
  }
  const snapshotByStudent = new Map<string, Map<string, number>>();
  for (const s of masterySnapshots) {
    if (typeof s.currentScore !== "number") continue;
    const bySubject = snapshotByStudent.get(s.studentId) ?? new Map<string, number>();
    if (!bySubject.has(s.subject)) bySubject.set(s.subject, s.currentScore);
    snapshotByStudent.set(s.studentId, bySubject);
  }
  const derivedByStudent = new Map<string, Map<string, number>>();
  for (const d of derivedProgress) {
    if (typeof d.currentScore !== "number") continue;
    const bySubject = derivedByStudent.get(d.studentId) ?? new Map<string, number>();
    if (!bySubject.has(d.subject)) bySubject.set(d.subject, d.currentScore);
    derivedByStudent.set(d.studentId, bySubject);
  }

  // ── Batched query 2: overdue assignments for this class, one query ──
  const overdueAssignments = await prisma.assignment.findMany({
    where: { classId, dueAt: { lt: now } },
    select: {
      id: true,
      title: true,
      dueAt: true,
      submissions: { where: { studentId: { in: studentIds } }, select: { studentId: true } },
    },
  });

  // ── Batched query 3: WAEC readiness across the whole WAEC-eligible subset ──
  const waecEligibleStudentIds = students.filter((s) => isWaecEligible(s.currentGrade)).map((s) => s.studentId);
  const waecSubjects = getWaecSubjects();
  const allStrandRefs = waecSubjects.flatMap((s) => subjectStrandRefs(s.id));
  const strandKeysBySubject = new Map<Subject, Set<string>>();
  for (const ref of allStrandRefs) {
    const set = strandKeysBySubject.get(ref.subject) ?? new Set<string>();
    set.add(ref.strandKey);
    strandKeysBySubject.set(ref.subject, set);
  }
  const masterySubjectsUsed = Array.from(strandKeysBySubject.keys());
  const allStrandKeys = Array.from(new Set(allStrandRefs.map((r) => r.strandKey)));

  const masteryProfiles =
    waecEligibleStudentIds.length > 0 && masterySubjectsUsed.length > 0
      ? await prisma.studentMasteryProfile.findMany({
          where: {
            studentId: { in: waecEligibleStudentIds },
            subject: { in: masterySubjectsUsed },
            strandKey: { in: allStrandKeys },
            lastAssessedAt: { not: null },
          },
          select: { studentId: true, subject: true, strandKey: true, currentScore: true, baselineScore: true },
        })
      : [];

  const profilesByStudent = new Map<string, Map<string, { current: number; baseline: number }>>();
  for (const p of masteryProfiles) {
    const byStrand = profilesByStudent.get(p.studentId) ?? new Map<string, { current: number; baseline: number }>();
    byStrand.set(p.strandKey, { current: p.currentScore, baseline: p.baselineScore });
    profilesByStudent.set(p.studentId, byStrand);
  }

  // ── Build per-student candidates from the batched, grouped data ──
  const studentResults: ClassDifferentiationStudent[] = [];

  for (const student of students) {
    const candidates: NextActionCandidate[] = [];
    const href = `/teacher/students/${student.studentId}`;

    const assessmentBySubject = assessmentByStudent.get(student.studentId) ?? new Map<string, number[]>();
    const snapshotBySubject = snapshotByStudent.get(student.studentId) ?? new Map<string, number>();
    const derivedBySubject = derivedByStudent.get(student.studentId) ?? new Map<string, number>();
    const masteryBySubject = subjectMastery(assessmentBySubject, snapshotBySubject, derivedBySubject);

    let weakestSubject: string | null = null;
    let weakestScore = 101;
    for (const [subject, score] of masteryBySubject) {
      if (score < weakestScore) {
        weakestScore = score;
        weakestSubject = subject;
      }
    }
    if (weakestSubject && alertTier(weakestScore) === "critical") {
      candidates.push({
        type: "CRITICAL_MASTERY",
        priority: scoreCriticalMastery(weakestScore),
        label: `Critical: ${weakestSubject}`,
        reason: `${student.name}'s ${weakestSubject} mastery is ${weakestScore}%.`,
        href,
        subject: weakestSubject,
        masteryPercent: weakestScore,
        lastSignalAt: null,
      });
    }

    const studentOverdue = overdueAssignments.filter(
      (a) => !a.submissions.some((sub) => sub.studentId === student.studentId)
    );
    if (studentOverdue.length > 0) {
      const oldest = studentOverdue.reduce((a, b) => (a.dueAt < b.dueAt ? a : b));
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - oldest.dueAt.getTime()) / 86_400_000));
      candidates.push({
        type: "OVERDUE",
        priority: scoreOverdue(daysOverdue),
        label: `${studentOverdue.length} overdue assignment${studentOverdue.length === 1 ? "" : "s"}`,
        reason: `Oldest overdue: "${oldest.title}", ${daysOverdue === 0 ? "due today" : `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`}.`,
        href,
        subject: "GENERAL",
        masteryPercent: null,
        lastSignalAt: oldest.dueAt.toISOString(),
      });
    }

    if (isWaecEligible(student.currentGrade)) {
      const strandScores = profilesByStudent.get(student.studentId) ?? new Map();
      let weakestWaec: { subjectId: WaecSubjectId; name: string; readiness: number; nextFocusName: string | null } | null = null;
      for (const subject of waecSubjects) {
        const relevantStrands = subjectStrandRefs(subject.id).map((r) => r.strandKey);
        const scores: Record<string, { current: number; baseline: number }> = {};
        for (const key of relevantStrands) {
          const found = strandScores.get(key);
          if (found) scores[key] = found;
        }
        const readiness = computeSubjectReadiness(subject.id, scores);
        if (readiness.available && readiness.readiness != null && readiness.readiness < 75) {
          if (!weakestWaec || readiness.readiness < weakestWaec.readiness) {
            weakestWaec = {
              subjectId: subject.id,
              name: subject.name,
              readiness: readiness.readiness,
              nextFocusName: readiness.nextFocusName,
            };
          }
        }
      }
      if (weakestWaec) {
        candidates.push({
          type: "WAEC_PRACTICE",
          priority: scoreWaecPractice(weakestWaec.readiness),
          label: `${weakestWaec.name} readiness: ${weakestWaec.readiness}%`,
          reason: `${student.name}'s ${weakestWaec.name} readiness is ${weakestWaec.readiness}%${weakestWaec.nextFocusName ? `, next focus: ${weakestWaec.nextFocusName}` : ""}.`,
          href,
          subject: weakestWaec.name,
          masteryPercent: weakestWaec.readiness,
          lastSignalAt: null,
        });
      }
    }

    const { hero } = rankNextBestActions(candidates);

    let certificateProximity: ClassDifferentiationStudent["certificateProximity"] = null;
    if (hero && student.currentGrade != null) {
      const proximity = await getCertificateProximity(
        student.studentId,
        student.userId,
        hero.subject,
        student.currentGrade,
        classRecord.schoolId ?? null
      ).catch(() => null);
      if (proximity && !proximity.alreadyAwarded && proximity.completionPct >= 60) {
        certificateProximity = {
          subject: proximity.subject,
          completionPct: proximity.completionPct,
          remainingLessons: proximity.remainingLessons,
        };
      }
    }

    studentResults.push({
      studentId: student.studentId,
      userId: student.userId,
      name: student.name,
      currentGrade: student.currentGrade,
      hero,
      interventionCount: candidates.length,
      certificateProximity,
    });
  }

  const byType = new Map<string, ClassDifferentiationStudent[]>();
  for (const s of studentResults) {
    const key = s.hero?.type ?? "ON_TRACK";
    const list = byType.get(key) ?? [];
    list.push(s);
    byType.set(key, list);
  }

  const orderedTypes: Array<NextActionCandidate["type"] | "ON_TRACK"> = [
    "CRITICAL_MASTERY",
    "OVERDUE",
    "WAEC_PRACTICE",
    "ON_TRACK",
  ];

  const groups = orderedTypes
    .filter((type) => byType.has(type))
    .map((type) => ({
      type,
      label: GROUP_LABEL[type] ?? type,
      students: (byType.get(type) ?? []).sort((a, b) => (b.hero?.priority ?? 0) - (a.hero?.priority ?? 0)),
    }));

  return {
    classId,
    className: classRecord.name,
    studentCount: students.length,
    generatedAt: new Date().toISOString(),
    groups,
  };
}
