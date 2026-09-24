// route-policy: auth=session; scope=tenant; authority=placement-review; rationale=a same-school reviewer reads placement evidence and review history without official-grade authority
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializePlacementDetail } from "@/lib/placementDetail";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const { id } = await params;
    const placement = await prisma.placementTest.findUnique({
      where: { id },
      include: {
        reviews: { orderBy: { createdAt: "desc" } },
        decision: true,
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                schoolId: true,
              },
            },
          },
        },
      },
    });

    if (!placement) {
      return NextResponse.json({ error: "Placement not found" }, { status: 404 });
    }

    if (placement.student.user.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ placement: serializePlacementDetail(placement) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}