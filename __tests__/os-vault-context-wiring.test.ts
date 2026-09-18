import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

describe("OS vault governed context wiring", () => {
  it("sends the daily automation through exactly one context assembly path", () => {
    const workflowPath = path.join(repositoryRoot, "os-vault", "SYSTEM", "setup", "n8n-workflows", "daily-pulse-workflow.json");
    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
    const assembler = workflow.nodes.filter((node: { name: string }) => node.name === "Assemble Governed Context");
    expect(assembler).toHaveLength(1);
    expect(assembler[0].parameters.command).toContain("daemon/build-context.mjs");
    expect(workflow.connections["Cron Trigger"].main[0]).toEqual([{ node: "Assemble Governed Context" }]);
    expect(workflow.connections["Assemble Governed Context"].main[0]).toEqual([{ node: "Call Claude API" }]);
    expect(JSON.stringify(workflow)).not.toContain("Read CLAUDE.md");
    expect(JSON.stringify(workflow)).not.toContain("Read Workflow Prompt");
  });

  it("uses the same governed assembler for queued jobs", () => {
    const watcher = fs.readFileSync(path.join(repositoryRoot, "os-vault", "daemon", "watcher.mjs"), "utf8");
    expect(watcher).toContain("buildWorkflowContext");
    expect(watcher).toContain("contextRouteForQueueFilename");
    expect(watcher).not.toContain("fs.readFile(SYSTEM_MD");
  });
});
