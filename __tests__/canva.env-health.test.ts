import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/canva/route";
import { getCanvaMcpHealth } from "@/lib/canva/config";

const ORIGINAL_ANTHROPIC = process.env.ANTHROPIC_API_KEY;

describe("Canva MCP env health", () => {
  afterEach(() => {
    if (ORIGINAL_ANTHROPIC == null) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
    }
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
    expect(body.canvaMcpUrlHost).toBe("mcp.canva.com");
    expect(JSON.stringify(body)).not.toContain("secret-test-key");
  });
});
