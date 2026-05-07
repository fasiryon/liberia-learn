import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { NextResponse } from "next/server";

import { getCanvaMcpHealth } from "@/lib/canva/config";
import { prisma } from "@/lib/db";
import {
  isCanvaCourseThumbnailsEnabled,
  isCanvaMoeReportsEnabled,
  isCertificationAssetGenerationEnabled,
  isHiggsfieldVideoGenerationEnabled,
  isSchoolOnboardingKitsEnabled,
} from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const ASSET_COLUMNS = [
  ["CurriculumContent", "thumbnailUrl"],
  ["School", "onboardingKitUrl"],
  ["School", "onboardingKitStatus"],
  ["School", "onboardingGeneratedAt"],
  ["ExamCertification", "bannerUrl"],
  ["ExamCertification", "videoUrl"],
  ["ExamCertification", "assetGenerationStatus"],
] as const;

function isConfigured(value?: string | null) {
  return Boolean(value?.trim());
}

function getHiggsfieldUrlHealth() {
  const rawUrl = process.env.HIGGSFIELD_API_URL?.trim() ?? "";
  let host: string | null = null;
  let appearsToBeDashboardPage = false;
  let appearsToBeRuntimeEndpoint = false;

  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      host = url.hostname;
      appearsToBeDashboardPage =
        url.hostname === "cloud.higgsfield.ai" ||
        url.pathname.includes("api-keys") ||
        url.pathname.includes("dashboard");
      appearsToBeRuntimeEndpoint =
        url.hostname === "platform.higgsfield.ai" &&
        url.pathname.split("/").filter(Boolean).length >= 2;
    } catch {
      appearsToBeDashboardPage = false;
    }
  }

  return {
    configured: isConfigured(rawUrl),
    host,
    appearsToBeDashboardPage,
    appearsToBeRuntimeEndpoint,
    authConfigured: isConfigured(process.env.HIGGSFIELD_API_KEY),
    ready:
      isConfigured(rawUrl) &&
      isConfigured(process.env.HIGGSFIELD_API_KEY) &&
      appearsToBeRuntimeEndpoint &&
      !appearsToBeDashboardPage,
  };
}

async function getDatabaseMigrationReadiness() {
  try {
    const rows = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      `select table_name, column_name
       from information_schema.columns
       where table_schema = 'public'
         and (
           (table_name = 'CurriculumContent' and column_name in ('thumbnailUrl'))
           or (table_name = 'School' and column_name in ('onboardingKitUrl', 'onboardingKitStatus', 'onboardingGeneratedAt'))
           or (table_name = 'ExamCertification' and column_name in ('bannerUrl', 'videoUrl', 'assetGenerationStatus'))
         )`
    );
    const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missingColumns = ASSET_COLUMNS
      .map(([table, column]) => `${table}.${column}`)
      .filter((column) => !present.has(column));

    return {
      checked: true,
      ready: missingColumns.length === 0,
      requiredColumnCount: ASSET_COLUMNS.length,
      presentColumnCount: ASSET_COLUMNS.length - missingColumns.length,
      missingColumns,
    };
  } catch {
    return {
      checked: false,
      ready: false,
      requiredColumnCount: ASSET_COLUMNS.length,
      presentColumnCount: 0,
      missingColumns: ASSET_COLUMNS.map(([table, column]) => `${table}.${column}`),
      errorCode: "DB_READINESS_CHECK_FAILED",
    };
  }
}

async function getSqsReadiness() {
  const queueUrl = process.env.SQS_QUEUE_URL?.trim() ?? "";
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
  if (!queueUrl) {
    return {
      configured: false,
      reachable: false,
      regionConfigured: isConfigured(process.env.AWS_REGION) || isConfigured(process.env.AWS_DEFAULT_REGION),
    };
  }

  try {
    const client = new SQSClient({ region });
    await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["QueueArn"],
      })
    );
    return {
      configured: true,
      reachable: true,
      regionConfigured: true,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      regionConfigured: true,
      errorCode: "SQS_REACHABILITY_CHECK_FAILED",
    };
  }
}

export async function GET() {
  const health = getCanvaMcpHealth();
  const [databaseMigration, sqs] = await Promise.all([
    getDatabaseMigrationReadiness(),
    getSqsReadiness(),
  ]);
  const higgsfield = getHiggsfieldUrlHealth();
  const featureFlags = {
    canvaCourseThumbnails: isCanvaCourseThumbnailsEnabled(),
    canvaMoeReports: isCanvaMoeReportsEnabled(),
    schoolOnboardingKits: isSchoolOnboardingKitsEnabled(),
    certificationAssetGeneration: isCertificationAssetGenerationEnabled(),
    higgsfieldVideoGeneration: isHiggsfieldVideoGenerationEnabled(),
  };
  const featureFlagsEnabled =
    featureFlags.canvaCourseThumbnails &&
    featureFlags.schoolOnboardingKits &&
    featureFlags.certificationAssetGeneration &&
    featureFlags.higgsfieldVideoGeneration;
  const canvaMcpReady = health.anthropicEnvDetected && health.canvaMcpConfigured;
  const ok =
    canvaMcpReady &&
    databaseMigration.ready &&
    sqs.reachable &&
    higgsfield.ready &&
    featureFlagsEnabled;

  return NextResponse.json(
    {
      ok,
      status: ok ? "healthy" : "unavailable",
      code: ok ? "ASSET_PIPELINE_READY" : "ASSET_PIPELINE_UNAVAILABLE",
      anthropicEnvDetected: health.anthropicEnvDetected,
      canvaMcpReady,
      canvaMcpConfigured: health.canvaMcpConfigured,
      canvaMcpUrlHost: health.canvaMcpUrlHost,
      serverSideOnly: health.serverSideOnly,
      databaseMigration,
      higgsfield,
      sqs,
      featureFlags,
    },
    { status: ok ? 200 : 503 }
  );
}
