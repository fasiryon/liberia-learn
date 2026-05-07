import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryRawUnsafe = vi.hoisted(() => vi.fn());
const mockSqsSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  GetQueueAttributesCommand: vi.fn().mockImplementation(function (input) {
    return { input };
  }),
  SQSClient: vi.fn().mockImplementation(function () {
    return { send: mockSqsSend };
  }),
}));

import { GET } from "@/app/api/health/canva/route";
import { getCanvaMcpHealth } from "@/lib/canva/config";

const ORIGINAL_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_HIGGSFIELD_CREDENTIALS = process.env.HIGGSFIELD_CREDENTIALS;
const ORIGINAL_SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const ORIGINAL_AWS_REGION = process.env.AWS_REGION;
const ORIGINAL_ENABLE_COURSE_THUMBNAILS = process.env.ENABLE_CANVA_COURSE_THUMBNAILS;
const ORIGINAL_ENABLE_ONBOARDING_KITS = process.env.ENABLE_SCHOOL_ONBOARDING_KITS;
const ORIGINAL_ENABLE_CERTIFICATION_ASSETS = process.env.ENABLE_CERTIFICATION_ASSET_GENERATION;
const ORIGINAL_ENABLE_HIGGSFIELD = process.env.ENABLE_HIGGSFIELD_VIDEO_GENERATION;

function restoreEnv(key: string, value: string | undefined) {
  if (value == null) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

const assetColumns = [
  ["CurriculumContent", "thumbnailUrl"],
  ["School", "onboardingKitUrl"],
  ["School", "onboardingKitStatus"],
  ["School", "onboardingGeneratedAt"],
  ["ExamCertification", "bannerUrl"],
  ["ExamCertification", "videoUrl"],
  ["ExamCertification", "assetGenerationStatus"],
].map(([table_name, column_name]) => ({ table_name, column_name }));

describe("Canva MCP env health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRawUnsafe.mockResolvedValue(assetColumns);
    mockSqsSend.mockResolvedValue({});
    process.env.HIGGSFIELD_CREDENTIALS = "test-key-id:higgsfield-test-secret";
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123/liberialearn-jobs.fifo";
    process.env.AWS_REGION = "us-east-1";
    process.env.ENABLE_CANVA_COURSE_THUMBNAILS = "true";
    process.env.ENABLE_SCHOOL_ONBOARDING_KITS = "true";
    process.env.ENABLE_CERTIFICATION_ASSET_GENERATION = "true";
    process.env.ENABLE_HIGGSFIELD_VIDEO_GENERATION = "true";
  });

  afterEach(() => {
    restoreEnv("ANTHROPIC_API_KEY", ORIGINAL_ANTHROPIC);
    restoreEnv("HIGGSFIELD_CREDENTIALS", ORIGINAL_HIGGSFIELD_CREDENTIALS);
    restoreEnv("SQS_QUEUE_URL", ORIGINAL_SQS_QUEUE_URL);
    restoreEnv("AWS_REGION", ORIGINAL_AWS_REGION);
    restoreEnv("ENABLE_CANVA_COURSE_THUMBNAILS", ORIGINAL_ENABLE_COURSE_THUMBNAILS);
    restoreEnv("ENABLE_SCHOOL_ONBOARDING_KITS", ORIGINAL_ENABLE_ONBOARDING_KITS);
    restoreEnv("ENABLE_CERTIFICATION_ASSET_GENERATION", ORIGINAL_ENABLE_CERTIFICATION_ASSETS);
    restoreEnv("ENABLE_HIGGSFIELD_VIDEO_GENERATION", ORIGINAL_ENABLE_HIGGSFIELD);
  });

  it("detects Anthropic env without returning the secret", () => {
    process.env.ANTHROPIC_API_KEY = "secret-test-key";

    const health = getCanvaMcpHealth();

    expect(health.anthropicEnvDetected).toBe(true);
    expect(JSON.stringify(health)).not.toContain("secret-test-key");
  });

  it("health endpoint returns booleans and host metadata only", async () => {
    process.env.ANTHROPIC_API_KEY = "secret-test-key";

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.anthropicEnvDetected).toBe(true);
    expect(body.canvaMcpConfigured).toBe(true);
    expect(body.canvaMcpReady).toBe(true);
    expect(body.canvaMcpUrlHost).toBe("mcp.canva.com");
    expect(body.databaseMigration.ready).toBe(true);
    expect(body.sqs).toEqual(expect.objectContaining({ configured: true, reachable: true }));
    expect(body.higgsfield).toEqual(expect.objectContaining({
      configured: true,
      ready: true,
    }));
    expect(JSON.stringify(body)).not.toContain("secret-test-key");
    expect(JSON.stringify(body)).not.toContain("higgsfield-test-secret");
  });

  it("fails closed with structured 503 when Anthropic env is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual(expect.objectContaining({
      ok: false,
      status: "unavailable",
      code: "ASSET_PIPELINE_UNAVAILABLE",
      anthropicEnvDetected: false,
      serverSideOnly: true,
    }));
    expect(JSON.stringify(body)).not.toMatch(/API_KEY|secret-test-key|sk-/);
  });

  it("reports missing credentials as not ready without leaking secrets", async () => {
    process.env.ANTHROPIC_API_KEY = "secret-test-key";
    delete process.env.HIGGSFIELD_CREDENTIALS;

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.higgsfield).toEqual(expect.objectContaining({
      configured: false,
      ready: false,
    }));
    expect(JSON.stringify(body)).not.toContain("higgsfield-test-secret");
  });
});
