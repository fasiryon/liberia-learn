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

  return NextResponse.json({
    ok: health.anthropicEnvDetected && health.canvaMcpConfigured,
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
  });
}
