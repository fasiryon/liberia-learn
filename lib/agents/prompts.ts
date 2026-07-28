import { readFileSync } from "fs";
import { join } from "path";
import { registerPromptDefinition } from "@/lib/ai/promptRegistry";

/**
 * Agent system prompts are loaded from files (not hardcoded in the agent
 * definition), then registered into the shared promptRegistry.
 *
 * Resolved against process.cwd(), not `new URL(..., import.meta.url)` -
 * webpack statically bakes import.meta.url into a BUILD-time absolute path
 * (confirmed: locally a Windows file:// path, on Vercel's remote builder
 * `/vercel/path0/...`), which never exists at Lambda RUNTIME (`/var/task`) -
 * this 500'd every agent-platform cron in production
 * (docs/ops/CRON_MIDDLEWARE_FIX.md) regardless of whether the file was
 * correctly included in the deploy bundle (outputFileTracingIncludes in
 * next.config.js is still required for that half - this fixes the other
 * half, the runtime path itself). process.cwd() is the function's actual
 * runtime root on Vercel, matching where output:"standalone" copies traced
 * files to.
 */
function loadPromptFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), "lib/agents", relativePath), "utf8");
}

registerPromptDefinition({
  key: "agent.echo.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/echo.md"),
});

registerPromptDefinition({
  key: "agent.liberialearn-family.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/liberialearn-family.md"),
});

registerPromptDefinition({
  key: "agent.ops-sentinel.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/ops-sentinel.md"),
});

registerPromptDefinition({
  key: "agent.content-qa.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/content-qa.md"),
});

registerPromptDefinition({
  key: "agent.moe-narrative-report.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/moe-narrative-report.md"),
});

registerPromptDefinition({
  key: "agent.district-update.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/district-update.md"),
});

registerPromptDefinition({
  key: "agent.teaching-runtime.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/teaching-runtime.md"),
});

registerPromptDefinition({
  key: "agent.morning-brief.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/morning-brief.md"),
});
