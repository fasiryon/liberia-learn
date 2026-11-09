import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.resolve(__dirname, "../../../..");
export default defineConfig({
  root,
  cacheDir: path.resolve(__dirname, "scratch/vite-cache"),
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: ["docs/audits/project-atlas-20261023/post-audit/tests/*.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30000,
    setupFiles: [path.resolve(__dirname, "tests/isolation.ts")],
  },
});
