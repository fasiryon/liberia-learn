import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createEliteUpgradeDraft } from "@/lib/curriculum/eliteUpgrade";
import { logger } from "@/lib/logger";

const RequestSchema = z.object({
  contentId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN", "TEACHER");
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await createEliteUpgradeDraft({
      contentId: parsed.data.contentId,
      userId: user.id,
      schoolId: user.schoolId ?? null,
    });

    await logAudit({
      userId: user.id,
      action: "curriculum.elite_upgrade.created",
      resourceType: "curriculum",
      resourceId: result.draftContentId,
      schoolId: user.schoolId ?? undefined,
      details: {
        originalContentId: result.originalContentId,
        versionName: result.versionName,
        scoreDelta: result.qualityScores.delta,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    logger.error("Curriculum elite upgrade route failed", {
      route: "/api/admin/curriculum/upgrade",
      errorMessage: err?.message ?? String(err),
      status: err?.status ?? 500,
    });
    return NextResponse.json(
      { error: err?.message ?? "Failed to create elite upgrade draft" },
      { status: err?.status ?? 500 }
    );
  }
}

