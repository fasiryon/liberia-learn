import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMoePortalEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isMoePortalEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = await requireRole("MOE_OFFICIAL", "PLATFORM_ADMIN");
    if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId") || undefined;
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;

    const where: Record<string, unknown> = {};
    if (schoolId) where.schoolId = schoolId;
    if (type) where.type = type;
    if (status) where.status = status;

    const submissions = await prisma.moeSubmission.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: 200,
    });

    return NextResponse.json(submissions);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
