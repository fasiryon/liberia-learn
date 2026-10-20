import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync, realpathSync } from "node:fs";
export default defineConfig({ root: __dirname, plugins: [react(), { name: "fixture-hub", configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url !== "/artifacts/textbook-v1/hub-after.html") return next(); res.setHeader("Content-Type", "text/html"); res.end(readFileSync(path.resolve(__dirname, "../../artifacts/textbook-v1/hub-after.html"), "utf8")); }); } }], define: { "process.env": "{}" }, resolve: { alias: {
  "@/lib/lesson-offline-cache": path.resolve(__dirname, "../product-design-v2/lessonCacheFixture.ts"), "@": path.resolve(__dirname, "../.."), "next/navigation": path.resolve(__dirname, "navigation.ts"), "next/link": path.resolve(__dirname, "link.tsx"), "next/dynamic": path.resolve(__dirname, "../product-design-v2/dynamic.tsx"),
} }, server: { watch: { ignored: ["**/artifacts/**", "**/.next/**"] }, host: "127.0.0.1", port: 3197, fs: { allow: [path.resolve(__dirname, "../.."), realpathSync(path.resolve(__dirname, "../../node_modules"))] } } });
