import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/security/contentSecurityPolicy";

describe("enforcing CSP", () => {
  it("uses a nonce and no script unsafe-inline in production", () => {
    const policy = buildContentSecurityPolicy("fixednonce", true);
    const scriptDirective = policy.split("; ").find((part) => part.startsWith("script-src"));
    expect(scriptDirective).toContain("'nonce-fixednonce'");
    expect(scriptDirective).not.toContain("'unsafe-inline'");
    expect(policy).toContain("frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com");
  });

  it("removes report-only configuration and known executable inline scripts", () => {
    expect(readFileSync("next.config.js", "utf8")).not.toContain("Content-Security-Policy-Report-Only");
    expect(readFileSync("app/admin/credential-card/page.tsx", "utf8")).not.toContain("<script");
    expect(readFileSync("components/LowBandwidthModeScript.tsx", "utf8")).not.toContain("dangerouslySetInnerHTML");
    expect(readFileSync("app/api/moe/export/summary-pdf/route.ts", "utf8")).not.toContain("<script>");
  });
});
