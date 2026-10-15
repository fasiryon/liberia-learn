/** Source-faithful before/after hub renders using synthetic data, never a live school. */
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as icons from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import { expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ user: { id: "synthetic-learner", schoolId: "synthetic-school", role: "STUDENT" }, student: { currentGrade: 4, deletedAt: null, user: { schoolId: "synthetic-school" } }, rows: [{ contentId: "fixture-halves", title: "Understanding halves", payload: { title: "Understanding halves" }, subject: "MATHEMATICS", grade: 4, contentType: "lesson" }, { contentId: "fixture-equal-parts", title: "Sharing in equal parts", payload: { title: "Sharing in equal parts" }, subject: "MATHEMATICS", grade: 4, contentType: "lesson" }] }));
vi.mock("@/lib/auth", () => ({ requireRole: async () => fixtures.user }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findUnique: async () => fixtures.student } } }));
vi.mock("@/lib/student/learnDiscovery.server", () => ({ listAuthorizedLearnerContent: async () => fixtures.rows }));
vi.mock("@/components/textbooks/textbooks.module.css", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("components/textbooks/textbooks.module.css", "utf8");
  return { default: Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w]*)/g)].map(m => [m[1], m[1]])) };
});
import Hub from "@/app/student/textbooks/page";

it("captures before and after hub source with explicitly synthetic catalogue data", async () => {
  const baseline = execFileSync("git", ["show", "2bf94c11:app/student/textbooks/page.tsx"], { encoding: "utf8" });
  const compiled = transpileModule(baseline, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} as { default?: () => Promise<React.ReactElement> } };
  const dependencies: Record<string, unknown> = {
    "react/jsx-runtime": jsx, "lucide-react": icons,
    "next/link": { __esModule: true, default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> },
    "@/lib/auth": { requireRole: async () => fixtures.user },
    "@/lib/db": { prisma: { student: { findUnique: async () => fixtures.student } } },
    "@/lib/student/learnDiscovery.server": { listAuthorizedLearnerContent: async () => fixtures.rows },
  };
  new Function("require", "module", "exports", compiled)((id: string) => { if (!(id in dependencies)) throw Error(id); return dependencies[id]; }, mod, mod.exports);
  const before = renderToStaticMarkup(await mod.exports.default!());
  const after = renderToStaticMarkup(await Hub());
  const label = '<div style="padding:12px;background:#f7e5b6;color:#332f20;font:13px Arial">SYNTHETIC TEST FIXTURE · Rendered route source; not a live authenticated school catalogue.</div>';
  mkdirSync("artifacts/textbook-v1", { recursive: true });
  writeFileSync("artifacts/textbook-v1/hub-before.html", label + before);
  writeFileSync("artifacts/textbook-v1/hub-after.html", '<style>' + readFileSync("components/textbooks/textbooks.module.css", "utf8") + '</style>' + label + after);
  expect(before).toContain("/student/lesson/fixture-halves");
  expect(after).toContain("/student/textbooks/fixture-halves");
  expect(after).toContain("not published textbook editions");
});
