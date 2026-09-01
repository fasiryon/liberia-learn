import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const OFFLINE_WILDCARD_FILTERS = new Set([
  "__tests__/offline*.test.ts",
  "__tests__/offline*.test.tsx",
]);

function expandOfflineWildcardArgs(argv: string[]) {
  const offlineTests = fs
    .readdirSync(path.resolve(__dirname, "__tests__"), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^offline.*\.test\.(ts|tsx)$/.test(name))
    .sort()
    .map((name) => `__tests__/${name}`);

  if (offlineTests.length === 0) {
    return;
  }

  for (let index = 0; index < argv.length; index += 1) {
    if (!OFFLINE_WILDCARD_FILTERS.has(argv[index])) continue;
    argv.splice(index, 1, ...offlineTests);
    index += offlineTests.length - 1;
  }
}

expandOfflineWildcardArgs(process.argv);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    maxWorkers: 2,
    // Route-module imports compete for the shared compiler cache in the full
    // suite. Keep behavioral assertions strict while allowing deterministic
    // cold imports to complete on constrained CI workers.
    testTimeout: 60000,
    // Explicit include scopes tests to __tests__/ only, preventing accidental
    // pickup of third-party node_modules test files when running from the
    // parent workspace directory with --config.
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
