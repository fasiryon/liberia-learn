// prisma/seeds/demo-school.ts
// Deprecated compatibility seed. Prefer prisma/seeds/cha-demo.ts.
// This file now seeds only the canonical CHA/MOE demo identity system.

import { seedChaDemo } from "./cha-demo";

async function main() {
  console.warn("[deprecated] prisma/seeds/demo-school.ts now delegates to prisma/seeds/cha-demo.ts");
  await seedChaDemo();
}

main().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});
