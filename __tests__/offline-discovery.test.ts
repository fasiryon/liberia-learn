import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("offline test discovery", () => {
  it("keeps at least one offline wildcard test discoverable from __tests__/offline*.test.ts", () => {
    const testDir = path.join(process.cwd(), "__tests__");
    const offlineTests = fs
      .readdirSync(testDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /^offline.*\.test\.(ts|tsx)$/.test(name));

    expect(offlineTests.length).toBeGreaterThan(0);
  });
});
