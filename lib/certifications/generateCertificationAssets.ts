import { generateCanvaAsset } from "@/lib/canva/canvaMcp";
import { logAssetGenerationTelemetry } from "@/lib/assets/generationTelemetry";

function getHiggsfieldAuthHeader(endpoint: string, apiKey: string) {
  try {
    const url = new URL(endpoint);
    if (url.hostname === "platform.higgsfield.ai") {
      return `Key ${apiKey}`;
    }
  } catch {
    return `Bearer ${apiKey}`;
  }
  return `Bearer ${apiKey}`;
}

function isHiggsfieldDashboardUrl(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return (
      url.hostname === "cloud.higgsfield.ai" ||
      url.pathname.includes("api-keys") ||
      url.pathname.includes("dashboard")
    );
  } catch {
    return false;
  }
}

export async function generateCertificationBanner(input: {
  title: string;
  subject: string;
  grade: number;
  schoolId?: string | null;
  actorUserId?: string | null;
  route?: string;
  jobName?: string;
  queueWaitMs?: number | null;
  retryCount?: number | null;
}): Promise<{ canvaUrl: string }> {
  const startTime = new Date();
  const route = input.route ?? "worker.certificationAssets";
  try {
    const response = await generateCanvaAsset(`Create a cinematic academic Canva banner for a LiberiaLearn certification pathway.

Certification: ${input.title}
Subject: ${input.subject}
Grade: Grade ${input.grade}

Requirements:
- certification pathway identity
- future-career oriented visuals
- LiberiaLearn national branding
- professional education tone
- dashboard and social-ready banner layout

Return the Canva design URL.`);

    await logAssetGenerationTelemetry({
      provider: "anthropic_canva_mcp",
      model: response.model,
      assetType: "certification_banner",
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
      assetType: "certification_banner",
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
      failureReason: error?.message ?? "Certification banner generation failed",
    });
    throw error;
  }
}

export async function generateHiggsfieldPromoVideo(input: {
  title: string;
  subject: string;
  grade: number;
  schoolId?: string | null;
  actorUserId?: string | null;
  route?: string;
  jobName?: string;
  queueWaitMs?: number | null;
  retryCount?: number | null;
}): Promise<{ videoUrl: string }> {
  const startTime = new Date();
  const route = input.route ?? "worker.certificationAssets";
  const endpoint = process.env.HIGGSFIELD_API_URL?.trim();
  const apiKey = process.env.HIGGSFIELD_API_KEY?.trim();
  if (!endpoint || !apiKey || isHiggsfieldDashboardUrl(endpoint)) {
    const error = Object.assign(new Error("Higgsfield unavailable"), { status: 503 });
    await logAssetGenerationTelemetry({
      provider: "higgsfield",
      assetType: "certification_video",
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
      failureReason: error.message,
    });
    throw error;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: getHiggsfieldAuthHeader(endpoint, apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: `Create a short cinematic 15-30 second promo video for the ${input.title} certification pathway in Grade ${input.grade} ${input.subject}. Use an education and future workforce tone suitable for marketing and social media in Liberia.`,
        duration: 10,
        resolution: "720p",
        aspect_ratio: "16:9",
      }),
    });

    if (!response.ok) {
      throw Object.assign(new Error("Higgsfield generation failed"), { status: response.status });
    }

    const data = await response.json();
    const videoUrl =
      typeof data?.videoUrl === "string"
        ? data.videoUrl
        : typeof data?.video_url === "string"
          ? data.video_url
          : typeof data?.video?.url === "string"
            ? data.video.url
            : "";
    if (!videoUrl) {
      throw Object.assign(new Error("Higgsfield URL not returned"), { status: 502 });
    }

    await logAssetGenerationTelemetry({
      provider: "higgsfield",
      assetType: "certification_video",
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
    });
    return { videoUrl };
  } catch (error: any) {
    await logAssetGenerationTelemetry({
      provider: "higgsfield",
      assetType: "certification_video",
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
      failureReason: error?.message ?? "Higgsfield generation failed",
    });
    throw error;
  }
}
