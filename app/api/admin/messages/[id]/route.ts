import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { resolution, notes } = body as Record<string, unknown>;

    if (!resolution || !["DISMISSED", "ACTIONED"].includes(resolution as string)) {
      return NextResponse.json({ error: "resolution must be DISMISSED or ACTIONED" }, { status: 400 });
    }

    const message = await prisma.message.findUnique({
      where: { id: params.id },
      select: { id: true, flagged: true, fromUser: { select: { schoolId: true } } },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (!message.flagged) {
      return NextResponse.json({ error: "Message is not flagged" }, { status: 400 });
    }
    if (!user.isPlatformAdmin && message.fromUser.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.message.update({
      where: { id: params.id },
      data: {
        flagReviewedAt: new Date(),
        flagReviewedBy: user.id,
        flagResolution: resolution as string,
        ...(typeof notes === "string" && notes.trim() ? { flagReason: notes.trim() } : {}),
      },
    });

    void logAudit({
      userId: user.id,
      action: "admin.message.flag_reviewed",
      resourceType: "message",
      resourceId: params.id,
      schoolId: user.schoolId ?? undefined,
      details: { resolution, notes },
    });

    return NextResponse.json({ reviewed: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
