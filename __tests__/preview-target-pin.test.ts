/**
 * Phase 2 protected-PR scrub (founder "scrub, then squash", COS-PHASE2-PR-SCRUB-WORK-ORDER-20261108): the real Preview
 * Supabase project reference is not public and must not enter the repository. The preview database guard keeps an
 * exact pin, but from runtime configuration that fails closed:
 *  - PREVIEW_PINNED_PROJECT_REF (execution environment, separate from the operator credentials file) must be a
 *    well-formed 20-letter reference and never the Production reference; missing or malformed refuses;
 *  - the target's PREVIEW_SUPABASE_PROJECT_REF must equal the pin, and the URLs must belong to that project;
 *  - the database preflight accepts a policy only for the validated target's own reference.
 * A repository scan keeps the real reference out of tracked files by its SHA-256 only (the value never appears here).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as target from "@/scripts/preview/preview-target.mjs";

const REAL_PREVIEW_REF_SHA256 = "d756fd4381376ccc8ece35910a08233c4730ba49115b7d02d3b4616fd40a74cc";
const REF = "previewsyntheticrefz"; // 20 lowercase letters, synthetic
const OTHER = "othersyntheticrefzzz";
const PASSWORD = "synthetic-preview-password-long";
const url = (ref: string, port: string) => `postgresql://preview_app.${ref}:${PASSWORD}@aws-0-us-east-2.pooler.supabase.com:${port}/postgres?sslmode=require${port === "6543" ? "&pgbouncer=true" : ""}`;
const env = (over: Record<string, string | undefined> = {}) => ({
  SYNTHETIC_PREVIEW_SEED: "1", PREVIEW_PINNED_PROJECT_REF: REF, PREVIEW_SUPABASE_PROJECT_REF: REF, PREVIEW_DB_ROLE: "preview_app",
  PREVIEW_DB_PASSWORD: PASSWORD, DATABASE_URL: url(REF, "6543"), DIRECT_URL: url(REF, "5432"), ...over,
});

describe("preview target pin comes from runtime configuration and fails closed", () => {
  it("no hard-coded Preview project reference is exported", () => {
    expect((target as Record<string, unknown>).PREVIEW_PROJECT_REF).toBeUndefined();
  });
  it("accepts a target whose reference equals a well-formed pin", () => {
    expect(target.validatePreviewTarget(env()).projectRef).toBe(REF);
  });
  it.each([
    ["missing pin", { PREVIEW_PINNED_PROJECT_REF: undefined }],
    ["malformed pin", { PREVIEW_PINNED_PROJECT_REF: "Not-A-Ref" }],
    ["pin is the Production reference", { PREVIEW_PINNED_PROJECT_REF: target.PRODUCTION_PROJECT_REF, PREVIEW_SUPABASE_PROJECT_REF: target.PRODUCTION_PROJECT_REF }],
    ["target differs from the pin", { PREVIEW_SUPABASE_PROJECT_REF: OTHER, DATABASE_URL: url(OTHER, "6543"), DIRECT_URL: url(OTHER, "5432") }],
    ["URLs belong to another project", { DATABASE_URL: url(OTHER, "6543") }],
  ])("refuses: %s", (_l, over) => {
    expect(() => target.validatePreviewTarget(env(over as Record<string, string | undefined>))).toThrow("preview_database_target_refused");
  });
  it("the operator environment takes the pin from the execution environment, not the credentials file", () => {
    const fromFile = { DATABASE_URL: url(REF, "6543"), DIRECT_URL: url(REF, "5432"), PREVIEW_SUPABASE_PROJECT_REF: REF, PREVIEW_DB_ROLE: "preview_app", PREVIEW_DB_PASSWORD: PASSWORD, PREVIEW_PINNED_PROJECT_REF: OTHER };
    // A deliberately minimal execution environment (only the pin), not process.env: the runner's real CI/VERCEL values
    // must not leak into the case. ProcessEnv requires NODE_ENV, so the narrow literal is widened through unknown.
    const executionEnv = { PREVIEW_PINNED_PROJECT_REF: REF } as unknown as NodeJS.ProcessEnv;
    const operator = target.previewOperatorEnvironment(fromFile, executionEnv);
    expect(operator.PREVIEW_PINNED_PROJECT_REF).toBe(REF);
    expect(target.validatePreviewTarget(operator).projectRef).toBe(REF);
  });
  it("the policy template carries no project reference", () => {
    expect(JSON.parse(readFileSync("scripts/preview/database-policy.template.json", "utf8")).projectRef).toBeNull();
  });
});

// Reviewer P2(b): call the pin check directly, so a refusal is attributable to the pin itself (not a later URL check).
describe("pinnedPreviewProjectRef fails closed on its own", () => {
  it.each([
    ["missing", undefined], ["empty", ""], ["19 letters", "previewsyntheticref"], ["21 letters", "previewsyntheticrefzz"],
    ["upper-case", "PREVIEWSYNTHETICREFZ"], ["digits", "previewsyntheticref1"], ["Production", target.PRODUCTION_PROJECT_REF],
  ])("refuses a %s pin", (_l, pin) => {
    expect(() => target.pinnedPreviewProjectRef({ PREVIEW_PINNED_PROJECT_REF: pin } as unknown as NodeJS.ProcessEnv)).toThrow("preview_database_target_refused");
  });
  it("returns a well-formed non-Production pin unchanged", () => {
    expect(target.pinnedPreviewProjectRef({ PREVIEW_PINNED_PROJECT_REF: REF } as unknown as NodeJS.ProcessEnv)).toBe(REF);
  });
});

/**
 * Reviewer P2(c): every 20-letter sliding window, case-insensitive. A chunked /[a-z]{20}/g match misses a reference
 * embedded in a longer lower-case run or written in mixed case.
 */
function containsRefHash(text: string, sha256: string): boolean {
  for (const run of text.toLowerCase().match(/[a-z]{20,}/g) ?? []) {
    const seen = new Set<string>();
    for (let i = 0; i + 20 <= run.length; i++) {
      const window = run.slice(i, i + 20);
      if (seen.has(window)) continue;
      seen.add(window);
      if (createHash("sha256").update(window).digest("hex") === sha256) return true;
    }
  }
  return false;
}
const chunked = (text: string, sha256: string) => [...new Set(text.match(/[a-z]{20}/g) ?? [])].some((t) => createHash("sha256").update(t).digest("hex") === sha256);

describe("the real Preview reference is absent from every tracked file", () => {
  it("the scanner finds a reference embedded in a longer run or in mixed case (the old chunked scan did not)", () => {
    const synthetic = createHash("sha256").update(REF).digest("hex");
    for (const text of [`xx${REF}yy`, "Preview" + "SyntheticRefz", `prefix_${REF.toUpperCase()}_suffix`, `ab${REF}`]) {
      expect(containsRefHash(text, synthetic), text).toBe(true);
    }
    expect(chunked(`xx${REF}yy`, synthetic)).toBe(false);
    expect(containsRefHash("previewsyntheticre fz", synthetic)).toBe(false);
  });
  it("no 20-letter window (any case) in the tracked tree hashes to the real reference", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
    const offenders: string[] = [];
    for (const file of files) {
      let text: string;
      try { text = readFileSync(file, "utf8"); } catch { continue; }
      if (containsRefHash(text, REAL_PREVIEW_REF_SHA256)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  }, 240_000);
});
