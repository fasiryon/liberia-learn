"use client";

import { del, get, getMany, keys, set } from "idb-keyval";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";

const DRAFT_PREFIX = "assignment-draft::";

export type AssignmentDraft = {
  body: string;
  savedAt: string;
};

/** Drafts are keyed by learner partition so the next learner on a shared
 * device never loads the previous learner's text for the same assignment.
 * Legacy unpartitioned drafts (`assignment-draft::<id>`) are never read. */
function draftKey(assignmentId: string, partition?: SessionPartitionInput) {
  return `${DRAFT_PREFIX}${resolveSessionPartition(partition).key}::${assignmentId}`;
}

export function saveDraftOffline(assignmentId: string, body: string, partition?: SessionPartitionInput): void {
  set(draftKey(assignmentId, partition), { body, savedAt: new Date().toISOString() } satisfies AssignmentDraft).catch(() => null);
}

export async function getDraftOffline(assignmentId: string, partition?: SessionPartitionInput): Promise<AssignmentDraft | null> {
  try {
    return (await get<AssignmentDraft>(draftKey(assignmentId, partition))) ?? null;
  } catch {
    return null;
  }
}

export async function removeDraftOffline(assignmentId: string, partition?: SessionPartitionInput): Promise<void> {
  try {
    await del(draftKey(assignmentId, partition));
  } catch {
    // best-effort
  }
}

export async function listPendingDrafts(partition?: SessionPartitionInput): Promise<Array<{ assignmentId: string } & AssignmentDraft>> {
  const prefix = `${DRAFT_PREFIX}${resolveSessionPartition(partition).key}::`;
  try {
    const allKeys = (await keys()).filter((k): k is string => typeof k === "string" && k.startsWith(prefix));
    const values = await getMany<AssignmentDraft>(allKeys);
    return allKeys
      .map((k, i) => ({ assignmentId: k.slice(prefix.length), ...values[i] }))
      .filter((entry) => !!entry.body);
  } catch {
    return [];
  }
}
