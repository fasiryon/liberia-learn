/**
 * DB-AUDIT-USE-INERT (Atlas B2, T2 review item 4), T1 application side. Prisma 6.14+ removed `$use`, so the
 * lib/db.ts audit and timeout middleware never registered; the root delegate wrapper missed interactive
 * transactions, upsert and updateManyAndReturn. This suite runs the REAL installed generated client exported by
 * lib/db.ts. The query engine is replaced by a recorder, so nothing connects and the test can see exactly which
 * operations would have reached the database:
 *  - AuditLog update/updateMany/updateManyAndReturn/upsert/delete/deleteMany are refused on the root client,
 *    inside interactive transactions and inside batch transactions, before the engine; create and reads pass;
 *  - ENABLE_AUDIT_IMMUTABILITY=false restores pass-through (the database trigger remains the safety net);
 *  - Preview/staging: every write to an official-record model (lib/preview/recordsFreeze.ts) is refused the same
 *    way; reads, AuditLog appends and identity (User) writes pass; Production and local are unchanged;
 *  - an interactive transaction whose callback hits a guard rolls back (the engine is told to roll back, never to
 *    commit) and nothing it attempted reached the engine.
 * Limits stated, not tested here: raw SQL, nested writes through another model and separately constructed Prisma
 * clients bypass any client extension; database triggers, grants and RLS (T2) are the boundary for those.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PREVIEW_FROZEN_RECORD_MODELS } from "@/lib/preview/recordsFreeze";

type Call = { kind: "request" | "batch" | "tx"; detail: string };
const calls: Call[] = [];
let prisma: any;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://synthetic:synthetic@127.0.0.1:1/never_connected");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("ENABLE_RDS_DUAL_WRITE", "false");
  delete (globalThis as any).prisma;
  prisma = (await import("@/lib/db")).prisma;
  const engine = prisma._engine;
  engine.start = async () => undefined;
  engine.transaction = async (action: string) => { calls.push({ kind: "tx", detail: action }); return action === "start" ? { id: "synthetic-tx" } : undefined; };
  engine.request = async (q: any) => { calls.push({ kind: "request", detail: JSON.stringify(q?.modelName ?? q?.protocolQuery?.modelName ?? q).slice(0, 120) }); throw Object.assign(new Error("ENGINE_REACHED"), { engineReached: true }); };
  engine.requestBatch = async () => { calls.push({ kind: "batch", detail: "batch" }); throw Object.assign(new Error("ENGINE_REACHED"), { engineReached: true }); };
});
afterEach(() => { calls.length = 0; vi.stubEnv("VERCEL_ENV", ""); vi.stubEnv("ENABLE_AUDIT_IMMUTABILITY", "true"); vi.stubEnv("DEMO_MODE", ""); });

const where = { id: "synthetic" };
const AUDIT_MUTATIONS: Array<[string, (c: any) => Promise<unknown>]> = [
  ["update", c => c.auditLog.update({ where, data: { action: "x" } })],
  ["updateMany", c => c.auditLog.updateMany({ data: { action: "x" } })],
  ["updateManyAndReturn", c => c.auditLog.updateManyAndReturn({ data: { action: "x" } })],
  ["upsert", c => c.auditLog.upsert({ where, create: { action: "x" }, update: { action: "x" } })],
  ["delete", c => c.auditLog.delete({ where })],
  ["deleteMany", c => c.auditLog.deleteMany({})],
];
async function outcome(run: () => Promise<unknown>) {
  try { await run(); return "resolved"; }
  catch (e: any) { return e?.engineReached || /ENGINE_REACHED/.test(String(e?.message)) ? "engine" : e?.code ?? String(e?.message).split("\n").pop(); }
}

describe("audit immutability on the installed client", () => {
  it("the installed client has no $use: the old middleware could never register", () => {
    expect(typeof prisma.$use).toBe("undefined");
    expect(typeof prisma.$extends).toBe("function");
  });
  it.each(AUDIT_MUTATIONS)("RED: root %s is refused before the engine", async (_op, run) => {
    expect(await outcome(() => run(prisma))).toBe("AUDIT_LOG_IMMUTABLE");
    expect(calls.filter(c => c.kind !== "tx")).toEqual([]);
  });
  it.each(AUDIT_MUTATIONS)("RED: interactive-transaction %s is refused and the transaction rolls back", async (_op, run) => {
    expect(await outcome(() => prisma.$transaction((tx: any) => run(tx)))).toBe("AUDIT_LOG_IMMUTABLE");
    expect(calls.filter(c => c.kind !== "tx")).toEqual([]);
    expect(calls.filter(c => c.kind === "tx").map(c => c.detail)).toEqual(["start", "rollback"]);
  });
  it.each(AUDIT_MUTATIONS)("RED: batch-transaction %s is refused before the batch is sent", async (_op, run) => {
    expect(await outcome(() => prisma.$transaction([prisma.user.findMany(), run(prisma)]))).toBe("AUDIT_LOG_IMMUTABLE");
    expect(calls.filter(c => c.kind === "batch" || c.kind === "request")).toEqual([]);
  });
  it("append and read still reach the engine (root and interactive)", async () => {
    expect(await outcome(() => prisma.auditLog.create({ data: { action: "x" } }))).toBe("engine");
    expect(await outcome(() => prisma.auditLog.findMany())).toBe("engine");
    expect(await outcome(() => prisma.$transaction((tx: any) => tx.auditLog.create({ data: { action: "x" } })))).toBe("engine");
  });
  it("ENABLE_AUDIT_IMMUTABILITY=false passes mutations through (database trigger remains the net)", async () => {
    vi.stubEnv("ENABLE_AUDIT_IMMUTABILITY", "false");
    for (const [, run] of AUDIT_MUTATIONS) expect(await outcome(() => run(prisma))).toBe("engine");
  });
  it("the inert timeout middleware is gone (no unbounded promise race pretending to cancel work)", async () => {
    const fs = await import("node:fs");
    expect(fs.readFileSync("lib/db.ts", "utf8")).not.toMatch(/\$use|DB_QUERY_TIMEOUT_MS|Promise\.race/);
  });
});

describe("Preview official-records freeze (data layer, B5 default refusal)", () => {
  const WRITES: Array<[string, (d: any) => Promise<unknown>]> = [
    ["create", d => d.create({ data: {} })],
    ["createMany", d => d.createMany({ data: [] })],
    ["update", d => d.update({ where, data: {} })],
    ["updateMany", d => d.updateMany({ data: {} })],
    ["upsert", d => d.upsert({ where, create: {}, update: {} })],
    ["delete", d => d.delete({ where })],
    ["deleteMany", d => d.deleteMany({})],
  ];
  const delegate = (client: any, model: string) => client[model.charAt(0).toLowerCase() + model.slice(1)];
  it.each(["preview", "staging"])("RED: VERCEL_ENV=%s refuses every write to every frozen model before the engine", async vercelEnv => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    const outcomes = new Set<string>();
    for (const model of PREVIEW_FROZEN_RECORD_MODELS) {
      expect(delegate(prisma, model), model).toBeTruthy();
      for (const [, run] of WRITES) outcomes.add(`${await outcome(() => run(delegate(prisma, model)))}`);
    }
    expect([...outcomes]).toEqual(["PREVIEW_RECORDS_FROZEN"]);
    expect(calls).toEqual([]);
  });
  it("RED: interactive and batch transactions are frozen too (DEMO_MODE does not reopen them)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("DEMO_MODE", "true");
    expect(await outcome(() => prisma.$transaction((tx: any) => tx.grade.update({ where, data: {} })))).toBe("PREVIEW_RECORDS_FROZEN");
    expect(await outcome(() => prisma.$transaction([prisma.attendanceRecord.deleteMany({})]))).toBe("PREVIEW_RECORDS_FROZEN");
    expect(calls.filter(c => c.kind !== "tx")).toEqual([]);
  });
  it("Preview reads, audit appends and identity writes still pass (sign-in updates User)", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await outcome(() => prisma.grade.findMany())).toBe("engine");
    expect(await outcome(() => prisma.auditLog.create({ data: { action: "x" } }))).toBe("engine");
    expect(await outcome(() => prisma.user.update({ where, data: { name: "x" } }))).toBe("engine");
  });
  it.each(["production", ""])("VERCEL_ENV=%j leaves record writes untouched", async vercelEnv => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    expect(await outcome(() => prisma.grade.update({ where, data: {} }))).toBe("engine");
    expect(await outcome(() => prisma.$transaction((tx: any) => tx.attendanceRecord.create({ data: {} })))).toBe("engine");
  });
  it("the guard error is a fixed 403 code with no model data", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const err: any = await prisma.grade.update({ where, data: { score: 99 } }).catch((e: unknown) => e);
    expect([err.status, err.code, err.message]).toEqual([403, "PREVIEW_RECORDS_FROZEN", "Official records are read-only in this Preview"]);
  });
});
