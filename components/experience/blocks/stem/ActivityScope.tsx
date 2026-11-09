"use client";

/**
 * A bounded activity scope for teaching-blocks/1.2.0 STEM blocks: blocks mounted inside one scope can read what another
 * block in the same activity has published, so a learner's measurements can flow into a graph without retyping.
 * Bounds: React memory only, owned by the mounted scope and discarded when it unmounts; never sent, stored, scored or
 * turned into a grade. Only links the contract defines are read (1.2.0: GRAPH_BUILDER.sourceBlockId -> MEASUREMENT_TABLE;
 * 1.3.0 candidate: DESIGN_CYCLE.measurement.tableId -> MEASUREMENT_TABLE, the cycle feeding its tested results as rows).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MeasurementColumn } from "@/lib/learner-experience/stem/measurementTable";

/** What a MEASUREMENT_TABLE shares: its columns and, per trial, each value (given, or a valid learner entry) or null. */
export type TableSnapshot = Readonly<{ kind: "MEASUREMENT_TABLE"; title: string; origin: "ILLUSTRATIVE" | "MEASURED_BY_LEARNER"; columns: readonly MeasurementColumn[]; rows: ReadonlyArray<Readonly<Record<string, number | null>>> }>;
/** What a linked DESIGN_CYCLE feeds its table: the linked column ids and, per tested design (row = design), each result. */
export type DesignFeedSnapshot = Readonly<{ kind: "DESIGN_FEED"; tableId: string; columns: readonly string[]; rows: ReadonlyArray<Readonly<Record<string, number | null>>> }>;
export type ActivitySnapshot = TableSnapshot | DesignFeedSnapshot;

type Store = Readonly<{ get: (blockId: string) => ActivitySnapshot | undefined; all: () => readonly ActivitySnapshot[]; publish: (blockId: string, snapshot: ActivitySnapshot | undefined) => void }>;
const ActivityContext = createContext<Store | null>(null);

export function ActivityScope({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<Readonly<Record<string, ActivitySnapshot>>>({});
  const publish = useCallback((blockId: string, snapshot: ActivitySnapshot | undefined) => setSnapshots((all) => {
    if (snapshot === undefined) { if (!(blockId in all)) return all; const { [blockId]: _gone, ...rest } = all; return rest; }
    return { ...all, [blockId]: snapshot };
  }), []);
  const store = useMemo<Store>(() => ({ get: (blockId) => snapshots[blockId], all: () => Object.values(snapshots), publish }), [snapshots, publish]);
  return <ActivityContext.Provider value={store}>{children}</ActivityContext.Provider>;
}

/** Publish this block's snapshot while mounted (undefined publishes nothing); withdrawn on unmount. A no-op outside a scope. */
export function usePublishSnapshot(blockId: string, snapshot: ActivitySnapshot | undefined) {
  const store = useContext(ActivityContext);
  const publish = store?.publish;
  const key = JSON.stringify(snapshot);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the snapshot's value identity
  useEffect(() => { publish?.(blockId, snapshot); }, [publish, blockId, key]);
  useEffect(() => () => publish?.(blockId, undefined), [publish, blockId]);
}

/** Read another block's snapshot in the same activity, or undefined (outside a scope, or not published yet). */
export function useSnapshot(blockId: string): ActivitySnapshot | undefined {
  return useContext(ActivityContext)?.get(blockId);
}

/** The one DESIGN_FEED that targets this table, or undefined (none, or more than one: never guess which). */
export function useDesignFeed(tableId: string): DesignFeedSnapshot | undefined {
  const feeds = (useContext(ActivityContext)?.all() ?? []).filter((s): s is DesignFeedSnapshot => s.kind === "DESIGN_FEED" && s.tableId === tableId);
  return feeds.length === 1 ? feeds[0] : undefined;
}
