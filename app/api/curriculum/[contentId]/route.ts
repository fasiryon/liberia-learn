import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/curriculum/:contentId
export async function GET(
  _req: Request,
  { params }: { params: { contentId: string } }
) {
  try {
    const user = await requireRole("STUDENT", "TEACHER", "ADMIN");
    const contentId = params.contentId;
    const statusFilter =
      user.role === "STUDENT"
        ? { in: ["published", "APPROVED"] }
        : { in: ["published", "APPROVED", "pending_approval", "rejected"] };

    const row = await prisma.curriculumContent.findFirst({
      where: {
        contentId,
        status: statusFilter,
      },
      select: {
        contentId: true,
        grade: true,
        subject: true,
        contentType: true,
        status: true,
        version: true,
        payload: true,
        audioAssets: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            storageUrl: true,
            contentVersion: true,
            estimatedCostUsd: true,
            audioParts: true,
          },
        },
        videoSupplements: {
          orderBy: { uploadedAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            storageUrl: true,
            thumbnailUrl: true,
            durationSeconds: true,
            fileSize: true,
            isActive: true,
            uploadedAt: true,
            uploadedBy: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Not found", contentId }, { status: 404 });
    }

    return NextResponse.json({
      metadata: {
        contentId: row.contentId,
        grade: row.grade,
        subject: row.subject,
        contentType: row.contentType,
        status: row.status,
        version: row.version,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        audioStatus:
          row.audioAssets[0]?.contentVersion === row.version
            ? row.audioAssets[0]?.status ?? "NOT_GENERATED"
            : row.audioAssets[0]?.status === "GENERATED"
              ? "STALE"
              : row.audioAssets[0]?.status ?? "NOT_GENERATED",
      },
      payload: row.payload,
      audio: row.audioAssets[0] ?? null,
      videos: await Promise.all(
        row.videoSupplements.map(async (v) => {
          const [vHead, tHead] = await Promise.all([
            head(v.storageUrl),
            v.thumbnailUrl ? head(v.thumbnailUrl) : Promise.resolve(null),
          ]);
          return { ...v, storageUrl: vHead.downloadUrl, thumbnailUrl: tHead?.downloadUrl ?? null };
        })
      ),
    });
  } catch (e: any) {
    console.error("GET /api/curriculum/[contentId] failed:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
