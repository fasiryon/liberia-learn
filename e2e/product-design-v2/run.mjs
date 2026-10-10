import { createServer } from "vite";
const server = await createServer({ configFile: "e2e/product-design-v2/vite.config.ts", server: { strictPort: true } });
try { await server.listen(); await import("./validate.mjs"); await import("./validate-learn.mjs"); await import("./validate-classes.mjs"); }
finally { await server.close(); }
