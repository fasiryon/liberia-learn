import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, it } from "vitest";
import { validateOfflineOperation } from "@/lib/offline/syncProtocol";

it("the actual hero-writer expression emits 16 lowercase hex without invoking generation or persistence", () => {
  const source = readFileSync("scripts/generate-hero-lessons.ts", "utf8");
  const ast = ts.createSourceFile("hero.ts", source, ts.ScriptTarget.Latest, true);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "hash" && node.initializer) expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  expect(expression).toContain("slice(0, 16)");
  const payload = { title: "Synthetic 16-hex investigation", body: "Synthetic lesson" };
  const digest = runInNewContext(expression, { createHash, payload });
  expect(digest).toMatch(/^[0-9a-f]{16}$/);
  expect(digest).toBe(createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16));
  expect(source).toMatch(/create:\s*\{[\s\S]*?status:\s*'published',[\s\S]*?hash,/);
  expect(source).toMatch(/update:\s*\{[\s\S]*?status:\s*'published',[\s\S]*?hash,/);
});

it("16-hex remains refused by the shipping validator even with complete release identity", () => {
  expect(validateOfflineOperation({ protocolVersion: 1, operationId: "hash16-investigation", idempotencyKey: "hash16-investigation",
    learnerId: "synthetic-learner", schoolId: "synthetic-school", resourceType: "lesson_progress", resourceId: "synthetic-work",
    contentId: "synthetic-content", contentVersion: "1", contentHash: "a".repeat(16), manifestSequence: null,
    operationType: "progress.complete", payload: {}, clientCreatedAt: "2026-11-14T15:00:00.000Z", baseServerVersion: null, dependencyIds: [] })).toBe(false);
});

it("the current authoritative comparison can distinguish exact 16-hex identities, without enabling route admission", async () => {
  const source = readFileSync("app/api/student/sync/route.ts", "utf8");
  const start = source.indexOf("async function assessContentTrust(");
  const end = source.indexOf("export async function POST", start);
  const comparison = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const base = { resourceType: "lesson_progress", contentId: "synthetic-content", contentVersion: "1", contentHash: "a".repeat(16) };
  async function check(operation: typeof base) {
    const prisma = { curriculumContent: { findUnique: async ({ where }: { where: { contentId: string } }) =>
      where.contentId === base.contentId ? { contentId: base.contentId, hash: base.contentHash, version: "1", status: "published" } : null } };
    return runInNewContext(`${comparison}\nassessContentTrust(operation)`, { operation, prisma });
  }
  expect(await check(base)).toMatchObject({ action: "allow" });
  expect(await check({ ...base, contentHash: "b".repeat(16) })).toMatchObject({ action: "conflict", status: "content_hash_mismatch" });
  expect(await check({ ...base, contentVersion: "2" })).toMatchObject({ action: "conflict", status: "content_version_changed" });
  expect(await check({ ...base, contentId: "another-content" })).toMatchObject({ action: "reject", status: "content_not_found" });
});
