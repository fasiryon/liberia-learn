import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { sendPushToSchool } from "@/lib/push/sendPush";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  audience: z.enum(["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"]).default("ALL"),
  isPinned: z.boolean().default(false),
  publishedAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

    const filter = req.nextUrl.searchParams.get("filter") ?? "published";

    const announcements = await prisma.announcement.findMany({
      where: {
        schoolId: user.schoolId,
        publishedAt: filter === "published" ? { not: null } : null,
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
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/announcements", method: "GET" });
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

    const body = CreateSchema.parse(await req.json());

    const announcement = await prisma.announcement.create({
      data: {
        schoolId: user.schoolId,
        title: body.title,
        body: body.body,
        audience: body.audience,
        isPinned: body.isPinned,
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdBy: user.id,
      },
    });

    void logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "admin.announcement.created",
      resourceType: "announcement",
      resourceId: announcement.id,
      traceId: requestId,
    });

    // Fire push to school - fire-and-forget
    void (async () => {
      await sendPushToSchool(user.schoolId!, {
        title: "New Announcement",
        body: body.title,
        url: "/announcements",
      });
    })().catch(() => null);

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    return handleApiError(error, { requestId, route: "/api/admin/announcements", method: "POST" });
  }
}
