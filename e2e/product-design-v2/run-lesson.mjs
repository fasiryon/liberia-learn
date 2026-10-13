import { createServer } from "vite";
// Lesson Experience V2 runtime browser fixtures only (run.mjs runs every Product Design V2 validator).
const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true } });
try { await server.listen(); await import("./validate-lesson.mjs"); }
finally { await server.close(); }
