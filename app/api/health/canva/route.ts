import { NextResponse } from "next/server";

import { getCanvaMcpHealth } from "@/lib/canva/config";
import {
  isCanvaCourseThumbnailsEnabled,
  isCanvaMoeReportsEnabled,
  isCertificationAssetGenerationEnabled,
  isHiggsfieldVideoGenerationEnabled,
  isSchoolOnboardingKitsEnabled,
} from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = getCanvaMcpHealth();
  const ok = health.anthropicEnvDetected && health.canvaMcpConfigured;

  return NextResponse.json(
    {
      ok,
      status: ok ? "healthy" : "unavailable",
      code: ok ? "CANVA_MCP_READY" : "CANVA_MCP_UNAVAILABLE",
      anthropicEnvDetected: health.anthropicEnvDetected,
      canvaMcpConfigured: health.canvaMcpConfigured,
      canvaMcpUrlHost: health.canvaMcpUrlHost,
      serverSideOnly: health.serverSideOnly,
      featureFlags: {
        canvaCourseThumbnails: isCanvaCourseThumbnailsEnabled(),
        canvaMoeReports: isCanvaMoeReportsEnabled(),
        schoolOnboardingKits: isSchoolOnboardingKitsEnabled(),
        certificationAssetGeneration: isCertificationAssetGenerationEnabled(),
        higgsfieldVideoGeneration: isHiggsfieldVideoGenerationEnabled(),
      },
    },
    { status: ok ? 200 : 503 }
  );
}
