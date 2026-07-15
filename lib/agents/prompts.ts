import { readFileSync } from "fs";
import { registerPromptDefinition } from "@/lib/ai/promptRegistry";

/**
 * Agent system prompts are loaded from files (not hardcoded in the agent
 * definition), then registered into the shared promptRegistry. The
 * `new URL(..., import.meta.url)` form lets the bundler trace and emit the .md
 * asset for serverless deploys.
 */
function loadPromptFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
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
