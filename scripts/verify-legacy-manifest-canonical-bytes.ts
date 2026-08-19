import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  actualBlobShaForPath,
  canonicalBlobSha256,
  canonicalBlobSize,
} from "./lib/canonicalMigrationBytes";

/**
 * P2-C infrastructure closure: the supported, platform-independent verifier
 * (and, only with an explicit flag, corrector) for
 * prisma/legacy-migration-manifest.json against the CANONICAL git blob for
 * each frozen legacy migration -- never against the checked-out worktree
 * file (whose bytes depend on core.autocrlf / .gitattributes normalization
 * and therefore differ between a Windows checkout and Linux CI).
 *
 * Default mode (--verify, or no flag) is READ-ONLY: runs `git cat-file` and
 * `git rev-parse` plumbing only, writes only the audit report, never
 * touches the manifest. CI must always invoke this in verify mode.
 *
 * --write-platform-normalization-fixes additionally rewrites ONLY entries
 * classified PLATFORM_NORMALIZATION_MISMATCH (a correct gitBlobSha, but
 * fileBytes/sha256 captured from a CRLF worktree instead of the canonical
 * LF blob) to their canonical values. It refuses to run unless the full
 * 128-entry precheck comes back as EXACTLY 90 MATCH / 38
 * PLATFORM_NORMALIZATION_MISMATCH / 0 of every other category -- any
 * deviation (an unexplained hash mismatch, a blob-SHA drift, an unreadable
 * blob) aborts without writing anything. It never modifies migration SQL,
 * timestamps, identity, ordering, or any field other than fileBytes/sha256
 * on the affected entries, and it produces a before/after review artifact
 * for every entry it touches.
 */

