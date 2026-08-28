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
import type { OfflineResourceType } from "@/lib/offline/syncProtocol";

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
  | { status: "queued"; clientSubmissionId: string }
  | { status: "storage_error"; clientSubmissionId: string; error: string }
  | { status: "unsupported_offline"; clientSubmissionId: string };

export async function submitWithQueue(params: {
  type: SubmissionType;
  endpoint: string;
  body: Record<string, unknown>;
  /** Optional stable dedup key. Defaults to `{type}:{endpoint}:{clientSubmissionId}`. */
  dedupeKey?: string;
  contentId?: string | null;
  contentVersion?: string | null;
  contentHash?: string | null;
  baseServerVersion?: string | null;
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
        credentials: "include",
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
  try {
    const resourceType: OfflineResourceType | undefined =
      params.type === "homework" ? "homework_submission" :
      params.type === "assignment-submission" ? "assignment_submission" :
      params.type === "lesson-complete" ? "lesson_progress" :
      params.type === "lab-submission" ? "lab_session" : undefined;
    if (!resourceType) {
      return { status: "unsupported_offline", clientSubmissionId };
    }
    const resourceId = String(
      params.body.homeworkId ?? params.body.assignmentId ?? params.body.sessionId ?? params.body.scheduledWorkId ?? dedupeKey,
    );
    await enqueueOfflineRequest({
      type: params.type,
      endpoint: "/api/student/sync",
      payload: body,
      dedupeKey,
      resourceType,
      resourceId,
      contentId: params.contentId ?? (typeof params.body.contentId === "string" ? params.body.contentId : null),
      contentVersion: params.contentVersion ?? (typeof params.body.contentVersion === "string" ? params.body.contentVersion : null),
      contentHash: params.contentHash ?? (typeof params.body.contentHash === "string" ? params.body.contentHash : null),
      baseServerVersion: params.baseServerVersion,
    });
  } catch (error) {
    return {
      status: "storage_error",
      clientSubmissionId,
      error: error instanceof Error ? error.message : "Offline storage is unavailable.",
    };
  }

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
