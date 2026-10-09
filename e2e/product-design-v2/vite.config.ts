import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { realpathSync } from "node:fs";
export default defineConfig({ root: __dirname, plugins: [react()], resolve: { alias: {
  "@": path.resolve(__dirname, "../.."), "next/navigation": path.resolve(__dirname, "navigation.ts"), "next/link": path.resolve(__dirname, "link.tsx"), "next/dynamic": path.resolve(__dirname, "dynamic.tsx"),
} }, server: { host: "127.0.0.1", port: 3191, fs: { allow: [path.resolve(__dirname, "../.."), realpathSync(path.resolve(__dirname, "../../node_modules"))] } } });
