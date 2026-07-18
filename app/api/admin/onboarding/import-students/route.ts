import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

type StudentRow = {
  firstName: string;
  lastName: string;
  grade: string;
  guardianEmail: string;
  guardianPhone: string;
};

function parseCSV(text: string): StudentRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const firstNameIdx = header.findIndex((h) => h === "firstname" || h === "first_name");
  const lastNameIdx = header.findIndex((h) => h === "lastname" || h === "last_name");
  const gradeIdx = header.indexOf("grade");
  const guardianEmailIdx = header.findIndex((h) => h === "guardianemail" || h === "guardian_email");
  const guardianPhoneIdx = header.findIndex((h) => h === "guardianphone" || h === "guardian_phone");

  if (firstNameIdx === -1 || lastNameIdx === -1) {
    throw new Error("CSV must have 'firstName' and 'lastName' columns");
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      firstName: cols[firstNameIdx] ?? "",
      lastName: cols[lastNameIdx] ?? "",
      grade: cols[gradeIdx] ?? "",
      guardianEmail: cols[guardianEmailIdx] ?? "",
      guardianPhone: cols[guardianPhoneIdx] ?? "",
    };
  }).filter((r) => r.firstName && r.lastName);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const body = await req.json();

    // Preview mode: parse without creating
    if (body.preview) {
      let rows: StudentRow[];
      try {
        rows = parseCSV(body.csv ?? "");
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      return NextResponse.json({ rows: rows.slice(0, 5), total: rows.length });
    }

    const { csv } = body as { csv: string };
    if (!csv) return NextResponse.json({ error: "csv field required" }, { status: 400 });

    let rows: StudentRow[];
    try {
      rows = parseCSV(csv);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 });
    }

    const created: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.firstName || !row.lastName) { errors.push("Row missing name"); continue; }

      try {
        const fullName = `${row.firstName} ${row.lastName}`;
        const grade = parseInt(row.grade, 10) || null;
        const loginId = `STU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
        const tempPin = "Student@2026!";
        const hashedPwd = await bcrypt.hash(tempPin, 12);
        const email = `${loginId.toLowerCase()}@no-email.liberialearn.internal`;

        const studentUser = await prisma.user.create({
          data: {
            name: fullName,
            email,
            loginId,
            hashedPwd,
            role: "STUDENT",
            schoolId: user.schoolId,
            mustChangePIN: true,
            student: {
              create: {
                currentGrade: grade,
              },
            },
          },
        });

        // Create guardian if email/phone provided
        if (row.guardianEmail || row.guardianPhone) {
          const guardianEmail = row.guardianEmail || `guardian-${loginId.toLowerCase()}@no-email.liberialearn.internal`;
          const guardianLoginId = `GRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
          const guardianHashed = await bcrypt.hash("Student@2026!", 12);

          const existingGuardian = row.guardianEmail
            ? await prisma.user.findFirst({ where: { email: row.guardianEmail } })
            : null;

          const guardianUser = existingGuardian ?? await prisma.user.create({
            data: {
              name: `Guardian of ${fullName}`,
              email: guardianEmail,
              loginId: guardianLoginId,
              hashedPwd: guardianHashed,
              role: "GUARDIAN",
              schoolId: user.schoolId,
              guardianPhone: row.guardianPhone || null,
            },
          });

          const studentRecord = await prisma.student.findUnique({ where: { userId: studentUser.id } });
          if (studentRecord) {
            await prisma.studentGuardian.create({
              data: {
                studentId: studentRecord.id,
                guardianId: guardianUser.id,
                relation: "guardian",
              },
            }).catch(() => {});
          }
        }

        created.push(fullName);
      } catch {
        errors.push(`Failed to create: ${row.firstName} ${row.lastName}`);
      }
    }

    void logAudit({
      userId: user.id,
      action: "onboarding.students_imported",
      resourceType: "school",
      resourceId: user.schoolId,
      details: { created: created.length, skipped: skipped.length, errors: errors.length } as any,
    });

    return NextResponse.json({ created: created.length, skipped: skipped.length, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
