import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { generatePin } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { parseCsv } from "@/lib/import/csv";
import {
  normalizeCredentialPhone,
  normalizeLoginId,
  slugifyLoginSeed,
} from "@/lib/login-identifiers";
import {
  checkRateLimit,
  RATE_LIMIT_POLICIES,
  rateLimitExceededResponse,
} from "@/lib/rateLimit";
import { generateStudentId } from "@/lib/studentId";

const SubjectEnum = z.enum([
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
]);

const BodySchema = z.object({
  entity: z.enum(["students", "teachers", "classes", "enrollments"]),
  csv: z.string().min(1),
});

type RowError = {
  row: number;
  field: string;
  error: string;
};

function normalizeSubject(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  const legacyMap: Record<string, z.infer<typeof SubjectEnum>> = {
    ENGLISH: "LITERACY",
    ICT: "COMPUTER_SCIENCE",
  };
  return legacyMap[normalized] ?? normalized;
}

async function buildUniqueTeacherLoginId(preferred: string | undefined, fallbackSeed: string) {
  const base = normalizeLoginId(preferred && preferred.trim() ? preferred : fallbackSeed);
  let candidate = base;
  let attempt = 1;

  while (attempt <= 10) {
    const existing = await prisma.user.findFirst({
      where: { loginId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now().toString().slice(-4)}`;
}

async function buildUniqueEmail(baseSeed: string, email?: string, domain = "local") {
  const baseEmailLocal = slugifyLoginSeed(baseSeed) || `${domain}-${Date.now()}`;
  let candidate = (email ?? `${baseEmailLocal}@${domain}.local`).toLowerCase();
  let attempt = 0;

  while (attempt < 5) {
    const existing = await prisma.user.findUnique({ where: { email: candidate } });
    if (!existing) break;
    attempt += 1;
    candidate = `${baseEmailLocal}-${attempt}@${domain}.local`;
  }

  return candidate;
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const admin = await requireRole("ADMIN");
    if (!admin.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const rateLimit = await checkRateLimit(`admin-import:${admin.id}`, {
      windowMs: RATE_LIMIT_POLICIES.INVITES.windowMs,
      limit: Math.max(5, Math.floor(RATE_LIMIT_POLICIES.INVITES.limit / 2)),
      namespace: "admin-import",
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const body = BodySchema.parse(await req.json());
    const rows = parseCsv(body.csv);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
    }

    const rowErrors: RowError[] = [];

    if (body.entity === "classes") {
      const teacherLoginIds = rows.map((row) => row.teacherLoginId).filter(Boolean);
      const teachers = teacherLoginIds.length
        ? await prisma.user.findMany({
            where: {
              schoolId: admin.schoolId,
              role: "TEACHER",
              loginId: { in: teacherLoginIds },
            },
            select: { id: true, loginId: true },
          })
        : [];
      const teacherByLoginId = new Map(teachers.map((teacher) => [teacher.loginId ?? "", teacher]));

      const prepared = rows.map((row, index) => {
        const subjectValue = normalizeSubject(row.subject ?? "");
        const subject = SubjectEnum.safeParse(subjectValue);
        if (!row.name) rowErrors.push({ row: index + 2, field: "name", error: "Class name is required" });
        if (!subject.success) rowErrors.push({ row: index + 2, field: "subject", error: "Invalid subject" });
        if (row.teacherLoginId && !teacherByLoginId.has(row.teacherLoginId)) {
          rowErrors.push({ row: index + 2, field: "teacherLoginId", error: "Teacher not found in this school" });
        }
        return {
          name: row.name,
          subject: subject.success ? subject.data : null,
          teacherId: row.teacherLoginId ? teacherByLoginId.get(row.teacherLoginId)?.id ?? null : null,
        };
      });

      if (rowErrors.length > 0) {
        return NextResponse.json({ error: "Validation failed", rowErrors }, { status: 400 });
      }

      const created = await prisma.$transaction(
        prepared.map((entry) =>
          prisma.class.create({
            data: {
              schoolId: admin.schoolId!,
              name: entry.name,
              subject: entry.subject!,
              teacherId: entry.teacherId,
            },
            select: { id: true },
          })
        )
      );

      await logAudit({
        userId: admin.id,
        schoolId: admin.schoolId,
        traceId: requestId,
        action: "admin.import.classes",
        resourceType: "class_import",
        details: { rowCount: rows.length },
      });

      return NextResponse.json({ ok: true, entity: body.entity, importedCount: created.length });
    }

    if (body.entity === "teachers") {
      const prepared = [];
      for (const [index, row] of rows.entries()) {
        if (!row.fullName) rowErrors.push({ row: index + 2, field: "fullName", error: "Full name is required" });
        const loginId = await buildUniqueTeacherLoginId(
          row.loginId || undefined,
          `TCH-${new Date().getFullYear()}-${slugifyLoginSeed(row.fullName || "teacher")}`
        );
        const email = await buildUniqueEmail(loginId, row.email || undefined, "teacher");
        prepared.push({
          fullName: row.fullName,
          loginId,
          email,
          phone: row.phone ? normalizeCredentialPhone(row.phone) : null,
          subjectSpecialty: row.subjectSpecialty?.trim() || null,
        });
      }

      if (rowErrors.length > 0) {
        return NextResponse.json({ error: "Validation failed", rowErrors }, { status: 400 });
      }

      const created = [];
      for (const teacher of prepared) {
        const tempPin = generatePin();
        const hashedPwd = await bcrypt.hash(tempPin, 10);
        const user = await prisma.user.create({
          data: {
            email: teacher.email,
            loginId: teacher.loginId,
            name: teacher.fullName.trim(),
            role: "TEACHER",
            hashedPwd,
            schoolId: admin.schoolId,
            mustChangePIN: true,
            guardianCountryCode: "+231",
            guardianPhone: teacher.phone,
            guardianPhoneE164: teacher.phone,
            preferredChannel: teacher.phone ? "SMS" : "EMAIL",
            TeacherProfile: {
              create: {
                id: randomUUID(),
                schoolId: admin.schoolId,
                fullName: teacher.fullName.trim(),
                phone: teacher.phone,
                permissions: {
                  active: true,
                  subjectSpecialty: teacher.subjectSpecialty,
                },
                gradesTaught: [],
                subjectsTaught: [],
                isOnboarded: false,
                updatedAt: new Date(),
              },
            },
          },
          select: { id: true },
        });
        created.push(user);
      }

      await logAudit({
        userId: admin.id,
        schoolId: admin.schoolId,
        traceId: requestId,
        action: "admin.import.teachers",
        resourceType: "teacher_import",
        details: { rowCount: rows.length },
      });

      return NextResponse.json({ ok: true, entity: body.entity, importedCount: created.length });
    }

    if (body.entity === "students") {
      const classNames = rows.map((row) => row.className).filter(Boolean);
      const classes = classNames.length
        ? await prisma.class.findMany({
            where: { schoolId: admin.schoolId, name: { in: classNames } },
            select: { id: true, name: true },
          })
        : [];
      const school = await prisma.school.findUnique({
        where: { id: admin.schoolId },
        select: { code: true },
      });
      if (!school?.code) {
        return NextResponse.json({ error: "School code is required before importing students" }, { status: 400 });
      }
      const classByName = new Map(classes.map((item) => [item.name, item]));
      let existingStudentCount = await prisma.user.count({ where: { schoolId: admin.schoolId, role: "STUDENT" } });

      const prepared = [];
      for (const [index, row] of rows.entries()) {
        const grade = Number(row.grade);
        if (!row.firstName) rowErrors.push({ row: index + 2, field: "firstName", error: "First name is required" });
        if (!row.lastName) rowErrors.push({ row: index + 2, field: "lastName", error: "Last name is required" });
        if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
          rowErrors.push({ row: index + 2, field: "grade", error: "Grade must be between 1 and 12" });
        }
        if (!row.className || !classByName.has(row.className)) {
          rowErrors.push({ row: index + 2, field: "className", error: "Class not found in this school" });
        }

        existingStudentCount += 1;
        const loginId = generateStudentId({
          schoolCode: school.code,
          year: new Date().getFullYear(),
          sequence: existingStudentCount,
        });
        const email = await buildUniqueEmail(loginId, row.email || undefined, "student");

        prepared.push({
          fullName: `${row.firstName} ${row.lastName}`.trim(),
          grade,
          classId: classByName.get(row.className ?? "")?.id ?? null,
          email,
          loginId,
          phone: row.phone ? normalizeCredentialPhone(row.phone) : null,
        });
      }

      if (rowErrors.length > 0) {
        return NextResponse.json({ error: "Validation failed", rowErrors }, { status: 400 });
      }

      const created = [];
      for (const student of prepared) {
        const tempPin = generatePin();
        const hashedPwd = await bcrypt.hash(tempPin, 10);
        const result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: student.email,
              loginId: student.loginId,
              name: student.fullName,
              role: "STUDENT",
              hashedPwd,
              schoolId: admin.schoolId,
              mustChangePIN: true,
              guardianCountryCode: "+231",
              guardianPhone: student.phone,
              guardianPhoneE164: student.phone,
              preferredChannel: student.phone ? "SMS" : "EMAIL",
            },
            select: { id: true },
          });
          const studentRow = await tx.student.create({
            data: { userId: user.id, currentGrade: student.grade },
            select: { id: true },
          });
          await tx.enrollment.create({
            data: {
              studentId: studentRow.id,
              classId: student.classId!,
            },
          });
          return studentRow;
        });
        created.push(result);
      }

      await logAudit({
        userId: admin.id,
        schoolId: admin.schoolId,
        traceId: requestId,
        action: "admin.import.students",
        resourceType: "student_import",
        details: { rowCount: rows.length },
      });

      return NextResponse.json({ ok: true, entity: body.entity, importedCount: created.length });
    }

    const studentLoginIds = rows.map((row) => normalizeLoginId(row.studentLoginId ?? "")).filter(Boolean);
    const classNames = rows.map((row) => row.className).filter(Boolean);
    const academicYearLabels = rows.map((row) => row.academicYearLabel).filter(Boolean);

    const [students, classes, academicYears] = await Promise.all([
      studentLoginIds.length
        ? prisma.user.findMany({
            where: { schoolId: admin.schoolId, role: "STUDENT", loginId: { in: studentLoginIds } },
            select: { id: true, loginId: true, student: { select: { id: true } } },
          })
        : Promise.resolve([]),
      classNames.length
        ? prisma.class.findMany({
            where: { schoolId: admin.schoolId, name: { in: classNames } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      academicYearLabels.length
        ? prisma.academicYear.findMany({
            where: { schoolId: admin.schoolId, yearLabel: { in: academicYearLabels } },
            select: { id: true, yearLabel: true },
          })
        : Promise.resolve([]),
    ]);

    const studentByLogin = new Map(
      students
        .filter((student) => student.loginId && student.student?.id)
        .map((student) => [student.loginId!, student.student!.id])
    );
    const classByName = new Map(classes.map((item) => [item.name, item.id]));
    const yearByLabel = new Map(academicYears.map((item) => [item.yearLabel, item.id]));

    const operations = rows.map((row, index) => {
      const studentId = studentByLogin.get(normalizeLoginId(row.studentLoginId ?? ""));
      const classId = classByName.get(row.className ?? "");
      const academicYearId = row.academicYearLabel ? yearByLabel.get(row.academicYearLabel) : null;
      const grade = row.grade ? Number(row.grade) : null;

      if (!studentId) rowErrors.push({ row: index + 2, field: "studentLoginId", error: "Student not found in this school" });
      if (!classId) rowErrors.push({ row: index + 2, field: "className", error: "Class not found in this school" });
      if (row.academicYearLabel && !academicYearId) {
        rowErrors.push({ row: index + 2, field: "academicYearLabel", error: "Academic year not found in this school" });
      }
      if (row.grade && (!Number.isInteger(grade) || grade! < 1 || grade! > 12)) {
        rowErrors.push({ row: index + 2, field: "grade", error: "Grade must be between 1 and 12" });
      }

      return { studentId, classId, academicYearId, grade };
    });

    if (rowErrors.length > 0) {
      return NextResponse.json({ error: "Validation failed", rowErrors }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const operation of operations) {
        await tx.enrollment.upsert({
          where: {
            studentId_classId: {
              studentId: operation.studentId!,
              classId: operation.classId!,
            },
          },
          update: {},
          create: {
            studentId: operation.studentId!,
            classId: operation.classId!,
          },
        });

        if (operation.academicYearId && operation.grade) {
          await tx.academicEnrollment.upsert({
            where: {
              studentId_schoolId_academicYearId: {
                studentId: operation.studentId!,
                schoolId: admin.schoolId!,
                academicYearId: operation.academicYearId,
              },
            },
            update: {
              grade: operation.grade,
            },
            create: {
              studentId: operation.studentId!,
              schoolId: admin.schoolId!,
              academicYearId: operation.academicYearId,
              grade: operation.grade,
            },
          });
        }
      }
    });

    await logAudit({
      userId: admin.id,
      schoolId: admin.schoolId,
      traceId: requestId,
      action: "admin.import.enrollments",
      resourceType: "enrollment_import",
      details: { rowCount: rows.length },
    });

    return NextResponse.json({ ok: true, entity: body.entity, importedCount: rows.length });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/import", method: "POST" });
  }
}
