import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchType = "lessons" | "events" | "assignments";

const ALLOWED_ROLES_FOR_ASSIGNMENTS = new Set(["TEACHER", "ADMIN", "MOE_OFFICIAL"]);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const typesParam = searchParams.get("types") ?? "lessons,events";
    const types = typesParam.split(",").map((t) => t.trim() as SearchType);

    if (!q || q.length < 2) {
      return NextResponse.json({ lessons: [], events: [], assignments: [] });
    }

    const schoolId = user.schoolId;
    const results: {
      lessons: Array<{ contentId: string; title: string | null; subject: string; grade: number }>;
      events: Array<{ id: string; title: string; eventDate: string; description: string | null }>;
      assignments: Array<{ id: string; title: string; subject: string; dueAt: string | null }>;
    } = { lessons: [], events: [], assignments: [] };

    const tsQuery = q
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `${word}:*`)
      .join(" & ");

    if (!tsQuery) {
      return NextResponse.json(results);
    }

    // Lessons
    if (types.includes("lessons")) {
      const lessonsRaw = await prisma.$queryRawUnsafe<
        Array<{ contentId: string; title: string | null; subject: string; grade: number }>
      >(
        `SELECT "contentId", "title", "subject", "grade"
         FROM "CurriculumContent"
         WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(subject, '')) @@ to_tsquery('english', $1)
         AND status = 'published'
         LIMIT 10`,
        tsQuery
      );
      results.lessons = lessonsRaw;
    }

    // Events
    if (types.includes("events") && schoolId) {
      const eventsRaw = await prisma.$queryRawUnsafe<
        Array<{ id: string; title: string; eventDate: Date; description: string | null }>
      >(
        `SELECT id, title, "eventDate", description
         FROM "SchoolEvent"
         WHERE "schoolId" = $1
         AND to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')) @@ to_tsquery('english', $2)
         ORDER BY "eventDate" ASC
         LIMIT 10`,
        schoolId,
        tsQuery
      );
      results.events = eventsRaw.map((e) => ({
        id: e.id,
        title: e.title,
        eventDate: e.eventDate instanceof Date ? e.eventDate.toISOString() : String(e.eventDate),
        description: e.description,
      }));
    }

    // Assignments (teachers, admins, moe only)
    if (types.includes("assignments") && ALLOWED_ROLES_FOR_ASSIGNMENTS.has(user.role) && schoolId) {
      const assignmentsRaw = await prisma.$queryRawUnsafe<
        Array<{ id: string; title: string; subject: string; dueAt: Date | null }>
      >(
        `SELECT a.id, a.title, c.subject, a."dueAt"
         FROM "Assignment" a
         JOIN "Class" c ON c.id = a."classId"
         WHERE c."schoolId" = $1
         AND to_tsvector('english', coalesce(a.title, '')) @@ to_tsquery('english', $2)
         ORDER BY a."createdAt" DESC
         LIMIT 10`,
        schoolId,
        tsQuery
      );
      results.assignments = assignmentsRaw.map((a) => ({
        id: a.id,
        title: a.title,
        subject: String(a.subject).replace(/_/g, " "),
        dueAt: a.dueAt instanceof Date ? a.dueAt.toISOString() : a.dueAt ? String(a.dueAt) : null,
      }));
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Search failed" }, { status: error?.status ?? 500 });
  }
}
