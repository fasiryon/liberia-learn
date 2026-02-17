import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

/**
 * GET /api/reports/school?type=enrollment|attendance|grades|curriculum&format=json|csv
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    const schoolId = user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "No school assigned" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "enrollment";
    const format = searchParams.get("format") ?? "json";

    let data: { headers: string[]; rows: string[][] } = { headers: [], rows: [] };

    if (type === "enrollment") {
      const students = await prisma.user.findMany({
        where: { schoolId, role: "STUDENT" },
        select: { id: true, email: true, name: true, createdAt: true, student: { select: { currentGrade: true, county: true } } },
        orderBy: { name: "asc" },
      });
      data.headers = ["Name", "Email", "Grade", "County", "Enrolled"];
      data.rows = students.map((s) => [
        s.name ?? "",
        s.email,
        String(s.student?.currentGrade ?? ""),
        s.student?.county ?? "",
        s.createdAt.toISOString().slice(0, 10),
      ]);
    } else if (type === "attendance") {
      const records = await prisma.attendanceRecord.findMany({
        where: { Meeting: { Class: { schoolId } } },
        select: {
          status: true,
          markedAt: true,
          Student: { select: { user: { select: { name: true, email: true } } } },
          Meeting: { select: { Class: { select: { name: true } }, startsAt: true } },
        },
        orderBy: { markedAt: "desc" },
        take: 500,
      });
      data.headers = ["Student", "Email", "Class", "Date", "Status"];
      data.rows = records.map((r) => [
        r.Student.user.name ?? "",
        r.Student.user.email ?? "",
        r.Meeting.Class.name,
        r.Meeting.startsAt.toISOString().slice(0, 10),
        r.status,
      ]);
    } else if (type === "grades") {
      const grades = await prisma.grade.findMany({
        where: { Class: { schoolId } },
        select: {
          percent: true,
          letter: true,
          computedAt: true,
          Student: { select: { user: { select: { name: true, email: true } } } },
          Class: { select: { name: true, subject: true } },
        },
        orderBy: { computedAt: "desc" },
        take: 500,
      });
      data.headers = ["Student", "Class", "Subject", "Percent", "Letter", "Date"];
      data.rows = grades.map((g) => [
        g.Student.user.name ?? "",
        g.Class.name,
        g.Class.subject,
        String(g.percent),
        g.letter,
        g.computedAt.toISOString().slice(0, 10),
      ]);
    } else if (type === "curriculum") {
      const items = await prisma.curriculumContent.findMany({
        select: { contentId: true, grade: true, subject: true, contentType: true, status: true, version: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      data.headers = ["Content ID", "Grade", "Subject", "Type", "Status", "Version", "Created"];
      data.rows = items.map((i) => [
        i.contentId,
        String(i.grade),
        i.subject,
        i.contentType,
        i.status,
        i.version,
        i.createdAt.toISOString().slice(0, 10),
      ]);
    }

    if (format === "csv") {
      const csv = toCSV(data.headers, data.rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${type}-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ type, rowCount: data.rows.length, headers: data.headers, rows: data.rows });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed" },
      { status: err?.status ?? 500 }
    );
  }
}
