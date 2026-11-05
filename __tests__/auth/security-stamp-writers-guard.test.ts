/**
 * Atlas SR-07 guard (REVISE R1 on 1589800a): a session is bound to the credential version it authenticated against,
 * and the refresh check also compares role, school and platform-admin flag. If a writer changes one of those (or the
 * password hash) WITHOUT advancing the version, restoring the old value later would resurrect old sessions.
 *
 * This static guard scans every application source file under app/api and lib for prisma user writes
 * (`.user.update`, `.user.updateMany`, `.user.upsert` update branch) whose data object writes role, schoolId,
 * isPlatformAdmin or hashedPwd, and requires that file to advance the version (advanceSecurityStamp or
 * revokeAllSessions[InTx]). A data object that is not a literal must be listed below with a reason.
 * Seeds and scripts are out of scope (T2 owns the seeds).
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app/api", "lib"];
const IDENTITY_KEYS = /(?:^|[{,\s])(role|schoolId|isPlatformAdmin|hashedPwd)\s*(?=[:,}])/;
const ADVANCES = /\b(advanceSecurityStamp|revokeAllSessions|revokeAllSessionsInTx)\s*\(/;
/** Non-literal user-write data that is known not to touch identity or credential fields. */
const NON_LITERAL_ALLOWED: Record<string, string> = {
  "app/api/admin/guardian-link/route.ts": "`phoneData` only sets guardianPhone/guardianPhoneE164/preferredChannel",
};
const EXEMPT_FILES = new Set(["lib/auth/sessionRevocation.ts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name).replace(/\\/g, "/");
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}
/** The balanced (...) or {...} text starting at `open`. */
function balanced(src: string, open: number): string {
  const pair: Record<string, string> = { "(": ")", "{": "}" };
  const close = pair[src[open]];
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === src[open]) depth++;
    else if (src[i] === close && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
}
/** The value text of `key:` inside an argument object, or null. */
function propertyValue(args: string, key: string): string | null {
  const m = new RegExp(`\\b${key}\\s*:\\s*`).exec(args);
  if (!m) return null;
  const start = m.index + m[0].length;
  if (args[start] === "{") return balanced(args, start);
  return args.slice(start, start + 80).split(/[,}\n]/)[0];
}

type Finding = { file: string; line: number; kind: "IDENTITY_WRITE_WITHOUT_VERSION" | "NON_LITERAL_DATA" };
export function scanSecurityStampWriters(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (EXEMPT_FILES.has(file)) continue;
    const src = readFileSync(file, "utf8");
    const call = /\.user\.(update|updateMany|upsert)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = call.exec(src))) {
      const args = balanced(src, m.index + m[0].length - 1);
      const data = propertyValue(args, m[1] === "upsert" ? "update" : "data");
      if (data === null) continue;
      const line = src.slice(0, m.index).split("\n").length;
      if (!data.startsWith("{")) {
        if (!NON_LITERAL_ALLOWED[file]) findings.push({ file, line, kind: "NON_LITERAL_DATA" });
        continue;
      }
      if (IDENTITY_KEYS.test(data) && !ADVANCES.test(src)) findings.push({ file, line, kind: "IDENTITY_WRITE_WITHOUT_VERSION" });
    }
  }
  return findings;
}

describe("SR-07: identity and credential writers advance the credential version", () => {
  it("RED: every application user write of role, schoolId, isPlatformAdmin or hashedPwd advances the version", () => {
    const files = ROOTS.flatMap((root) => walk(root));
    expect(files.length).toBeGreaterThan(100);
    expect(scanSecurityStampWriters(files)).toEqual([]);
  });
  it("the scanner itself flags an identity write without a version advance, and accepts one with it", () => {
    const fixture = (body: string) => { const dir = `__tests__/auth/.fixture-${Math.random().toString(36).slice(2)}.ts`; return { dir, body }; };
    const a = fixture(`await prisma.user.update({ where: { id, schoolId: s }, data: { isPlatformAdmin: false } });`);
    const b = fixture(`await tx.user.update({ where: { id }, data: { schoolId: s } }); await advanceSecurityStamp(tx, id);`);
    const c = fixture(`await prisma.user.update({ where: { id, schoolId: s }, data: { name: "x" } });`);
    const fs = require("fs") as typeof import("fs");
    try {
      for (const f of [a, b, c]) fs.writeFileSync(f.dir, f.body);
      expect(scanSecurityStampWriters([a.dir]).map((f) => f.kind)).toEqual(["IDENTITY_WRITE_WITHOUT_VERSION"]);
      expect(scanSecurityStampWriters([b.dir, c.dir])).toEqual([]);
    } finally { for (const f of [a, b, c]) try { fs.unlinkSync(f.dir); } catch { /* none */ } }
  });
});
