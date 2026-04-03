// prisma/seeds/legacy-smoke-accounts.ts
// Deprecated compatibility seed. Prefer prisma/seeds/cha-demo.ts.
// This file preserves an old entrypoint while enforcing the canonical CHA/MOE demo accounts.

import { seedChaDemo } from "./cha-demo";

async function main() {
  console.warn("[deprecated] legacy smoke accounts now map to the canonical CHA/MOE demo accounts");
  await seedChaDemo();
}

main()
  .catch((e) => {
    console.error("FAIL:", e?.message ?? e);
    process.exit(1);
  });
