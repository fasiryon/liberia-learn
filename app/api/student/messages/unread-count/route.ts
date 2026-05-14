import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Count messages sent to this student with no read receipt
    const count = await prisma.message.count({
      where: {
        toUserId: user.id,
        senderRole: "TEACHER",
        readReceipts: { none: { userId: user.id } },
      },
    });

    return NextResponse.json({ count });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
