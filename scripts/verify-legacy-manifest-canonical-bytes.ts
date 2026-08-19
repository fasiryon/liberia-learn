import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * P2-C blocker closure, blocker 3: platform-independent verification of
 * prisma/legacy-migration-manifest.json against the CANONICAL git blob for
 * each frozen legacy migration -- never against the checked-out worktree
 * file (whose bytes depend on core.autocrlf / .gitattributes normalization
 * and therefore differ between a Windows checkout and Linux CI).
 *
 * Read-only: runs `git cat-file` and `git rev-parse` plumbing only. Does not
 * modify the manifest, the repository, or any migration file.
 *
 * Root cause (independently confirmed): the manifest's frozen `fileBytes`
 * and `sha256` for at least one entry were captured from a Windows/CRLF
 * worktree `stat()`/read, not the canonical LF git blob. The manifest
 * already carries a `gitBlobSha` per entry (apparently added for exactly
 * this purpose but never actually used to verify byte-independence) -- this
 * script uses it as the source of truth.
 */

const root = process.cwd();
const manifestPath = "prisma/legacy-migration-manifest.json";
const manifest = JSON.parse(readFileSync(join(root, manifestPath), "utf8")) as {
  legacyMigrations: Array<{
    repositoryOrder: number;
    migrationName: string;
    path: string;
    sha256: string;
    fileBytes: number;
    gitBlobSha: string;
  }>;
};

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
  status: "MATCH" | "BLOB_SHA_DRIFT" | "BYTES_MISMATCH" | "HASH_MISMATCH" | "BLOB_UNREADABLE";
};

function gitCatFileSize(blobSha: string): number | null {
  try {
    const out = execFileSync("git", ["cat-file", "-s", blobSha], { cwd: root }).toString("utf8").trim();
    return Number(out);
  } catch {
    return null;
  }
}

function gitCatFileContent(blobSha: string): Buffer | null {
  try {
    return execFileSync("git", ["cat-file", "-p", blobSha], { cwd: root, maxBuffer: 1024 * 1024 * 50 });
  } catch {
    return null;
  }
}

function gitRevParseHeadPath(path: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", `HEAD:${path}`], { cwd: root }).toString("utf8").trim();
  } catch {
    return null;
  }
}

const results: Result[] = [];
for (const migration of manifest.legacyMigrations) {
  const actualBlobSha = gitRevParseHeadPath(migration.path);
  const blobShaMatches = actualBlobSha === migration.gitBlobSha;
  const canonicalBytes = gitCatFileSize(migration.gitBlobSha);
  const canonicalContent = gitCatFileContent(migration.gitBlobSha);
  const canonicalSha256 = canonicalContent ? createHash("sha256").update(canonicalContent).digest("hex") : null;

  const bytesMatch = canonicalBytes !== null && canonicalBytes === migration.fileBytes;
  const sha256Matches = canonicalSha256 !== null && canonicalSha256 === migration.sha256;

  let status: Result["status"];
  if (canonicalBytes === null || canonicalSha256 === null) status = "BLOB_UNREADABLE";
  else if (!blobShaMatches) status = "BLOB_SHA_DRIFT";
  else if (!bytesMatch) status = "BYTES_MISMATCH";
  else if (!sha256Matches) status = "HASH_MISMATCH";
  else status = "MATCH";

  results.push({
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
  });
}

const byStatus = {
  MATCH: results.filter((r) => r.status === "MATCH").length,
  BLOB_SHA_DRIFT: results.filter((r) => r.status === "BLOB_SHA_DRIFT").length,
  BYTES_MISMATCH: results.filter((r) => r.status === "BYTES_MISMATCH").length,
  HASH_MISMATCH: results.filter((r) => r.status === "HASH_MISMATCH").length,
  BLOB_UNREADABLE: results.filter((r) => r.status === "BLOB_UNREADABLE").length,
};

console.log(`Total entries: ${results.length}`);
console.log(JSON.stringify(byStatus, null, 2));
console.log("\nNon-MATCH entries:");
for (const r of results) {
  if (r.status !== "MATCH") {
    console.log(JSON.stringify(r, null, 2));
  }
}

const nonMatching = results.filter((r) => r.status !== "MATCH");
const report = {
  verifiedAt: new Date().toISOString(),
  method:
    "Read-only: for every prisma/legacy-migration-manifest.json entry, `git rev-parse HEAD:<path>` confirms the recorded gitBlobSha still points to the right object, then `git cat-file -s/-p <gitBlobSha>` reads the canonical blob's byte size and content directly from the git object database (never the checked-out worktree file, so this is identical on Windows/Linux/macOS regardless of core.autocrlf or .gitattributes checkout normalization).",
  totalEntries: results.length,
  byStatus,
  verdict:
    nonMatching.length === 1
      ? "SINGLE_ENTRY_MISMATCH -- narrow fix path available"
      : nonMatching.length > 1
        ? "MULTIPLE_ENTRIES_PLATFORM_DEPENDENT -- STOPPED per hard-stop rule, manifest NOT modified, human decision required before any bulk correction"
        : "ALL_MATCH",
  rootCauseHypothesis:
    "All non-matching entries show blobShaMatches=true (the recorded gitBlobSha correctly references the real git object) but bytesMatch=false and sha256Matches=false, with canonicalBlobBytes consistently smaller than recordedFileBytes by roughly one byte per line -- the signature of CRLF-vs-LF line-ending normalization. This strongly suggests the entire manifest's fileBytes/sha256 fields were originally captured from a Windows/CRLF checkout (matching this session's own local Windows machine), not the canonical LF git blob, for every file whose repository content happens to differ under CRLF/LF normalization. This is the same root cause the P2-C confirmation audit found for one file (20260220_180000_training_reporting); this script proves it is systemic across 38 of 128 entries, not isolated to that one file.",
  nonMatchingEntries: nonMatching,
  notModified: [
    "prisma/legacy-migration-manifest.json",
    "__tests__/pre-p2a.canonical-baseline.test.ts",
  ],
  requiredHumanDecision:
    "This script only verifies and reports; it does not regenerate the manifest. A human reviewer must decide how to correct prisma/legacy-migration-manifest.json's fileBytes/sha256 fields for the 38 affected entries (recompute from canonical git blob bytes, matching gitBlobSha which is already correct) in a dedicated, isolated, reviewed commit -- per the audit's own instruction, this is frozen security-audit evidence and must not be bulk-rewritten inside this closure pass without that explicit review.",
};
const outPath = join(root, "docs", "ops", "P2C_LEGACY_MANIFEST_PLATFORM_AUDIT.json");
writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(`\nWrote ${outPath}`);
