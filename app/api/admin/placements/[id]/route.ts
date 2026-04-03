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
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schoolId = user.schoolId ?? null;
    if (!schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const { id } = await params;
    const placement = await prisma.placementTest.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: {
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

    if (placement.student.user.schoolId !== schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ placement: serializePlacementDetail(placement) });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: err?.status ?? 500 }
    );
  }
}
