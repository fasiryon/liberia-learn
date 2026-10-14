import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { realpathSync } from "node:fs";

/** `virtual:g4-activity-models`: display models built in Node by models.server.ts (the fixture needs node:crypto). */
function previewModels(): Plugin {
  let server: ViteDevServer;
  return {
    name: "g4-activity-models",
    configureServer(s) { server = s; },
    resolveId(id) { return id === "virtual:g4-activity-models" ? "\0g4-activity-models" : undefined; },
    async load(id) {
      if (id !== "\0g4-activity-models") return undefined;
      const mod = await server.ssrLoadModule(path.resolve(__dirname, "models.server.ts"));
      return `export default ${JSON.stringify(await mod.buildHarnessModels())};`;
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), previewModels()],
  define: { "process.env": "{}" },
  resolve: { alias: { "@": path.resolve(__dirname, "../..") } },
  server: { host: "127.0.0.1", port: 3193, fs: { allow: [path.resolve(__dirname, "../.."), realpathSync(path.resolve(__dirname, "../../node_modules"))] } },
});
