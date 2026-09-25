"use client";

import { getQueue } from "@/lib/offline-queue";
import type { SessionPartitionInput } from "@/lib/offline-session";
import { buildSyncDiagnosticSnapshot } from "@/lib/offline/syncDiagnosticsSnapshot";

/** Unchanged queues report at most this often; changes report immediately. */
const UNCHANGED_REPORT_INTERVAL_MS = 10 * 60 * 1000;

let lastSignature: string | null = null;
let lastSentAt = 0;
let inFlight: Promise<void> | null = null;

/**
 * Sends the learner's own privacy-minimized queue summary so authorized
 * support can diagnose stuck sync. Best effort: it never throws, never blocks
 * the drain, and never touches the queue itself.
 */
export function reportSyncDiagnostics(partition?: SessionPartitionInput): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = send(partition).finally(() => { inFlight = null; });
  return inFlight;
}

async function send(partition?: SessionPartitionInput): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const now = Date.now();
    const snapshot = buildSyncDiagnosticSnapshot(await getQueue(partition), {
      now,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      appRelease: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() || null,
    });
    if (!snapshot) return;
    const { capturedAt: _capturedAt, oldestPendingAgeSeconds: _age, nextRetryInSeconds: _next, operations, ...stable } = snapshot;
    const signature = JSON.stringify({ ...stable, operations: operations.map(({ ageSeconds: _a, ...op }) => op) });
    if (signature === lastSignature && now - lastSentAt < UNCHANGED_REPORT_INTERVAL_MS) return;

    const response = await fetch("/api/student/sync/diagnostics", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    if (response.ok) {
      lastSignature = signature;
      lastSentAt = now;
    }
  } catch {
    // Diagnostics must never disturb the learner's offline work.
  }
}
