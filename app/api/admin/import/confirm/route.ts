import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { type GradeBand, type Subject } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  validateStudentRows,
  validateTeacherRows,
  validateGuardianRows,
  buildErrorCsv,
  type ImportRow,
} from "@/lib/imports/schoolImportValidator";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";
import { createStudentImportBatch } from "@/lib/school-operations";
import { generatePin } from "@/lib/credentials";
import {
  normalizeCredentialPhone,
  normalizeLoginId,
  slugifyLoginSeed,
} from "@/lib/login-identifiers";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  importType: z.enum(["students", "teachers", "guardians"]),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(500),
  schoolId: z.string().trim().min(1).optional(),
});

function gradeToGradeBand(grade: number): GradeBand | null {
  if (grade >= 1 && grade <= 3) return "G1_3";
  if (grade >= 4 && grade <= 6) return "G4_6";
  if (grade >= 7 && grade <= 9) return "G7_9";
  if (grade >= 10 && grade <= 12) return "G10_12";
  return null;
}

async function buildUniqueLoginId(seed: string) {
  const base = normalizeLoginId(seed);
  let candidate = base;
  for (let attempt = 1; attempt <= 10; attempt++) {
    const existing = await prisma.user.findFirst({ where: { loginId: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${base}-${attempt}`;
  }
  return `${base}-${Date.now().toString().slice(-4)}`;
}

async function importTeachers(
  rows: ImportRow[],
  schoolId: string,
  actorUserId: string
): Promise<{ imported: number; errors: Array<{ row: ImportRow; reason: string }> }> {
  let imported = 0;
  const errors: Array<{ row: ImportRow; reason: string }> = [];

  for (const row of rows) {
    try {
      const fullName = `${row.firstName.trim()} ${row.lastName.trim()}`;
      const email = row.email.trim().toLowerCase();
      const loginId = await buildUniqueLoginId(
        `TCH-${new Date().getFullYear()}-${slugifyLoginSeed(fullName) || Date.now().toString().slice(-4)}`
      );
      const tempPin = generatePin();
      const hashedPwd = await bcrypt.hash(tempPin, 10);

      await prisma.user.create({
        data: {
          email,
          loginId,
          name: fullName,
          role: "TEACHER",
          hashedPwd,
          mustChangePIN: true,
          schoolId,
          TeacherProfile: {
            create: {
              id: randomUUID(),
              schoolId,
              fullName,
              permissions: { active: true, subjectSpecialty: row.subject?.trim() || null },
              gradesTaught: row.classGrade
                ? ([gradeToGradeBand(Number(row.classGrade))].filter(Boolean) as GradeBand[])
                : [],
              subjectsTaught: row.subject
                ? [row.subject.trim().toUpperCase() as Subject]
                : [],
              isOnboarded: false,
              updatedAt: new Date(),
            },
          },
        },
        select: { id: true },
      });

      await logAudit({
        userId: actorUserId,
        schoolId,
        action: "admin.teacher.imported",
        resourceType: "user",
        resourceId: email,
        details: { fullName, subject: row.subject },
      });

      imported++;
    } catch (err: any) {
      errors.push({ row, reason: err?.message ?? "Failed to create teacher" });
    }
  }

  return { imported, errors };
}

async function importGuardians(
  rows: ImportRow[],
  schoolId: string,
  actorUserId: string
): Promise<{ imported: number; errors: Array<{ row: ImportRow; reason: string }>; warnings: string[] }> {
  let imported = 0;
  const errors: Array<{ row: ImportRow; reason: string }> = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const fullName = `${row.firstName.trim()} ${row.lastName.trim()}`;
      const email = row.email.trim().toLowerCase();
      const phone = row.phone?.trim() || null;
      const phoneE164 = phone ? normalizeCredentialPhone(phone) : null;
      const loginId = await buildUniqueLoginId(`guardian-${slugifyLoginSeed(fullName)}`);
      const tempPin = generatePin();
      const hashedPwd = await bcrypt.hash(tempPin, 10);

      const guardian = await prisma.user.create({
        data: {
          email,
          loginId,
          name: fullName,
          role: "GUARDIAN",
          hashedPwd,
          mustChangePIN: true,
          schoolId,
          guardianPhone: phone,
          guardianPhoneE164: phoneE164,
          preferredChannel: phoneE164 ? "SMS" : "EMAIL",
        },
        select: { id: true },
      });

      // Link to student if found
      const studentName = `${row.studentFirstName?.trim()} ${row.studentLastName?.trim()}`;
      const matchingStudent = await prisma.student.findFirst({
        where: { user: { schoolId, name: { equals: studentName, mode: "insensitive" } } },
        select: { id: true },
      });

      if (matchingStudent) {
        await prisma.studentGuardian.upsert({
          where: { studentId_guardianId: { studentId: matchingStudent.id, guardianId: guardian.id } },
          update: {},
          create: {
            studentId: matchingStudent.id,
            guardianId: guardian.id,
            relation: row.relationship?.trim() || "GUARDIAN",
          },
        });
      } else {
        warnings.push(
          `Guardian '${fullName}': no student named '${studentName}' found — imported without student link.`
        );
      }

      await logAudit({
        userId: actorUserId,
        schoolId,
        action: "admin.guardian.imported",
        resourceType: "user",
        resourceId: guardian.id,
        details: { fullName, linkedStudent: matchingStudent?.id ?? null },
      });

      imported++;
    } catch (err: any) {
      errors.push({ row, reason: err?.message ?? "Failed to create guardian" });
    }
  }

  return { imported, errors, warnings };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const body = bodySchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, body.schoolId);

    // Re-validate to ensure only clean rows are written
    let validationResult;
    if (body.importType === "students") {
      validationResult = await validateStudentRows(body.rows, schoolId);
    } else if (body.importType === "teachers") {
      validationResult = await validateTeacherRows(body.rows, schoolId);
    } else {
      validationResult = await validateGuardianRows(body.rows, schoolId);
    }

    const { valid, invalid } = validationResult;
    const skipped = invalid.length;
    const originalHeaders = body.rows.length > 0 ? Object.keys(body.rows[0]) : [];
    const failedRowsCsv = invalid.length > 0 ? buildErrorCsv(originalHeaders, invalid) : null;

    let imported = 0;
    const writeErrors: Array<{ row: ImportRow; reason: string }> = [];

    if (body.importType === "students" && valid.length > 0) {
      const importRows = valid.map((row, i) => ({
        rowNumber: i + 2,
        firstName: row.firstName,
        lastName: row.lastName,
        grade: Number(row.grade),
        dateOfBirth: row.dateOfBirth,
        guardianPhone: row.guardianPhone || null,
      }));

      const batchResult = await createStudentImportBatch({
        actorUserId: user.id,
        schoolId,
        fileName: "bulk-import.csv",
        rows: importRows,
      });

      // batchResult.batchId reflects what was actually processed
      imported = valid.length;

      await logAudit({
        userId: user.id,
        schoolId,
        action: "admin.bulk_import.students",
        resourceType: "student_import_batch",
        resourceId: batchResult.batchId,
        details: { imported, skipped, importType: "students" },
      });
    } else if (body.importType === "teachers" && valid.length > 0) {
      const result = await importTeachers(valid, schoolId, user.id);
      imported = result.imported;
      writeErrors.push(...result.errors);

      await logAudit({
        userId: user.id,
        schoolId,
        action: "admin.bulk_import.teachers",
        resourceType: "user",
        resourceId: schoolId,
        details: { imported, skipped, importType: "teachers" },
      });
    } else if (body.importType === "guardians" && valid.length > 0) {
      const result = await importGuardians(valid, schoolId, user.id);
      imported = result.imported;
      writeErrors.push(...result.errors);

      await logAudit({
        userId: user.id,
        schoolId,
        action: "admin.bulk_import.guardians",
        resourceType: "user",
        resourceId: schoolId,
        details: { imported, skipped, importType: "guardians" },
      });
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: writeErrors.map((e) => ({ row: e.row, reason: e.reason })),
      failedRowsCsv,
      summary: validationResult.summary,
    });
  } catch (err: any) {
    return handleApiError(err, { requestId: "", route: "/api/admin/import/confirm", method: "POST" });
  }
}
