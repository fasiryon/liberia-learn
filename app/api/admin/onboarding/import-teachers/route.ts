import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

type TeacherRow = {
  name: string;
  email: string;
  subject: string;
  grades: string;
};

function parseCSV(text: string): TeacherRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const subjectIdx = header.indexOf("subject");
  const gradesIdx = header.indexOf("grades");
  if (nameIdx === -1) throw new Error("CSV must have a 'name' column");

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      name: cols[nameIdx] ?? "",
      email: cols[emailIdx] ?? "",
      subject: cols[subjectIdx] ?? "",
      grades: cols[gradesIdx] ?? "",
    };
  }).filter((r) => r.name);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 400 });

    const body = await req.json();
    const { csv } = body as { csv: string };
    if (!csv) return NextResponse.json({ error: "csv field required" }, { status: 400 });

    let rows: TeacherRow[];
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
      if (!row.name) { errors.push("Row missing name"); continue; }

      try {
        const existing = row.email
          ? await prisma.user.findFirst({ where: { email: row.email, schoolId: user.schoolId } })
          : null;
        if (existing) { skipped.push(row.name); continue; }

        const loginId = `TCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
        const tempPin = "School@2026!";
        const hashedPwd = await bcrypt.hash(tempPin, 12);
        const email = row.email || `${loginId.toLowerCase()}@no-email.liberialearn.internal`;

        await prisma.user.create({
          data: {
            name: row.name,
            email,
            loginId,
            hashedPwd,
            role: "TEACHER",
            schoolId: user.schoolId,
            mustChangePIN: true,
          },
        });
        created.push(row.name);
      } catch {
        errors.push(`Failed to create: ${row.name}`);
      }
    }

    void logAudit({
      userId: user.id,
      action: "onboarding.teachers_imported",
      resourceType: "school",
      resourceId: user.schoolId,
      details: { created: created.length, skipped: skipped.length, errors: errors.length } as any,
    });

    return NextResponse.json({ created: created.length, skipped: skipped.length, errors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
