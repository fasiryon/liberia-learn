import { readFileSync, readdirSync, statSync } from "fs";
import { relative, resolve } from "path";

const ROOTS = ["app", "lib", "worker", "scripts"];
const APPROVED_BOUNDARY = "lib/curriculum/mutations/repository.ts";
const EXCEPTIONS: Record<string, { owner: string; reason: string; environment: string; expiry: string }> = {
  "scripts/seed-demo.ts": {
    owner: "platform-engineering",
    reason: "development-only seed data",
    environment: "development",
    expiry: "2026-12-31",
  },
  "scripts/wave4fix-repro-create.ts": {
    owner: "platform-engineering",
    reason: "local reproduction fixture",
    environment: "development",
    expiry: "2026-09-30",
  },
  "scripts/wave4fix-cleanup-orphan.ts": {
    owner: "platform-engineering",
    reason: "local reproduction cleanup",
    environment: "development",
    expiry: "2026-09-30",
  },
  "scripts/live-verify-asset-pipeline.ts": {
    owner: "platform-engineering",
    reason: "ephemeral staging asset-pipeline fixture",
    environment: "staging-test",
    expiry: "2026-09-30",
  },
};

const directMutation = /\bcurriculumContent\s*\.\s*(?:create|update|updateMany|upsert|delete|deleteMany)\s*\(/g;
const rawMutation = /(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+["'`]?CurriculumContent(?!Revision)["'`]?/gi;

export function containsUnauthorizedCurriculumMutation(source: string): boolean {
  directMutation.lastIndex = 0;
  rawMutation.lastIndex = 0;
  return directMutation.test(source) || rawMutation.test(source);
}

function files(directory: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const info = statSync(path);
    if (info.isDirectory()) output.push(...files(path));
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry)) output.push(path);
  }
  return output;
}

export function findUnauthorizedCurriculumWriters(now = new Date()): string[] {
  const violations: string[] = [];
  for (const root of ROOTS) {
    for (const absolute of files(resolve(root))) {
      const path = relative(process.cwd(), absolute).replace(/\\/g, "/");
      if (path === APPROVED_BOUNDARY || path === "scripts/p2a-writer-guard.ts") continue;
      const exception = EXCEPTIONS[path];
      if (exception && new Date(`${exception.expiry}T23:59:59.999Z`) >= now) continue;
      const source = readFileSync(absolute, "utf8");
      if (containsUnauthorizedCurriculumMutation(source)) violations.push(path);
    }
  }
  return violations.sort();
}

if (require.main === module) {
  const violations = findUnauthorizedCurriculumWriters();
  if (violations.length) {
    console.error(`Unauthorized CurriculumContent writers:\n${violations.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("P2-A curriculum writer architecture guard: PASS");
  }
}
