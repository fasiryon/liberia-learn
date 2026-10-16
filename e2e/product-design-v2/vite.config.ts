import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { realpathSync } from "node:fs";
// Next inlines NEXT_PUBLIC_* at build time; the harness has no env, so client reads see undefined flags.
// HARNESS_PORT / HARNESS_CACHE_DIR let two worktrees run the harness at once (defaults unchanged).
export default defineConfig({ root: __dirname, ...(process.env.HARNESS_CACHE_DIR ? { cacheDir: process.env.HARNESS_CACHE_DIR } : {}), plugins: [react()], define: { "process.env": "{}" }, resolve: { alias: {
  "@/lib/lesson-offline-cache": path.resolve(__dirname, "lessonCacheFixture.ts"), "@": path.resolve(__dirname, "../.."), "next/navigation": path.resolve(__dirname, "navigation.ts"), "next/link": path.resolve(__dirname, "link.tsx"), "next/dynamic": path.resolve(__dirname, "dynamic.tsx"),
} }, server: { host: "127.0.0.1", port: Number(process.env.HARNESS_PORT ?? 3191), fs: { allow: [path.resolve(__dirname, "../.."), realpathSync(path.resolve(__dirname, "../../node_modules"))] } } });
