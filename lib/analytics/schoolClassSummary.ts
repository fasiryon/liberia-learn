// lib/analytics/schoolClassSummary.ts — Sprint 7
// School and class summary analytics.
// Internal API only.

import { prisma } from "@/lib/db";

export interface SchoolSummaryRow {
  schoolId: string;
  schoolName: string;
  county: string | null;
  district: string | null;
  teacherCount: number;
  studentCount: number;
  classCount: number;
}

export interface SchoolClassSummaryReport {
  totalSchools: number;
  totalClasses: number;
  totalTeachers: number;
  totalStudents: number;
  schools: SchoolSummaryRow[];
}

export interface SchoolClassSummaryOptions {
  schoolId?: string | null;
}

export async function getSchoolClassSummary(
  options: SchoolClassSummaryOptions = {}
): Promise<SchoolClassSummaryReport> {
  const { schoolId } = options;

  const schools = await prisma.school.findMany({
    where: schoolId ? { id: schoolId } : {},
    select: { id: true, name: true, county: true, district: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    schools.map(async (s) => {
      const [teacherCount, studentCount, classCount] = await Promise.all([
        prisma.user.count({ where: { schoolId: s.id, role: "TEACHER" } }),
        prisma.student.count({ where: { deletedAt: null, user: { schoolId: s.id } } }),
        prisma.class.count({ where: { schoolId: s.id } }),
      ]);

      return {
        schoolId: s.id,
        schoolName: s.name,
        county: s.county,
        district: s.district,
        teacherCount,
        studentCount,
        classCount,
      };
    })
  );

  const totals = rows.reduce(
    (acc, r) => ({
      teachers: acc.teachers + r.teacherCount,
      students: acc.students + r.studentCount,
      classes: acc.classes + r.classCount,
    }),
    { teachers: 0, students: 0, classes: 0 }
  );

  return {
    totalSchools: schools.length,
    totalClasses: totals.classes,
    totalTeachers: totals.teachers,
    totalStudents: totals.students,
    schools: rows,
  };
}
