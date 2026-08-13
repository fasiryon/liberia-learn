import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { getPrompt } from "@/lib/ai/promptRegistry";
import { lessonDeepV2PromptHash } from "@/lib/ai/prompts/archive/lesson.deep.v2/1.0.0";
import { CURRENT_GOVERNED_PROMPT_VERSIONS } from "@/lib/ai/prompts/currentVersions";

type Manifest = {
  schemaVersion: number;
  entries: Array<{
    key: string;
    version: string;
    path: string;
    fileSha256: string;
    promptSha256: string;
  }>;
};

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(root, "lib/ai/prompts/prompt-manifest.lock.json"), "utf8"),
) as Manifest;

describe("governed prompt archive integrity", () => {
  it("matches every locked archive file hash", () => {
    expect(manifest.schemaVersion).toBe(1);
    const identities = new Set<string>();
    for (const entry of manifest.entries) {
      const identity = `${entry.key}@${entry.version}`;
      expect(identities.has(identity), `duplicate ${identity}`).toBe(false);
      identities.add(identity);
      const body = readFileSync(path.join(root, entry.path));
      expect(createHash("sha256").update(body).digest("hex"), entry.path).toBe(
        entry.fileSha256,
      );
    }
  });

  it("keeps every current governed version archived", () => {
    for (const [key, version] of Object.entries(CURRENT_GOVERNED_PROMPT_VERSIONS)) {
      expect(manifest.entries.some((entry) => entry.key === key && entry.version === version)).toBe(
        true,
      );
    }
  });

  it("retrieves the registered lesson.deep archive by exact version and hash", () => {
    const entry = manifest.entries.find((item) => item.key === "lesson.deep")!;
    expect(getPrompt(entry.key, entry.version).hash).toBe(entry.promptSha256);
  });

  it("binds the multi-call V2 generator to its archived prompt hash", () => {
    const entry = manifest.entries.find((item) => item.key === "lesson.deep.v2")!;
    expect(lessonDeepV2PromptHash).toBe(entry.promptSha256);
  });
});
