// Codex second-pass P1-1: in compatibility mode (provenance writers off) an EXISTING native
// Curriculum V2 row is frozen. A legacy-looking replacement cannot downgrade it in place, and the
// check runs against the locked row inside the same transaction as the write.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string; contentId: string };
const db = vi.hoisted(() => ({
  rows: new Map<string, Row>(), locks: [] as string[], transactions: 0, calls: [] as string[],
  // Interleaving hooks: simulate another transaction committing between this one's statements.
  beforeFirstLookup: null as null | (() => void), onLock: null as null | ((id: string) => void),
  // Rows committed by "another transaction": a rollback of this transaction must not undo them.
  external: new Map<string, Record<string, unknown>>(),
}));
/** Commit a row change from a concurrent transaction. */
const commitConcurrently = (row: Record<string, unknown> & { id: string }) => {
  db.external.set(row.id, structuredClone(row));
  db.rows.set(row.id, { ...(db.rows.get(row.id) ?? {}), ...structuredClone(row) } as any);
};

vi.mock("@/lib/db", () => {
  const find = (where: Record<string, unknown>) =>
    [...db.rows.values()].find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null;
  const client = {
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, id: string) => {
      db.calls.push("lock");
      db.locks.push(id);
      db.onLock?.(id);
      return [{ id }];
    }),
    curriculumContent: {
      findUnique: vi.fn(async ({ where, select }: { where: Record<string, unknown>; select?: unknown }) => {
        db.calls.push(select ? "lookup" : "read");
        // The lookup sees the pre-commit snapshot; the concurrent row lands right after it.
        const row = find(where);
        if (db.beforeFirstLookup) { const hook = db.beforeFirstLookup; db.beforeFirstLookup = null; hook(); }
        return row;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const row = find(where);
        if (!row) throw new Error("NOT_FOUND");
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const row = find(where);
        if (!row) throw new Error("NOT_FOUND");
        Object.assign(row, data);
        return row;
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        if (find({ contentId: data.contentId })) throw new Error("UNIQUE_VIOLATION");
        const row = { id: `id-${data.contentId}`, ...data };
        db.rows.set(row.id, row);
        return row;
      }),
    },
  };
  // Rolls back every write in the callback when it throws, like a real interactive transaction.
  const $transaction = vi.fn(async (fn: (tx: typeof client) => Promise<unknown>) => {
    db.transactions += 1;
    const snapshot = new Map([...db.rows].map(([id, row]) => [id, structuredClone(row)]));
    try {
      return await fn(client);
    } catch (error) {
      db.rows = snapshot;
      for (const [id, row] of db.external) db.rows.set(id, { ...(db.rows.get(id) ?? {}), ...structuredClone(row) } as any);
      throw error;
    }
  });
  return { prisma: { ...client, $transaction } };
});

import { prisma } from "@/lib/db";
import {
  updateCurriculumContent,
  updateCurriculumContentInTransaction,
  updateCurriculumOperationalFields,
  upsertCurriculumContent,
} from "@/lib/curriculum/mutations/repository";

const context = { revisionKind: "EDIT", originKind: "HUMAN_AUTHORED" } as any;
const NATIVE_PAYLOAD = { title: "Equivalent fractions", curriculumV2: { contractVersion: "curriculum-lesson-v2/1.0.0", scenes: [{ id: "s1" }] } };
const FROZEN = /NATIVE_CURRICULUM_V2_EXISTING_ROW_REQUIRES_PROVENANCE_WRITERS/;

beforeEach(() => {
  delete process.env.P2A_PROVENANCE_WRITERS_DISABLED; // default: writers off (compatibility mode)
  db.rows = new Map([
    ["id-native", { id: "id-native", contentId: "native", status: "published", hash: "h-native", payload: structuredClone(NATIVE_PAYLOAD) }],
    ["id-legacy", { id: "id-legacy", contentId: "legacy", status: "published", hash: "h-legacy", payload: { body: "Legacy lesson" } }],
  ]);
  db.locks = [];
  db.transactions = 0;
  db.calls = [];
  db.beforeFirstLookup = null;
  db.onLock = null;
  db.external = new Map();
});
afterEach(() => { delete process.env.P2A_PROVENANCE_WRITERS_DISABLED; });

const native = () => db.rows.get("id-native")!;

