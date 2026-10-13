import { createServer } from "vite";
const server = await createServer({ configFile: "e2e/g4-fractions-activities/vite.config.ts", server: { strictPort: true } });
try { await server.listen(); await import("./validate.mjs"); }
finally { await server.close(); }
