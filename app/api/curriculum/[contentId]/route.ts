import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { signContentAvailability } from "@/lib/content-availability-manifest.server";
import { provenanceWritersEnabled } from "@/lib/curriculum/mutations/repository";

export const dynamic = "force-dynamic";

function projectionMatchesLifecycle(status: string, lifecycleState: string): boolean {
  const normalized = status.trim().toUpperCase();
  switch (lifecycleState) {
    case "APPROVED":
      return normalized === "PUBLISHED" || normalized === "APPROVED";
    case "PENDING_REVIEW":
      return normalized === "NEEDS_REVIEW" || normalized === "PENDING_APPROVAL";
    case "REJECTED":
      return normalized === "REJECTED";
    case "REVOKED":
      return normalized === "REVOKED";
    case "SUPERSEDED":
      return normalized === "SUPERSEDED";
    case "DRAFT":
      return normalized === "DRAFT";
    default:
      return false;
  }
}

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

    const { row, latestGovernance, latestLifecycle, latestRevision } = await prisma.$transaction(async (tx) => {
      const row = await tx.curriculumContent.findFirst({
      where: {
        contentId,
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
            currentRevision: {
              select: {
                sequence: true,
                createdAt: true,
              },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      });
      if (!row?.provenance) {
        return { row, latestGovernance: null, latestLifecycle: null, latestRevision: null };
      }
      const [latestGovernance, latestLifecycle, latestRevision] = await Promise.all([
        row.provenance.currentRevisionId
          ? tx.curriculumGovernanceEvent.findFirst({
              where: {
                provenanceId: row.provenance.id,
                revisionId: row.provenance.currentRevisionId,
              },
              orderBy: { sequence: "desc" },
              select: { sequence: true, createdAt: true },
            })
          : Promise.resolve(null),
        tx.curriculumGovernanceEvent.findFirst({
          where: { provenanceId: row.provenance.id, lifecycleResult: { not: null } },
          orderBy: { sequence: "desc" },
          select: { revisionId: true, lifecycleResult: true, createdAt: true },
        }),
        tx.curriculumContentRevision.findFirst({
          where: { provenanceId: row.provenance.id },
          orderBy: { sequence: "desc" },
          select: { id: true, sequence: true },
        }),
      ]);
      return { row, latestGovernance, latestLifecycle, latestRevision };
    }, { isolationLevel: "RepeatableRead" });

    if (!row) {
      return NextResponse.json(
        {
          error: "Not found",
          contentId,
          offlineManifest: null,
        },
        { status: 404 }
      );
    }

    const currentRevision = row.provenance?.currentRevision ?? null;
    const lifecycleIsCoherent =
      Boolean(row.provenance) &&
      Boolean(currentRevision) &&
      projectionMatchesLifecycle(row.status, row.provenance!.lifecycleState) &&
      (!latestLifecycle ||
        (latestLifecycle.lifecycleResult === row.provenance!.lifecycleState &&
          (latestLifecycle.revisionId === row.provenance!.currentRevisionId ||
            latestLifecycle.createdAt.getTime() <= currentRevision!.createdAt.getTime())));
    const manifestAuthorityIsCoherent =
      provenanceWritersEnabled() &&
      Boolean(currentRevision) &&
      latestRevision?.id === row.provenance?.currentRevisionId &&
      latestRevision.sequence === currentRevision?.sequence &&
      lifecycleIsCoherent;
    const trustIssuedAt = currentRevision
      ? new Date(
          Math.max(
            currentRevision.createdAt.getTime(),
            latestGovernance?.createdAt.getTime() ?? 0,
          ),
        ).toISOString()
      : null;
    const signAvailability = (version: string | null, revoked: boolean) =>
      manifestAuthorityIsCoherent && currentRevision && trustIssuedAt
        ? signContentAvailability({
            contentId,
            version,
            revoked,
            issuedAt: trustIssuedAt,
            sequence: {
              revision: currentRevision.sequence,
              governance: latestGovernance?.sequence ?? 0,
            },
          })
        : null;

    if (!statusFilter.in.includes(row.status)) {
      return NextResponse.json(
        {
          error: "Not found",
          contentId,
          offlineManifest: signAvailability(null, true),
        },
        { status: 404 },
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
          offlineManifest: signAvailability(null, true),
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
      offlineManifest: signAvailability(row.version, false),
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
