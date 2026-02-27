import { describe, expect, it, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import { DemoHintsSection } from "@/components/DemoHintsSection";

describe("demo hints rendering", () => {
  afterEach(() => {
    delete process.env.DEMO_MODE;
  });

  it("renders nothing when DEMO_MODE is off", () => {
    delete process.env.DEMO_MODE;
    const html = renderToStaticMarkup(<DemoHintsSection variant="login" />);
    expect(html).toBe("");
  });

  it("renders hints when DEMO_MODE is on", () => {
    process.env.DEMO_MODE = "true";
    const html = renderToStaticMarkup(<DemoHintsSection variant="login" />);
    expect(html).toContain("Demo Login Hints");
    expect(html).toContain("student1@mcs.edu.lr");
    expect(html).toContain("Password: Password123");
  });
});

describe("seed scripts do not print demo passwords", () => {
  it("prisma/seed.ts contains no password log output", () => {
    const seedPath = path.join(process.cwd(), "prisma", "seed.ts");
    const contents = fs.readFileSync(seedPath, "utf8");
    expect(contents).not.toMatch(/MOE Demo Credentials/i);
    expect(contents).not.toMatch(/Password:\s*Password123/);
  });
});
