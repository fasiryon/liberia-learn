import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computePilotScore } from "@/lib/pilot-score";

export const dynamic = "force-dynamic";

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(",");
  const dataLines = rows.map((row) => row.map(escape).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "attendance";
    const format = searchParams.get("format") ?? "json";

    let data: { headers: string[]; rows: string[][] } = { headers: [], rows: [] };

    if (type === "attendance") {
      const records = await prisma.attendanceRecord.findMany({
        select: {
          status: true,
          markedAt: true,
          Student: { select: { user: { select: { name: true } } } },
          Meeting: { select: { Class: { select: { name: true, School: { select: { name: true, county: true } } } } } },
        },
        orderBy: { markedAt: "desc" },
        take: 2000,
      });
      data.headers = ["School", "County", "Class", "Student", "Status", "Date"];
      data.rows = records.map((r) => [
        r.Meeting.Class.School.name,
        r.Meeting.Class.School.county ?? "",
        r.Meeting.Class.name,
        r.Student.user.name ?? "",
        r.status,
        r.markedAt.toISOString().slice(0, 10),
      ]);
    } else if (type === "performance") {
      const grades = await prisma.grade.findMany({
        select: {
          percent: true,
          letter: true,
          computedAt: true,
          Student: { select: { user: { select: { name: true } } } },
          Class: { select: { name: true, subject: true, School: { select: { name: true, county: true } } } },
        },
        orderBy: { computedAt: "desc" },
        take: 2000,
      });
      data.headers = ["School", "County", "Class", "Subject", "Student", "Percent", "Letter", "Date"];
      data.rows = grades.map((g) => [
        g.Class.School.name,
        g.Class.School.county ?? "",
        g.Class.name,
        g.Class.subject,
        g.Student.user.name ?? "",
        String(g.percent),
        g.letter,
        g.computedAt.toISOString().slice(0, 10),
      ]);
    } else if (type === "curriculum") {
      const items = await prisma.curriculumContent.findMany({
        select: { contentId: true, grade: true, subject: true, contentType: true, status: true, version: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      data.headers = ["Content ID", "Grade", "Subject", "Type", "Status", "Version", "Created"];
      data.rows = items.map((i) => [
        i.contentId, String(i.grade), i.subject, i.contentType, i.status, i.version, i.createdAt.toISOString().slice(0, 10),
      ]);
    } else if (type === "readiness") {
      const schools = await prisma.school.findMany({
        select: { id: true, name: true, county: true },
      });
      const scores = await Promise.all(
        schools.map(async (s) => {
          const result = await computePilotScore(s.id);
          return { ...s, ...result };
        })
      );
      data.headers = ["School", "County", "Total", "Grade", "Attendance", "Curriculum", "Engagement", "Guardians", "Setup"];
      data.rows = scores.map((s) => [
        s.name, s.county ?? "", String(s.total), s.grade,
        ...s.components.map((c) => String(c.score)),
      ]);

      if (format === "json") {
        return NextResponse.json({ type, schools: scores });
      }
    }

    if (format === "csv") {
      const csv = toCSV(data.headers, data.rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="platform-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
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

