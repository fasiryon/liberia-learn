import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Platform-independent access to a file's canonical (as-committed) bytes,
 * via `git cat-file` against a git blob SHA -- never the checked-out
 * worktree file, so results are identical on Windows, Linux, and macOS
 * regardless of core.autocrlf or .gitattributes checkout normalization.
 *
 * Shared by scripts/verify-legacy-manifest-canonical-bytes.ts and
 * __tests__/pre-p2a.canonical-baseline.test.ts so both use exactly the same
 * canonicalization mechanism.
 */

export function canonicalBlobSize(gitBlobSha: string, cwd: string = process.cwd()): number {
  const out = execFileSync("git", ["cat-file", "-s", gitBlobSha], { cwd }).toString("utf8").trim();
  return Number(out);
}

export function canonicalBlobContent(gitBlobSha: string, cwd: string = process.cwd()): Buffer {
  return execFileSync("git", ["cat-file", "-p", gitBlobSha], { cwd, maxBuffer: 1024 * 1024 * 50 });
}

export function canonicalBlobSha256(gitBlobSha: string, cwd: string = process.cwd()): string {
  return createHash("sha256").update(canonicalBlobContent(gitBlobSha, cwd)).digest("hex");
}

export function actualBlobShaForPath(path: string, cwd: string = process.cwd()): string {
  return execFileSync("git", ["rev-parse", `HEAD:${path}`], { cwd }).toString("utf8").trim();
}

/**
 * Reads many blobs' canonical size + sha256 in a single `git cat-file
 * --batch` subprocess instead of one subprocess per blob -- spawning a
 * process per file (2 per migration: size + content) is slow enough to
 * time out a test suite once there are 100+ entries. `--batch` accepts one
 * object id per line on stdin and, for each, writes a text header line
 * (`<sha> <type> <size>\n`) followed by exactly <size> content bytes and a
 * trailing newline, so the response stream is parsed by walking those
 * lengths rather than splitting on newlines (migration SQL can itself
 * legitimately contain any byte, including newlines).
 */
export function canonicalBlobsBatch(
  gitBlobShas: string[],
  cwd: string = process.cwd()
): Map<string, { size: number; sha256: string }> {
  const result = new Map<string, { size: number; sha256: string }>();
  if (gitBlobShas.length === 0) return result;

  const proc = spawnSync("git", ["cat-file", "--batch"], {
    cwd,
    input: gitBlobShas.join("\n") + "\n",
    maxBuffer: 1024 * 1024 * 256,
  });
  if (proc.error) throw proc.error;
  if (proc.status !== 0) {
    throw new Error(`git cat-file --batch exited ${proc.status}: ${proc.stderr?.toString("utf8")}`);
  }

  const out: Buffer = proc.stdout;
  let offset = 0;
  while (offset < out.length) {
    const newlineIndex = out.indexOf(0x0a, offset);
    if (newlineIndex === -1) break;
    const header = out.subarray(offset, newlineIndex).toString("utf8");
    offset = newlineIndex + 1;

    const parts = header.split(" ");
    if (parts.length < 3) {
      // "<sha> missing" -- no content bytes follow for this entry.
      continue;
    }
    const [sha, , sizeStr] = parts;
    const size = Number(sizeStr);
    const content = out.subarray(offset, offset + size);
    offset += size + 1; // skip the trailing newline after the content

    result.set(sha, { size, sha256: createHash("sha256").update(content).digest("hex") });
  }
  return result;
}
