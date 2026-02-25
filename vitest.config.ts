import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    maxWorkers: 2,
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
