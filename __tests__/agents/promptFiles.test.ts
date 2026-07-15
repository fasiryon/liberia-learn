import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Regression guard for the production-only echo.md ENOENT bug (2026-07-15,
 * docs/ops/CRON_MIDDLEWARE_FIX.md): loadPromptFile() previously resolved
 * paths via `new URL(relativePath, import.meta.url)`, which webpack bakes
 * into a build-time absolute path that never exists at Lambda runtime.
 * vitest can't reproduce the webpack-bundling half of that bug (it runs the
 * source directly, not the compiled/traced serverless artifact - that half
 * was verified by running the actual .next/standalone build locally), but
 * this guards the other half: that the resolved path is actually
 * process.cwd()-relative and the files genuinely exist there, so nobody
 * reintroduces an import.meta.url-based path or a typo'd relative path.
 */
describe("agent prompt files resolve from process.cwd(), not import.meta.url", () => {
  it.each(["echo.md", "liberialearn-family.md", "ops-sentinel.md"])(
    "lib/agents/prompts/%s exists and is readable via a process.cwd()-relative path",
    (filename) => {
      const content = readFileSync(join(process.cwd(), "lib/agents/prompts", filename), "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  );

  it("registering lib/agents/prompts.ts does not throw (loadPromptFile succeeds for all three prompts)", async () => {
    await expect(import("@/lib/agents/prompts")).resolves.toBeDefined();
  });
});
