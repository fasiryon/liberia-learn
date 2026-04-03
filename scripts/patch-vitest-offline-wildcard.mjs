import fs from "fs";
import path from "path";

const targetPath = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const marker = "liberialearn offline wildcard patch";

const patchedSource = `#!/usr/bin/env node
// ${marker}
import fs from "node:fs";
import path from "node:path";

const OFFLINE_WILDCARD_FILTERS = new Set([
  "__tests__/offline*.test.ts",
  "__tests__/offline*.test.tsx",
]);

function expandOfflineWildcardArgs() {
  const testsDir = path.join(process.cwd(), "__tests__");
  if (!fs.existsSync(testsDir)) {
    return;
  }

  const offlineTests = fs
    .readdirSync(testsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^offline.*\\.test\\.(ts|tsx)$/.test(name))
    .sort()
    .map((name) => path.posix.join("__tests__", name));

  if (offlineTests.length === 0) {
    return;
  }

  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index]?.replace(/\\\\/g, "/");
    if (!OFFLINE_WILDCARD_FILTERS.has(arg)) {
      continue;
    }

    process.argv.splice(index, 1, ...offlineTests);
    index += offlineTests.length - 1;
  }
}

expandOfflineWildcardArgs();
await import("./dist/cli.js");
`;

if (!fs.existsSync(targetPath)) {
  console.warn("[postinstall] Skipping Vitest offline wildcard patch; vitest.mjs not found.");
  process.exit(0);
}

const currentSource = fs.readFileSync(targetPath, "utf8");
if (currentSource.includes(marker)) {
  console.log("[postinstall] Vitest offline wildcard patch already applied.");
  process.exit(0);
}

fs.writeFileSync(targetPath, patchedSource, "utf8");
console.log("[postinstall] Applied Vitest offline wildcard patch.");
