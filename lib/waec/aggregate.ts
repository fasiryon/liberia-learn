/**
 * lib/waec/aggregate.ts — PHASE 5A Surface (D3)
 *
 * Read-only aggregation of per-student WAEC readiness for teacher (class) and MOE
 * (national/county) panels. Loads all relevant mastery profiles in a single query, then
 * computes each student's per-subject readiness in memory via computeSubjectReadiness.
 * No new tracking — pure aggregation of existing mastery data.
 */
import type { Subject } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeSubjectReadiness, type StrandScore } from "@/lib/waec/readiness";
import { getWaecSubjects, type WaecSubjectId } from "@/lib/waec/syllabus";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";

const ENUM_BUCKETS: Subject[] = ["MATH", "SCIENCE", "LITERACY"];
const AT_RISK = 50;
const ON_TRACK = 75;

export type SubjectAggregate = {
  subjectId: WaecSubjectId;
  name: string;
  assessedStudents: number;
  avgReadiness: number | null;
  atRisk: number; // readiness < 50
  onTrack: number; // readiness > 75
};

async function loadStrandScores(studentIds: string[]): Promise<Map<string, Record<string, StrandScore>>> {
  const out = new Map<string, Record<string, StrandScore>>();
  if (studentIds.length === 0) return out;
  const profiles = await prisma.studentMasteryProfile.findMany({
    where: { studentId: { in: studentIds }, subject: { in: ENUM_BUCKETS }, lastAssessedAt: { not: null } },
    select: { studentId: true, strandKey: true, currentScore: true, baselineScore: true },
  });
  for (const p of profiles) {
    const m = out.get(p.studentId) ?? {};
    m[p.strandKey] = { current: p.currentScore, baseline: p.baselineScore };
    out.set(p.studentId, m);
  }
  return out;
}

/** Aggregate WAEC readiness across a set of students, per subject. */
export async function aggregateWaecForStudents(studentIds: string[]): Promise<SubjectAggregate[]> {
  const scores = await loadStrandScores(studentIds);
  return getWaecSubjects()
    .filter((s) => s.masterySubject !== null)
    .map((s) => {
      let sum = 0, assessed = 0, atRisk = 0, onTrack = 0;
      for (const sid of studentIds) {
        const map = scores.get(sid);
        if (!map) continue;
        const r = computeSubjectReadiness(s.id, map);
        if (r.readiness == null) continue;
        assessed++; sum += r.readiness;
        if (r.readiness < AT_RISK) atRisk++;
        if (r.readiness > ON_TRACK) onTrack++;
      }
      return {
        subjectId: s.id, name: s.name, assessedStudents: assessed,
        avgReadiness: assessed > 0 ? Math.round(sum / assessed) : null, atRisk, onTrack,
      };
    });
}

/** Grade 9+ student ids taught by a teacher (via their classes' enrollments). */
export async function getTeacherWaecReadiness(teacherUserId: string): Promise<{ studentCount: number; subjects: SubjectAggregate[] }> {
  const classes = await prisma.class.findMany({
    where: { teacherId: teacherUserId },
    select: { enrollments: { select: { Student: { select: { id: true, currentGrade: true } } } } },
  });
  const ids = new Set<string>();
  for (const c of classes) {
    for (const e of c.enrollments) {
      if ((e.Student?.currentGrade ?? 0) >= WAEC_MIN_GRADE && e.Student) ids.add(e.Student.id);
    }
  }
  const studentIds = Array.from(ids);
  return { studentCount: studentIds.length, subjects: await aggregateWaecForStudents(studentIds) };
}

export type CountyAggregate = { county: string; assessedStudents: number; avgReadiness: number | null };

/** National WAEC readiness + per-county ranking. */
export async function getNationalWaecReadiness(): Promise<{
  studentCount: number;
  subjects: SubjectAggregate[];
  byCounty: CountyAggregate[];
}> {
  const students = await prisma.student.findMany({
    where: { currentGrade: { gte: WAEC_MIN_GRADE } },
    select: { id: true, county: true, enrollments: { select: { Class: { select: { School: { select: { county: true } } } } }, take: 1 } },
  });
  const studentIds = students.map((s) => s.id);
  const subjects = await aggregateWaecForStudents(studentIds);

  // County = student.county, falling back to their school's county.
  const scores = await loadStrandScores(studentIds);
  const countyMap = new Map<string, { sum: number; n: number }>();
  const waecSubjects = getWaecSubjects().filter((s) => s.masterySubject !== null);
  for (const s of students) {
    const county = s.county || s.enrollments[0]?.Class?.School?.county || "Unknown";
    const map = scores.get(s.id);
    if (!map) continue;
    // Student's overall readiness = mean of their assessed subject readinesses.
    let sum = 0, n = 0;
    for (const subj of waecSubjects) {
      const r = computeSubjectReadiness(subj.id, map);
      if (r.readiness != null) { sum += r.readiness; n++; }
    }
    if (n === 0) continue;
    const overall = sum / n;
    const c = countyMap.get(county) ?? { sum: 0, n: 0 };
    c.sum += overall; c.n++; countyMap.set(county, c);
  }
  const byCounty = Array.from(countyMap.entries())
    .map(([county, v]) => ({ county, assessedStudents: v.n, avgReadiness: v.n > 0 ? Math.round(v.sum / v.n) : null }))
    .sort((a, b) => (b.avgReadiness ?? -1) - (a.avgReadiness ?? -1));

  return { studentCount: studentIds.length, subjects, byCounty };
}
