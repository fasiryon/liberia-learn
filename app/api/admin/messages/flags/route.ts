import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const filter = searchParams.get("filter") ?? "pending"; // pending | dismissed | actioned | all

    const schoolFilter = user.isPlatformAdmin ? {} : { fromUser: { schoolId: user.schoolId } };

    const resolutionFilter: Record<string, unknown> =
      filter === "dismissed"
        ? { flagResolution: "DISMISSED" }
        : filter === "actioned"
        ? { flagResolution: "ACTIONED" }
        : filter === "all"
        ? {}
        : { flagReviewedAt: null }; // pending

    const messages = await prisma.message.findMany({
      where: {
        flagged: true,
        ...resolutionFilter,
        ...schoolFilter,
      },
      orderBy: { flaggedAt: "desc" },
      take: 100,
      select: {
        id: true,
        body: true,
        senderRole: true,
        recipientRole: true,
        flagReason: true,
        flaggedAt: true,
        flagReviewedAt: true,
        flagResolution: true,
        createdAt: true,
        fromUser: { select: { id: true, role: true } },
        toUser: { select: { id: true, role: true } },
      },
    });

    return NextResponse.json({
      flags: messages.map((m) => ({
        id: m.id,
        preview: m.body.slice(0, 80),
        senderRole: m.senderRole,
        recipientRole: m.recipientRole,
        flagReason: m.flagReason,
        flaggedAt: m.flaggedAt?.toISOString() ?? null,
        flagReviewedAt: m.flagReviewedAt?.toISOString() ?? null,
        flagResolution: m.flagResolution ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
