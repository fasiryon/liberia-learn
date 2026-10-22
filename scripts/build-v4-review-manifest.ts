/**
 * Writes the deterministic Interactive Learning V4 review manifest (curriculum/review/v4-candidates/manifest.json).
 * Usage: npx tsx scripts/build-v4-review-manifest.ts. The test __tests__/learning-v4/v4-candidates.test.ts fails if
 * the committed file differs from a rebuild. It reads only committed repository files and writes nothing else.
 */
import { mkdirSync, writeFileSync } from "fs";
import { buildV4ReviewManifest, V4_REVIEW_DIR } from "@/lib/curriculum/v4/candidates";

mkdirSync(V4_REVIEW_DIR, { recursive: true });
writeFileSync(`${V4_REVIEW_DIR}/manifest.json`, JSON.stringify(buildV4ReviewManifest(), null, 2) + "\n");
console.log(`wrote ${V4_REVIEW_DIR}/manifest.json`);
