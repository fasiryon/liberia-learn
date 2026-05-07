import { generateCanvaAsset } from "@/lib/canva/canvaMcp";
import { logAssetGenerationTelemetry } from "@/lib/assets/generationTelemetry";

export async function generateOnboardingKit(input: {
  schoolName: string;
  county?: string | null;
  principalName?: string | null;
  schoolCode?: string | null;
  schoolId?: string | null;
  actorUserId?: string | null;
  route?: string;
  jobName?: string;
  queueWaitMs?: number | null;
  retryCount?: number | null;
}): Promise<{ canvaUrl: string }> {
  const startTime = new Date();
  const route = input.route ?? "worker.onboardingKit";
  try {
    const response = await generateCanvaAsset(`Create an editable Canva onboarding kit for a newly provisioned LiberiaLearn school.

School: ${input.schoolName}
County: ${input.county ?? "Liberia"}
Principal/Admin: ${input.principalName ?? "School administrator"}
School Code: ${input.schoolCode ?? "provided in LiberiaLearn"}

Create three export-ready PDF documents in one organized Canva design:
1. School flyer
2. Parent introduction letter
3. Student quick-start guide

Use LiberiaLearn and school branding, modern professional education style,
clear setup next steps, and editable Canva layouts.

Return the Canva design URL.`);

    await logAssetGenerationTelemetry({
      provider: "anthropic_canva_mcp",
      model: response.model,
      assetType: "school_onboarding_kit",
      tenantId: input.schoolId ?? null,
      schoolId: input.schoolId ?? null,
      userId: input.actorUserId ?? null,
      route,
      jobName: input.jobName ?? null,
      startTime,
      endTime: new Date(),
      queueWaitMs: input.queueWaitMs ?? null,
      retryCount: input.retryCount ?? null,
      success: true,
      tokensUsed: response.tokensUsed,
    });
    return { canvaUrl: response.canvaUrl };
  } catch (error: any) {
    await logAssetGenerationTelemetry({
      provider: "anthropic_canva_mcp",
      model: process.env.ANTHROPIC_CANVA_MODEL ?? null,
      assetType: "school_onboarding_kit",
      tenantId: input.schoolId ?? null,
      schoolId: input.schoolId ?? null,
      userId: input.actorUserId ?? null,
      route,
      jobName: input.jobName ?? null,
      startTime,
      endTime: new Date(),
      queueWaitMs: input.queueWaitMs ?? null,
      retryCount: input.retryCount ?? null,
      success: false,
      failureReason: error?.message ?? "Onboarding kit generation failed",
    });
    throw error;
  }
}
