import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendPushToSchool } from "@/lib/push/sendPush";
import { scheduleEventSmsReminders } from "@/lib/events/eventSmsScheduler";

export const dynamic = "force-dynamic";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });

    const existing = await prisma.schoolEvent.findFirst({
      where: { id: params.id, schoolId: user.schoolId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const toggled = !existing.published;

    const event = await prisma.schoolEvent.update({
      where: { id: params.id },
      data: { published: toggled },
    });

    void logAudit({
      userId: user.id,
      action: toggled ? "event.published" : "event.unpublished",
      resourceType: "SchoolEvent",
      resourceId: params.id,
      schoolId: user.schoolId,
      details: { title: event.title, type: event.type },
    });

    if (toggled && event.sendPush) {
      const dateStr = event.eventDate.toLocaleDateString("en-LR", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      void sendPushToSchool(user.schoolId, {
        title: `${event.type} — ${event.title}`,
        body: `${dateStr}${event.description ? ": " + event.description.slice(0, 80) : ""}`,
        url: "/student/events",
      });
    }

    if (toggled) {
      void scheduleEventSmsReminders({
        id: event.id,
        schoolId: event.schoolId,
        title: event.title,
        eventDate: event.eventDate,
        type: event.type,
        sendSms: event.sendSms,
      });
    }

    return NextResponse.json({ event });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
