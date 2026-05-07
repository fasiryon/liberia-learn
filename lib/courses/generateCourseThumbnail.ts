import { generateCanvaAsset } from "@/lib/canva/canvaMcp";
import { logAssetGenerationTelemetry } from "@/lib/assets/generationTelemetry";

export async function generateCourseThumbnail(input: {
  courseName: string;
  subject: string;
  gradeLevel: number;
  schoolName?: string | null;
  tenantId: string | null;
  actorUserId?: string | null;
  route?: string;
  jobName?: string;
  queueWaitMs?: number | null;
  retryCount?: number | null;
}): Promise<{ canvaUrl: string; designId: string }> {
  const startTime = new Date();
  const route = input.route ?? "worker.courseThumbnail";
  try {
    const response = await generateCanvaAsset(`Create a modern educational course thumbnail in Canva.

Course: ${input.courseName}
Subject: ${input.subject}
Grade Level: Grade ${input.gradeLevel}
School: ${input.schoolName ?? "LiberiaLearn"}
Tenant ID: ${input.tenantId ?? "national"}

Requirements:
- LiberiaLearn branding colors with confident education styling
- readable typography for dashboard cards
- subject-themed visuals
- 16:9 layout optimized for course catalog cards
- no tiny text

Return the Canva design URL.`);

    await logAssetGenerationTelemetry({
      provider: "anthropic_canva_mcp",
      model: response.model,
      assetType: "course_thumbnail",
      tenantId: input.tenantId,
      schoolId: input.tenantId,
      userId: input.actorUserId ?? null,
      route,
      jobName: input.jobName ?? null,
      startTime,
      endTime: new Date(),
      queueWaitMs: input.queueWaitMs ?? null,
      retryCount: input.retryCount ?? null,
      success: true,
      tokensUsed: response.tokensUsed,
      metadata: { designId: response.designId },
    });
    return { canvaUrl: response.canvaUrl, designId: response.designId };
  } catch (error: any) {
    await logAssetGenerationTelemetry({
      provider: "anthropic_canva_mcp",
      model: process.env.ANTHROPIC_CANVA_MODEL ?? null,
      assetType: "course_thumbnail",
      tenantId: input.tenantId,
      schoolId: input.tenantId,
      userId: input.actorUserId ?? null,
      route,
      jobName: input.jobName ?? null,
      startTime,
      endTime: new Date(),
      queueWaitMs: input.queueWaitMs ?? null,
      retryCount: input.retryCount ?? null,
      success: false,
      failureReason: error?.message ?? "Course thumbnail generation failed",
    });
    throw error;
  }
}
