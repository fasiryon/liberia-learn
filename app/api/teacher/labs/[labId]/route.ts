import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/labs/[labId]
 * Part 7: Get full lab detail including payload.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { labId: string } }
) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { labId } = params;

    const lab = await prisma.virtualLab.findUnique({ where: { labId } });

    if (!lab) {
      return NextResponse.json({ error: "Lab not found" }, { status: 404 });
    }
    if (lab.schoolId !== null && lab.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ lab });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to get lab" },
      { status: err?.status ?? 500 }
    );
  }
}
