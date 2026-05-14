"use client";

import { del, get, getMany, keys, set } from "idb-keyval";

const DRAFT_PREFIX = "assignment-draft::";

export type AssignmentDraft = {
  body: string;
  savedAt: string;
};

export function saveDraftOffline(assignmentId: string, body: string): void {
  set(`${DRAFT_PREFIX}${assignmentId}`, { body, savedAt: new Date().toISOString() } satisfies AssignmentDraft).catch(() => null);
}

export async function getDraftOffline(assignmentId: string): Promise<AssignmentDraft | null> {
  try {
    return (await get<AssignmentDraft>(`${DRAFT_PREFIX}${assignmentId}`)) ?? null;
  } catch {
    return null;
  }
}

export async function removeDraftOffline(assignmentId: string): Promise<void> {
  try {
    await del(`${DRAFT_PREFIX}${assignmentId}`);
  } catch {
    // best-effort
  }
}

export async function listPendingDrafts(): Promise<Array<{ assignmentId: string } & AssignmentDraft>> {
  try {
    const allKeys = (await keys()).filter((k): k is string => typeof k === "string" && k.startsWith(DRAFT_PREFIX));
    const values = await getMany<AssignmentDraft>(allKeys);
    return allKeys
      .map((k, i) => ({ assignmentId: k.slice(DRAFT_PREFIX.length), ...values[i] }))
      .filter((entry) => !!entry.body);
  } catch {
    return [];
  }
}
