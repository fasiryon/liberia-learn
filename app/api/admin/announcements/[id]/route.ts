import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  audience: z.enum(["ALL", "STUDENTS", "TEACHERS", "GUARDIANS"]).optional(),
  isPinned: z.boolean().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

    const existing = await prisma.announcement.findUnique({ where: { id: params.id } });
    if (!existing || existing.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = UpdateSchema.parse(await req.json());
    const announcement = await prisma.announcement.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.audience !== undefined && { audience: body.audience }),
        ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
        ...(body.publishedAt !== undefined && { publishedAt: body.publishedAt ? new Date(body.publishedAt) : null }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
      },
    });

    void logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "admin.announcement.updated",
      resourceType: "announcement",
      resourceId: params.id,
      traceId: requestId,
    });

    return NextResponse.json({ announcement });
  } catch (error) {
    return handleApiError(error, { requestId, route: `/api/admin/announcements/${params.id}`, method: "PATCH" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "School context required" }, { status: 400 });

    const existing = await prisma.announcement.findUnique({ where: { id: params.id } });
    if (!existing || existing.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Soft delete: unpublish by setting publishedAt to null
    await prisma.announcement.update({
      where: { id: params.id },
      data: { publishedAt: null },
    });

    void logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "admin.announcement.deleted",
      resourceType: "announcement",
      resourceId: params.id,
      traceId: requestId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, { requestId, route: `/api/admin/announcements/${params.id}`, method: "DELETE" });
  }
}
