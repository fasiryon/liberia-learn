import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await requireRole("ADMIN");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "PENDING";

    const videos = await prisma.lessonVideo.findMany({
      where: {
        schoolId: admin.schoolId ?? undefined,
        status,
      },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        storageUrl: true,
        thumbnailUrl: true,
        durationSeconds: true,
        fileSize: true,
        status: true,
        rejectedReason: true,
        viewCount: true,
        uploadedAt: true,
        approvedAt: true,
        lesson: { select: { contentId: true, subject: true, grade: true } },
        teacher: { select: { name: true } },
      },
    });

    const pendingCount = await prisma.lessonVideo.count({
      where: { schoolId: admin.schoolId ?? undefined, status: "PENDING" },
    });

    return NextResponse.json({ videos, pendingCount });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
