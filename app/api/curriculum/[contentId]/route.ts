import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { signContentAvailability } from "@/lib/content-availability-manifest.server";

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
        ? { in: ["published", "APPROVED", "REVOKED"] }
        : { in: ["published", "APPROVED", "pending_approval", "rejected", "REVOKED", "SUPERSEDED"] };

    const row = await prisma.curriculumContent.findFirst({
      where: {
        contentId,
        status: statusFilter,
        ...(user.isPlatformAdmin
          ? {}
          : {
              OR: [
                { schoolId: null },
                ...(user.schoolId ? [{ schoolId: user.schoolId }] : []),
              ],
            }),
      },
      select: {
        contentId: true,
        grade: true,
        subject: true,
        contentType: true,
        status: true,
        version: true,
        payload: true,
        teacherCreated: true,
        editedBy: { select: { name: true } },
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
          where: {
            schoolId: user.schoolId ?? "__no_school__",
            status: "APPROVED",
            isActive: true,
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
            isActive: true,
            uploadedAt: true,
            uploadedBy: true,
          },
        },
        provenance: {
          select: {
            id: true,
            lifecycleState: true,
            currentRevisionId: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) {
      return NextResponse.json(
        {
          error: "Not found",
          contentId,
          offlineManifest: signContentAvailability({ contentId, version: null, revoked: true }),
        },
        { status: 404 }
      );
    }

    if (row.provenance?.lifecycleState === "REVOKED") {
      const revocation = await prisma.curriculumGovernanceEvent.findFirst({
        where: {
          provenanceId: row.provenance.id,
          eventType: "REVOKED",
        },
        orderBy: { occurredAt: "desc" },
        select: {
          futureAssignmentPolicy: true,
          existingAssignmentPolicy: true,
          offlineCachePolicy: true,
          replacementRevisionId: true,
          reason: true,
        },
      });
      return NextResponse.json(
        {
          error: "Content revoked",
          contentId,
          offlineManifest: signContentAvailability({
            contentId,
            version: null,
            revoked: true,
          }),
          revocation,
        },
        { status: 410 },
      );
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
        teacherCreated: row.teacherCreated ?? false,
        teacherAuthorName: row.teacherCreated && row.editedBy?.name
          ? row.editedBy.name
          : null,
        currentRevisionId: row.provenance?.currentRevisionId ?? null,
        audioStatus:
          row.audioAssets[0]?.contentVersion === row.version
            ? row.audioAssets[0]?.status ?? "NOT_GENERATED"
            : row.audioAssets[0]?.status === "GENERATED"
              ? "STALE"
              : row.audioAssets[0]?.status ?? "NOT_GENERATED",
      },
      payload: row.payload,
      audio: row.audioAssets[0] ?? null,
      offlineManifest: signContentAvailability({ contentId: row.contentId, version: row.version, revoked: false }),
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
