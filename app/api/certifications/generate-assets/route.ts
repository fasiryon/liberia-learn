import { NextResponse } from "next/server";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { requireMoeActor } from "@/lib/moe/authority";
import { enqueueJob, JobType } from "@/lib/queue";
import { isCertificationAssetGenerationEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  certificationId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    if (
      typeof isCertificationAssetGenerationEnabled !== "function" ||
      !isCertificationAssetGenerationEnabled()
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { user } = await requireMoeActor();
    const body = RequestSchema.parse(await req.json());
    const certification = await prisma.examCertification.findUnique({
      where: { id: body.certificationId },
      select: { id: true, exam: { select: { schoolId: true } } },
    });
    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    await prisma.examCertification.update({
      where: { id: certification.id },
      data: { assetGenerationStatus: "pending" },
    });
    await enqueueJob(JobType.GENERATE_CERTIFICATION_ASSETS, {
      certificationId: certification.id,
      actorUserId: user.id,
    });
    await logAudit({
      userId: user.id,
      schoolId: certification.exam.schoolId,
      action: "certification.assets.enqueued",
      resourceType: "examCertification",
      resourceId: certification.id,
    });

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    return handleApiError(error);
  }
}
