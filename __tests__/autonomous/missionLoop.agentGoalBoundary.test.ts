// __tests__/autonomous/missionLoop.agentGoalBoundary.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("AgentGoal boundary", () => {
  it("no Manager Loop source file reads AgentGoal.status or queries the AgentGoal model", () => {
    const files = [
      ...collectFiles(join(process.cwd(), "lib/autonomous/missionLoop")),
      ...collectFiles(join(process.cwd(), "scripts/manager-loop")),
    ];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} must not reference AgentGoal`).not.toMatch(/AgentGoal/);
    }
  });
});
