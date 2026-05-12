import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });

    const events = await prisma.schoolEvent.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { eventDate: "asc" },
    });

    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN");
    if (!user.schoolId) return NextResponse.json({ error: "No school" }, { status: 403 });

    const body = await req.json();
    const { title, type, eventDate, endDate, description, visibility, sendSms, sendPush, publishNow } = body;

    if (!title || !type || !eventDate) {
      return NextResponse.json({ error: "title, type, eventDate required" }, { status: 400 });
    }

    const event = await prisma.schoolEvent.create({
      data: {
        schoolId: user.schoolId,
        title,
        type,
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : null,
        description: description ?? null,
        visibility: visibility ?? "ALL",
        sendSms: sendSms === true,
        sendPush: sendPush !== false,
        published: publishNow === true,
        createdBy: user.id,
      },
    });

    void logAudit({
      userId: user.id,
      action: "event.created",
      resourceType: "SchoolEvent",
      resourceId: event.id,
      schoolId: user.schoolId,
      details: { title, type, published: event.published },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err?.status || 500 });
  }
}
