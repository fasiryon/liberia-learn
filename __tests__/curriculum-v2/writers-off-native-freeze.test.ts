// Codex second-pass P1-1: in compatibility mode (provenance writers off) an EXISTING native
// Curriculum V2 row is frozen. A legacy-looking replacement cannot downgrade it in place, and the
// check runs against the locked row inside the same transaction as the write.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string; contentId: string };
const db = vi.hoisted(() => ({ rows: new Map<string, Row>(), locks: [] as string[], transactions: 0 }));

vi.mock("@/lib/db", () => {
  const find = (where: Record<string, unknown>) =>
    [...db.rows.values()].find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null;
  const client = {
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, id: string) => { db.locks.push(id); return [{ id }]; }),
    curriculumContent: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => find(where)),
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
