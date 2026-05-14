import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const ROLE_AUDIENCE_MAP: Record<string, string[]> = {
  STUDENT: ["ALL", "STUDENTS"],
  TEACHER: ["ALL", "TEACHERS"],
  GUARDIAN: ["ALL", "GUARDIANS"],
  ADMIN: ["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"],
  DISTRICT_ADMIN: ["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"],
  MOE_OFFICIAL: ["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"],
  MOE_SUPER_ADMIN: ["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"],
  MOE_DISTRICT_ADMIN: ["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"],
};

export async function GET() {
  const requestId = randomUUID();
  try {
    const user = await requireUser();
    if (!user.schoolId) {
      return NextResponse.json({ announcements: [] });
    }

    const allowedAudiences = ROLE_AUDIENCE_MAP[user.role] ?? ["ALL"];
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
      where: {
        schoolId: user.schoolId,
        publishedAt: { not: null, lte: now },
        audience: { in: allowedAudiences },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        isPinned: true,
        publishedAt: true,
        expiresAt: true,
        createdAt: true,
        author: { select: { name: true } },
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 20,
    });

    return NextResponse.json({
      announcements: announcements.map(({ id, title, body, audience, isPinned, publishedAt, expiresAt, createdAt, author }) => ({
        id, title, body, audience, isPinned, publishedAt, expiresAt, createdAt, author,
      })),
    });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/announcements", method: "GET" });
  }
}