const root = process.cwd();
const manifestPath = "prisma/legacy-migration-manifest.json";
const manifestRaw = readFileSync(join(root, manifestPath), "utf8");
const manifest = JSON.parse(manifestRaw) as {
  legacyMigrations: Array<{
    repositoryOrder: number;
    migrationName: string;
    path: string;
    sha256: string;
    fileBytes: number;
    gitBlobSha: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type Status =
  | "MATCH"
  | "BLOB_SHA_DRIFT"
  | "PLATFORM_NORMALIZATION_MISMATCH"
  | "OTHER_HASH_MISMATCH"
  | "BLOB_UNREADABLE";

type Result = {
  migrationName: string;
  path: string;
  gitBlobShaRecorded: string;
  gitBlobShaActual: string | null;
  blobShaMatches: boolean;
  recordedFileBytes: number;
  canonicalBlobBytes: number | null;
  bytesMatch: boolean;
  recordedSha256: string;
  canonicalBlobSha256: string | null;
  sha256Matches: boolean;
  status: Status;
};

function safeSize(blobSha: string): number | null {
  try {
    return canonicalBlobSize(blobSha, root);
  } catch {
    return null;
  }
}
function safeSha256(blobSha: string): string | null {
  try {
    return canonicalBlobSha256(blobSha, root);
  } catch {
    return null;
  }
}
function safeActualBlobSha(path: string): string | null {
  try {
    return actualBlobShaForPath(path, root);
  } catch {
    return null;
  }
}

function classify(migration: (typeof manifest.legacyMigrations)[number]): Result {
  const actualBlobSha = safeActualBlobSha(migration.path);
  const blobShaMatches = actualBlobSha === migration.gitBlobSha;
  const canonicalBytes = safeSize(migration.gitBlobSha);
  const canonicalSha256 = safeSha256(migration.gitBlobSha);

  const bytesMatch = canonicalBytes !== null && canonicalBytes === migration.fileBytes;
  const sha256Matches = canonicalSha256 !== null && canonicalSha256 === migration.sha256;

  let status: Status;
  if (canonicalBytes === null || canonicalSha256 === null) status = "BLOB_UNREADABLE";
  else if (!blobShaMatches) status = "BLOB_SHA_DRIFT";
  else if (!bytesMatch || !sha256Matches) {
    // A CRLF-captured record differs in BOTH fields together (worktree
    // stat() adds a byte per line ending, and the sha256 is over the whole
    // buffer, so it changes too). If only ONE of the two differs, that is
    // not the known normalization signature and needs its own explanation.
    status = !bytesMatch && !sha256Matches ? "PLATFORM_NORMALIZATION_MISMATCH" : "OTHER_HASH_MISMATCH";
  } else status = "MATCH";

  return {
    migrationName: migration.migrationName,
    path: migration.path,
    gitBlobShaRecorded: migration.gitBlobSha,
    gitBlobShaActual: actualBlobSha,
    blobShaMatches,
    recordedFileBytes: migration.fileBytes,
    canonicalBlobBytes: canonicalBytes,
    bytesMatch,
    recordedSha256: migration.sha256,
    canonicalBlobSha256: canonicalSha256,
    sha256Matches,
    status,
  };
}

function runPrecheck(): { results: Result[]; byStatus: Record<Status, number> } {
  const results = manifest.legacyMigrations.map(classify);
  const byStatus: Record<Status, number> = {
    MATCH: results.filter((r) => r.status === "MATCH").length,
    BLOB_SHA_DRIFT: results.filter((r) => r.status === "BLOB_SHA_DRIFT").length,
    PLATFORM_NORMALIZATION_MISMATCH: results.filter((r) => r.status === "PLATFORM_NORMALIZATION_MISMATCH").length,
    OTHER_HASH_MISMATCH: results.filter((r) => r.status === "OTHER_HASH_MISMATCH").length,
    BLOB_UNREADABLE: results.filter((r) => r.status === "BLOB_UNREADABLE").length,
  };
  return { results, byStatus };
}

function writeAuditReport(results: Result[], byStatus: Record<Status, number>) {
  const nonMatching = results.filter((r) => r.status !== "MATCH");
  const report = {
    verifiedAt: new Date().toISOString(),
    method:
      "Read-only: for every prisma/legacy-migration-manifest.json entry, `git rev-parse HEAD:<path>` confirms the recorded gitBlobSha still points to the right object, then `git cat-file -s/-p <gitBlobSha>` (scripts/lib/canonicalMigrationBytes.ts) reads the canonical blob's byte size and content directly from the git object database (never the checked-out worktree file, so this is identical on Windows/Linux/macOS regardless of core.autocrlf or .gitattributes checkout normalization).",
    totalEntries: results.length,
    byStatus,
    verdict:
      byStatus.PLATFORM_NORMALIZATION_MISMATCH + byStatus.BLOB_SHA_DRIFT + byStatus.OTHER_HASH_MISMATCH + byStatus.BLOB_UNREADABLE === 0
        ? "ALL_MATCH"
        : "PLATFORM_NORMALIZATION_MISMATCHES_PRESENT",
    rootCauseHypothesis:
      "PLATFORM_NORMALIZATION_MISMATCH entries all show blobShaMatches=true (the recorded gitBlobSha correctly references the real git object) but both bytesMatch=false and sha256Matches=false together, with canonicalBlobBytes consistently smaller than recordedFileBytes -- the signature of CRLF-vs-LF line-ending normalization. The manifest's fileBytes/sha256 fields for these entries were captured from a Windows/CRLF checkout, not the canonical LF git blob.",
    nonMatchingEntries: nonMatching,
  };
  const outPath = join(root, "docs", "ops", "P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return outPath;
}

function main() {
  const args = process.argv.slice(2);
  const writeMode = args.includes("--write-platform-normalization-fixes");

  const { results, byStatus } = runPrecheck();
  console.log(`Total entries: ${results.length}`);
  console.log(JSON.stringify(byStatus, null, 2));
  console.log("\nNon-MATCH entries:");
  for (const r of results) {
    if (r.status !== "MATCH") console.log(JSON.stringify(r, null, 2));
  }
  const outPath = writeAuditReport(results, byStatus);
  console.log(`\nWrote ${outPath}`);

  if (!writeMode) {
    console.log("\nVerify-only mode (default). Pass --write-platform-normalization-fixes to correct the 38 known entries.");
    return;
  }

  // --- Hard-stop precheck before any write ---
  const expected = { MATCH: 90, PLATFORM_NORMALIZATION_MISMATCH: 38, BLOB_SHA_DRIFT: 0, OTHER_HASH_MISMATCH: 0, BLOB_UNREADABLE: 0 };
  const matchesExpected =
    byStatus.MATCH === expected.MATCH &&
    byStatus.PLATFORM_NORMALIZATION_MISMATCH === expected.PLATFORM_NORMALIZATION_MISMATCH &&
    byStatus.BLOB_SHA_DRIFT === expected.BLOB_SHA_DRIFT &&
    byStatus.OTHER_HASH_MISMATCH === expected.OTHER_HASH_MISMATCH &&
    byStatus.BLOB_UNREADABLE === expected.BLOB_UNREADABLE;

  if (!matchesExpected) {
    console.error("\nHARD STOP: precheck counts do not exactly match the authorized 90/38/0/0/0. Refusing to write.");
    console.error("Expected:", expected);
    console.error("Actual:  ", byStatus);
    process.exitCode = 1;
    return;
  }
  console.log("\nPrecheck confirmed exactly 90 MATCH / 38 PLATFORM_NORMALIZATION_MISMATCH / 0 other categories. Proceeding to write.");

  const toFix = results.filter((r) => r.status === "PLATFORM_NORMALIZATION_MISMATCH");
  const reviewEntries = toFix.map((r) => ({
    migrationPath: r.path,
    migrationName: r.migrationName,
    oldFileBytes: r.recordedFileBytes,
    canonicalFileBytes: r.canonicalBlobBytes,
    oldSha256: r.recordedSha256,
    canonicalSha256: r.canonicalBlobSha256,
    gitBlobSha: r.gitBlobShaRecorded,
    classification: "PLATFORM_NORMALIZATION_CORRECTION" as const,
  }));

  // Mutate the same in-memory `manifest` object the precheck/classify()
  // logic reads from (not a fresh re-parse), so the post-write recheck
  // below actually observes the change instead of re-reading stale data.
  const byName = new Map(manifest.legacyMigrations.map((m) => [m.migrationName, m]));
  for (const fix of reviewEntries) {
    const entry = byName.get(fix.migrationName);
    if (!entry) throw new Error(`Migration ${fix.migrationName} not found in manifest during write -- aborting`);
    if (entry.fileBytes !== fix.oldFileBytes || entry.sha256 !== fix.oldSha256) {
      throw new Error(`Manifest entry for ${fix.migrationName} changed since precheck -- aborting`);
    }
    entry.fileBytes = fix.canonicalFileBytes as number;
    entry.sha256 = fix.canonicalSha256 as string;
    // migration path, name, gitBlobSha, ordering, and all other fields are
    // deliberately left untouched -- only the two byte-derived evidence
    // fields change.
  }

  writeFileSync(join(root, manifestPath), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`\nRewrote ${reviewEntries.length} entries in ${manifestPath} to canonical git-blob values.`);

  const reviewPath = join(root, "docs", "ops", "P2C_LEGACY_MANIFEST_PLATFORM_NORMALIZATION_FIXES.json");
  writeFileSync(
    reviewPath,
    JSON.stringify(
      {
        appliedAt: new Date().toISOString(),
        entriesChanged: reviewEntries.length,
        fieldsChanged: ["fileBytes", "sha256"],
        fieldsNotChanged: ["migration SQL content", "migrationName", "path", "gitBlobSha", "repositoryOrder", "production", "encoding"],
        entries: reviewEntries,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`Wrote review artifact: ${reviewPath}`);

  // --- Post-write re-verify: everything should now be MATCH ---
  const post = runPrecheck();
  console.log("\nPost-write recheck:", JSON.stringify(post.byStatus, null, 2));
  writeAuditReport(post.results, post.byStatus);
  if (post.byStatus.MATCH !== manifest.legacyMigrations.length) {
    console.error("POST-WRITE VERIFICATION FAILED: not all entries are MATCH after the fix.");
    process.exitCode = 1;
  } else {
    console.log("\nAll 128 entries now MATCH canonical git blob bytes/hashes.");
  }
}

main();
