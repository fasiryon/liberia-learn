import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { put, list, del } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date().toISOString().split("T")[0];

  const [students, grades, attendance] = await Promise.all([
    prisma.student.findMany({
      select: {
        id: true,
        currentGrade: true,
        createdAt: true,
        user: { select: { name: true, schoolId: true } },
      },
    }),
    prisma.grade.findMany({
      select: {
        id: true,
        studentId: true,
        classId: true,
        percent: true,
        letter: true,
        computedAt: true,
      },
      take: 50000,
      orderBy: { computedAt: "desc" },
    }),
    prisma.attendance.findMany({
      select: {
        id: true,
        studentId: true,
        date: true,
        status: true,
        classId: true,
      },
      take: 50000,
      orderBy: { date: "desc" },
    }),
  ]);

  const studentsCsv = toCSV(
    ["id", "name", "grade", "schoolId", "createdAt"],
    students.map((s) => [s.id, s.user?.name ?? "", s.currentGrade ?? "", s.user?.schoolId ?? "", s.createdAt.toISOString()])
  );

  const gradesCsv = toCSV(
    ["id", "studentId", "classId", "percent", "letter", "computedAt"],
    grades.map((g) => [g.id, g.studentId ?? "", g.classId ?? "", g.percent ?? "", g.letter ?? "", g.computedAt.toISOString()])
  );

  const attendanceCsv = toCSV(
    ["id", "studentId", "classId", "date", "status"],
    attendance.map((a) => [a.id, a.studentId ?? "", a.classId ?? "", a.date?.toISOString() ?? "", a.status ?? ""])
  );

  const uploads = await Promise.allSettled([
    put(`backups/${date}/students.csv`, studentsCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/grades.csv`, gradesCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/attendance.csv`, attendanceCsv, { access: "private", contentType: "text/csv" }),
  ]);

  // Prune blobs older than 90 days
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { blobs } = await list({ prefix: "backups/" });
    const old = blobs.filter((b) => new Date(b.uploadedAt) < cutoff);
    if (old.length > 0) {
      await del(old.map((b) => b.url));
    }
  } catch {
    // Prune failure is non-fatal
  }

  const backed_up = uploads
    .map((r, i) => (r.status === "fulfilled" ? ["students", "grades", "attendance"][i] : null))
    .filter(Boolean);

  return NextResponse.json({ backed_up, date });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
