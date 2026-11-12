import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ query: vi.fn(), sqs: vi.fn(), config: vi.fn(), flag: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRawUnsafe: m.query } }));
vi.mock("@aws-sdk/client-sqs", () => ({
  GetQueueAttributesCommand: vi.fn().mockImplementation(function (input) { return { input }; }),
  SQSClient: vi.fn().mockImplementation(function () { return { send: m.sqs }; }),
}));
vi.mock("@/lib/canva/config", () => ({ getCanvaMcpHealth: m.config }));
vi.mock("@/lib/serverFlags", () => ({ isCanvaCourseThumbnailsEnabled: m.flag, isCanvaMoeReportsEnabled: m.flag,
  isCertificationAssetGenerationEnabled: m.flag, isHiggsfieldVideoGenerationEnabled: m.flag, isSchoolOnboardingKitsEnabled: m.flag }));
import { GET } from "@/app/api/health/canva/route";
beforeEach(() => {
  vi.clearAllMocks(); m.query.mockResolvedValue([]); m.sqs.mockResolvedValue({}); m.flag.mockReturnValue(true);
  m.config.mockReturnValue({ anthropicEnvDetected: true, canvaMcpConfigured: true, canvaMcpUrlHost: "internal.synthetic.invalid", serverSideOnly: true });
  vi.stubEnv("SQS_QUEUE_URL", "https://queue.synthetic.invalid/jobs");
  vi.stubEnv("HIGGSFIELD_CREDENTIALS", "synthetic-id:synthetic-secret");
});
afterEach(() => vi.unstubAllEnvs());
describe("SEC-09 public provider liveness", () => {
  it("performs no database, SQS, configuration or feature-flag diagnostics", async () => {
    await GET(); expect(m.query).not.toHaveBeenCalled(); expect(m.sqs).not.toHaveBeenCalled();
    expect(m.config).not.toHaveBeenCalled(); expect(m.flag).not.toHaveBeenCalled();
  });
  it("returns only uncached handler liveness", async () => {
    const response = await GET(); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "alive" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not consult unavailable provider or database dependencies", async () => {
    m.query.mockRejectedValue(new Error("synthetic database unavailable")); m.sqs.mockRejectedValue(new Error("synthetic queue unavailable"));
    const response = await GET(); expect(response.status).toBe(200);
    expect(m.query).not.toHaveBeenCalled(); expect(m.sqs).not.toHaveBeenCalled();
  });
});
