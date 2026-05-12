import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });

    const existing = await prisma.schoolEvent.findFirst({
      where: { id: params.id, schoolId: user.schoolId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { title, type, eventDate, endDate, description, visibility, sendSms, sendPush } = body;

    const event = await prisma.schoolEvent.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(type !== undefined && { type }),
        ...(eventDate !== undefined && { eventDate: new Date(eventDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(description !== undefined && { description }),
        ...(visibility !== undefined && { visibility }),
        ...(sendSms !== undefined && { sendSms }),
        ...(sendPush !== undefined && { sendPush }),
      },
    });

    void logAudit({
      userId: user.id,
      action: "event.updated",
      resourceType: "SchoolEvent",
      resourceId: params.id,
      schoolId: user.schoolId,
      details: { title: event.title },
    });

    return NextResponse.json({ event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });

    const existing = await prisma.schoolEvent.findFirst({
      where: { id: params.id, schoolId: user.schoolId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.schoolEvent.delete({ where: { id: params.id } });

    void logAudit({
      userId: user.id,
      action: "event.deleted",
      resourceType: "SchoolEvent",
      resourceId: params.id,
      schoolId: user.schoolId,
      details: { title: existing.title },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
