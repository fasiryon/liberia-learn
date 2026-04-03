import { describe, expect, it, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import { DemoHintsSection } from "@/components/DemoHintsSection";
import { getDemoCredentials } from "@/lib/demoCredentials";

describe("demo hints rendering", () => {
  afterEach(() => {
    delete process.env.DEMO_MODE;
    delete process.env.VERCEL_ENV;
    Object.assign(process.env, { NODE_ENV: "test" });
  });

  it("renders nothing when DEMO_MODE is off", () => {
    delete process.env.DEMO_MODE;
    const html = renderToStaticMarkup(<DemoHintsSection variant="login" />);
    expect(html).toBe("");
  });

  it("renders hints when DEMO_MODE is on", () => {
    Object.assign(process.env, { DEMO_MODE: "true" });
    const html = renderToStaticMarkup(<DemoHintsSection variant="login" />);
    expect(html).toContain("Demo Login Hints");
    expect(html).toContain("student1@cha.edu.lr");
    expect(html).toContain("teacher1@cha.edu.lr");
    expect(html).toContain("guardian1@cha.family.lr");
    expect(html).toContain("official1@moe.gov.lr");
    expect(html).toContain("Password: DemoSeed2026!");
    expect(html).toContain("Password: MOESeed2026!");
    expect(html).not.toContain("student1@legacy-demo.lr");
    expect(html).not.toContain("Password: LegacyDemo123!");
  });

  it("renders hints in development even when DEMO_MODE is off", () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    delete process.env.DEMO_MODE;

    const html = renderToStaticMarkup(<DemoHintsSection variant="login" />);

    expect(html).toContain("Demo Login Hints");
    expect(html).toContain("student1@cha.edu.lr");
  });
});

describe("seed scripts do not print demo passwords", () => {
  it("prisma/seed.ts contains no password log output", () => {
    const seedPath = path.join(process.cwd(), "prisma", "seed.ts");
    const contents = fs.readFileSync(seedPath, "utf8");
    expect(contents).not.toMatch(/MOE Demo Credentials/i);
    expect(contents).not.toMatch(/Password:\s*LegacyDemo123!/);
  });

  it("shared demo credentials stay aligned with the CHA seed script", () => {
    const seedPath = path.join(process.cwd(), "prisma", "seeds", "cha-demo.ts");
    const contents = fs.readFileSync(seedPath, "utf8");

    for (const credential of getDemoCredentials()) {
      expect(contents).toContain(credential.email);
      expect(contents).toContain(credential.password);
      expect(contents).toContain(credential.role);
    }
  });
});
