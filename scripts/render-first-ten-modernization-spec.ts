// Renders docs/curriculum/modernization/FIRST_TEN_MODERNIZATION_SPEC_V1.md from first-ten/spec.json.
// --check exits non-zero when the committed document is stale. No database, no ledger writes.
import { readFileSync, writeFileSync } from "fs";
import { FIRST_TEN_SPEC_DOC, FIRST_TEN_SPEC_FILE, renderFirstTenSpec, type FirstTenSpec } from "@/lib/curriculum/modernization/firstTen";

const rendered = renderFirstTenSpec(JSON.parse(readFileSync(FIRST_TEN_SPEC_FILE, "utf8")) as FirstTenSpec);
if (process.argv.includes("--check")) {
  const current = readFileSync(FIRST_TEN_SPEC_DOC, "utf8");
  if (current !== rendered) {
    console.error(`${FIRST_TEN_SPEC_DOC} is stale; run npx tsx scripts/render-first-ten-modernization-spec.ts`);
    process.exit(1);
  }
  console.log(`${FIRST_TEN_SPEC_DOC} is current`);
} else {
  writeFileSync(FIRST_TEN_SPEC_DOC, rendered);
  console.log(`wrote ${FIRST_TEN_SPEC_DOC}`);
}
