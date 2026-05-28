"use client";

/**
 * lib/offline/submitWithQueue.ts  — NR-14A
 *
 * Drop-in replacement for raw fetch() on student submission forms.
 * Tries the network first; if offline OR the request fails it stores
 * the action in IndexedDB and registers a Background Sync tag so the
 * browser replays it automatically when connectivity returns.
 *
 * Usage:
 *   const result = await submitWithQueue({
 *     type: "homework",
 *     endpoint: `/api/homework/submit`,
 *     body: { homeworkId, answers },
 *   });
 *   if (result.status === "submitted") toast("Submitted ✓")
 *   else toast("Saved — will submit when online")
 */

import { enqueueOfflineRequest } from "@/lib/offline-queue";

/** Background Sync tag used by public/sw.js `flushOfflineQueue()`. */
const SYNC_TAG = "liberialearn-sync";

export type SubmissionType =
  | "homework"
  | "assignment-submission"
  | "lesson-complete"
  | "lab-submission"
  | "tutor-interaction";

export type SubmitResult =
  | { status: "submitted"; data: unknown }
  | { status: "queued"; clientSubmissionId: string };

export async function submitWithQueue(params: {
  type: SubmissionType;
  endpoint: string;
  body: Record<string, unknown>;
  /** Optional stable dedup key. Defaults to `{type}:{endpoint}:{clientSubmissionId}`. */
  dedupeKey?: string;
}): Promise<SubmitResult> {
  // Generate a client-side UUID that travels with the payload so the server
  // can short-circuit duplicate POSTs (see NR-14A idempotency guard).
  const clientSubmissionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const body = { ...params.body, clientSubmissionId };
  const dedupeKey =
    params.dedupeKey ?? `${params.type}:${params.endpoint}:${clientSubmissionId}`;

  // ── Try network first if the browser thinks we're online ──────────────────
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await fetch(params.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return { status: "submitted", data: await res.json() };
      }
      // Non-OK (5xx, server blip) → fall through to queue so the student
      // doesn't lose their work.
    } catch {
      // Network error (DNS failure, connection refused, etc.) → queue it.
    }
  }

  // ── Offline / failed ── store in IndexedDB ────────────────────────────────
  await enqueueOfflineRequest({
    type: params.type as
      | "lesson-complete"
      | "assignment-submission"
      | "lab-submission"
      | "tutor-interaction",
    endpoint: params.endpoint,
    payload: body,
    dedupeKey,
  });

  // Ask the service worker to flush when connectivity returns.
  // Falls back to the online-event listener in SyncManager if the browser
  // doesn't support BackgroundSync (e.g. iOS Safari <17).
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as any).sync?.register(SYNC_TAG))
      .catch(() => null);
  }

  return { status: "queued", clientSubmissionId };
}