describe("P1-1 writers-off: existing native rows are frozen", () => {
  it("refuses a legacy-looking payload replacement on update, after locking the row, and leaves it unchanged", async () => {
    await expect(updateCurriculumContent({ contentId: "native" }, { payload: { body: "downgraded" } }, context)).rejects.toThrow(FROZEN);
    expect(db.locks).toEqual(["id-native"]);
    expect(native().payload).toEqual(NATIVE_PAYLOAD);
  });

  it("refuses title, status-to-draft and mixed operational+instructional writes", async () => {
    for (const data of [{ title: "Renamed" }, { status: "DRAFT" }, { thumbnailUrl: "https://x/y.png", payload: { body: "x" } }]) {
      await expect(updateCurriculumContent({ contentId: "native" }, data as any, context)).rejects.toThrow(FROZEN);
    }
    expect(native()).toMatchObject({ status: "published", payload: NATIVE_PAYLOAD });
    expect(native().title).toBeUndefined();
  });

  it("rolls back earlier writes in the same transaction when the native check fails", async () => {
    await expect(prisma.$transaction(async (tx: any) => {
      await updateCurriculumContentInTransaction(tx, { contentId: "legacy" }, { payload: { body: "Edited legacy" } }, context);
      await updateCurriculumContentInTransaction(tx, { contentId: "native" }, { payload: { body: "downgraded" } }, context);
    })).rejects.toThrow(FROZEN);
    expect(db.rows.get("id-legacy")!.payload).toEqual({ body: "Legacy lesson" });
    expect(native().payload).toEqual(NATIVE_PAYLOAD);
  });

  it("refuses the update branch of upsert for an existing native row; creates new rows normally", async () => {
    const create = { contentId: "native", title: "t", grade: 4, subject: "MATH", contentType: "lesson", payload: { body: "new" } } as any;
    await expect(upsertCurriculumContent({ contentId: "native" }, create, { payload: { body: "downgraded" } }, context)).rejects.toThrow(FROZEN);
    expect(native().payload).toEqual(NATIVE_PAYLOAD);
    const created = await upsertCurriculumContent({ contentId: "fresh" }, { ...create, contentId: "fresh" }, { payload: { body: "unused" } }, context);
    expect(created.content).toMatchObject({ contentId: "fresh", payload: { body: "new" } });
  });

  it("still allows rendering/search artefact fields on a native row, but never its hash identity", async () => {
    await expect(updateCurriculumContent({ contentId: "native" }, { thumbnailUrl: "https://x/t.png", thumbnailStatus: "GENERATED" } as any, context)).resolves.toBeTruthy();
    expect(native().thumbnailUrl).toBe("https://x/t.png");
    await expect(updateCurriculumContent({ contentId: "native" }, { hash: "forged" } as any, context)).rejects.toThrow(FROZEN);
    await expect(updateCurriculumOperationalFields({ contentId: "native" }, { hash: "forged" } as any)).rejects.toThrow(FROZEN);
    expect(native().hash).toBe("h-native");
    await expect(updateCurriculumOperationalFields({ contentId: "native" }, { embeddedAt: new Date(0) } as any)).resolves.toBeTruthy();
  });

  it("leaves legacy rows editable, including their hash", async () => {
    await updateCurriculumContent({ contentId: "legacy" }, { payload: { body: "Edited" }, title: "New" } as any, context);
    await updateCurriculumOperationalFields({ contentId: "legacy" }, { hash: "h-legacy-2" } as any);
    expect(db.rows.get("id-legacy")).toMatchObject({ payload: { body: "Edited" }, title: "New", hash: "h-legacy-2" });
  });
});

describe("P1-1 third pass: races cannot bypass the native check", () => {
  const insertNative = () => commitConcurrently({ id: "id-race", contentId: "race", status: "published", hash: "h-race", payload: NATIVE_PAYLOAD });

  it("an update whose target is absent at lookup is rejected, never written blind, even if a native row commits concurrently", async () => {
    db.beforeFirstLookup = insertNative;
    await expect(updateCurriculumContent({ contentId: "race" }, { payload: { body: "Replacement" } }, context)).rejects.toMatchObject({ code: "P2025" });
    expect(db.rows.get("id-race")).toMatchObject({ status: "published", hash: "h-race", payload: NATIVE_PAYLOAD });
    expect(db.locks).toEqual([]);
  });

  it("an upsert whose target is absent at lookup inserts; a concurrently committed native row makes the insert fail, unchanged", async () => {
    db.beforeFirstLookup = insertNative;
    const create = { contentId: "race", title: "t", grade: 4, subject: "MATH", contentType: "lesson", payload: { body: "legacy" } } as any;
    await expect(upsertCurriculumContent({ contentId: "race" }, create, { payload: { body: "Replacement" } }, context)).rejects.toThrow("UNIQUE_VIOLATION");
    expect(db.rows.get("id-race")).toMatchObject({ status: "published", payload: NATIVE_PAYLOAD });
  });

  it("a legacy row that becomes native before the lock is granted is checked as native (post-lock read)", async () => {
    db.onLock = (id) => commitConcurrently({ id, payload: NATIVE_PAYLOAD });
    await expect(updateCurriculumContent({ contentId: "legacy" }, { payload: { body: "Downgrade" }, status: "DRAFT" } as any, context)).rejects.toThrow(FROZEN);
    expect(db.rows.get("id-legacy")).toMatchObject({ status: "published", hash: "h-legacy", payload: NATIVE_PAYLOAD });
    expect(db.calls).toEqual(["lookup", "lock", "read"]);
  });

  it("the operational-fields hash path also reads after the lock", async () => {
    db.onLock = (id) => commitConcurrently({ id, payload: NATIVE_PAYLOAD });
    await expect(updateCurriculumOperationalFields({ contentId: "legacy" }, { hash: "forged" } as any)).rejects.toThrow(FROZEN);
    expect(db.rows.get("id-legacy")!.hash).toBe("h-legacy");
  });

  it("the revision-tracked path takes its snapshot after the lock, not before", async () => {
    process.env.P2A_PROVENANCE_WRITERS_DISABLED = "false";
    // The fake has no provenance tables, so the write stops after the snapshot; only the order matters here.
    await expect(prisma.$transaction((tx: any) => updateCurriculumContentInTransaction(tx, { contentId: "legacy" }, { payload: { body: "x" } }, { ...context, idempotencyKey: undefined }))).rejects.toThrow();
    expect(db.calls.slice(0, 3)).toEqual(["lookup", "lock", "read"]);
    expect(db.rows.get("id-legacy")!.payload).toEqual({ body: "Legacy lesson" });
  });
});
