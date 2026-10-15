/** Read-only; no write flag is implemented. Operator must separately authorize hosted reads. */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { analyzeScheduledWorkBackfill, type BackfillMatch } from "../lib/content-bundle/persistence/backfill";
import { createPersistentRepositoryReader } from "../lib/content-bundle/persistence/runtime";

async function main() {
  const args = process.argv.slice(2);
  let matches: BackfillMatch[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--dry-run") continue;
    if (args[index] !== "--matches" || !args[index + 1]) throw new Error("Only --dry-run and --matches <reviewed-local-file> are supported");
    const parsed: unknown = JSON.parse(readFileSync(args[++index], "utf8"));
    if (!Array.isArray(parsed) || parsed.some(match => !match || typeof match !== "object" || typeof match.scheduledWorkId !== "string" || typeof match.schoolId !== "string" || typeof match.contentId !== "string" || !match.ref)) throw new Error("Invalid historical correspondence file");
    matches = parsed;
  }
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Analyzer requires an explicitly configured local/test database");
  const db = new PrismaClient();
  try {
    const rows = await db.scheduledWork.findMany({ include: { class: { select: { schoolId: true, gradeLevel: true, subject: true } } } });
    // No historical correspondence is established by mutable legacy content. No guessing.
    const analysis = await analyzeScheduledWorkBackfill(rows.map(row => ({ ...row, ...row.class })), matches, schoolId => createPersistentRepositoryReader(db, schoolId));
    console.log(JSON.stringify({ mode: "DRY_RUN", writes: 0, counts: Object.fromEntries(["SAFE_TO_PIN", "AMBIGUOUS", "NO_GOVERNED_MATCH", "ALREADY_PINNED", "INVALID_PARTIAL_PIN"].map(status => [status, analysis.filter(row => row.status === status).length])), rows: analysis }, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error("ScheduledWork analysis failed; no writes performed"); process.exitCode = 1; });
