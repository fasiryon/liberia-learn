/**
 * Deprecated compatibility wrapper for the old demo-school seed entrypoint.
 * Use `prisma/seeds/cha-demo.ts` for the canonical demo identity system.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { seedChaDemo } from "../prisma/seeds/cha-demo";

async function main() {
  console.warn("[deprecated] scripts/seed-demo-monrovia.mjs now delegates to prisma/seeds/cha-demo.ts");
  await seedChaDemo();
}

main().catch((e) => {
  console.error("SEED FAILED:", e?.message ?? e);
  process.exit(1);
});
