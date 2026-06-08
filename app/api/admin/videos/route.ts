import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
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

    const signedVideos = await Promise.all(
      videos.map(async (v) => {
        const [vHead, tHead] = await Promise.all([
          head(v.storageUrl),
          v.thumbnailUrl ? head(v.thumbnailUrl) : Promise.resolve(null),
        ]);
        return { ...v, storageUrl: vHead.downloadUrl, thumbnailUrl: tHead?.downloadUrl ?? null };
      })
    );
    return NextResponse.json({ videos: signedVideos, pendingCount });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: error?.status ?? 500 });
  }
}
