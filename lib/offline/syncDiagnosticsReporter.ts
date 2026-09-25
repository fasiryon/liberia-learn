"use client";

import { getQueue } from "@/lib/offline-queue";
import { resolveSessionPartition, type SessionPartitionInput } from "@/lib/offline-session";
import { buildSyncDiagnosticSnapshot } from "@/lib/offline/syncDiagnosticsSnapshot";

/** Unchanged queues report at most this often; changes report immediately. */
const UNCHANGED_REPORT_INTERVAL_MS = 10 * 60 * 1000;
/** Server stores at most one snapshot per learner per 30s; retry just after. */
const RATE_LIMIT_RETRY_MS = 31 * 1000;
/** Coalesces bursts of queue writes (enqueue, send, ack) into one report. */
const QUEUE_CHANGE_DEBOUNCE_MS = 3000;

type PartitionState = {
  lastSignature: string | null;
  lastSentAt: number;
  inFlight: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | null;
};

// Keyed by session partition so one learner's report never suppresses
// another's on a shared device.
const states = new Map<string, PartitionState>();

function stateFor(key: string): PartitionState {
  let state = states.get(key);
  if (!state) {
    state = { lastSignature: null, lastSentAt: 0, inFlight: null, timer: null };
    states.set(key, state);
  }
  return state;
}

/**
 * Sends the learner's own privacy-minimized queue summary so authorized
 * support can diagnose stuck sync. Best effort: it never throws, never blocks
 * the drain, and never touches the queue itself.
 */
export function reportSyncDiagnostics(partition?: SessionPartitionInput): Promise<void> {
  let key: string;
  try {
    key = resolveSessionPartition(partition).key;
  } catch {
    return Promise.resolve();
  }
  const state = stateFor(key);
  if (state.inFlight) return state.inFlight;
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.inFlight = send(partition, state).finally(() => { state.inFlight = null; });
  return state.inFlight;
}

/** Coalesced report for queue-change notifications. */
export function scheduleSyncDiagnosticsReport(partition?: SessionPartitionInput, delayMs = QUEUE_CHANGE_DEBOUNCE_MS): void {
  let state: PartitionState;
  try {
    state = stateFor(resolveSessionPartition(partition).key);
  } catch {
    return;
  }
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    void reportSyncDiagnostics(partition);
  }, delayMs);
}

async function send(partition: SessionPartitionInput | undefined, state: PartitionState): Promise<void> {
  try {
    const online = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : null;
    if (online === false) return;
    const now = Date.now();
    const snapshot = buildSyncDiagnosticSnapshot(await getQueue(partition), {
      now,
      online,
      appRelease: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() || null,
    });
    if (!snapshot) return;
    const { capturedAt: _capturedAt, oldestPendingAgeSeconds: _age, nextRetryInSeconds: _next, operations, ...stable } = snapshot;
    const signature = JSON.stringify({ ...stable, operations: operations.map(({ ageSeconds: _a, ...op }) => op) });
    if (signature === state.lastSignature && now - state.lastSentAt < UNCHANGED_REPORT_INTERVAL_MS) return;

    const response = await fetch("/api/student/sync/diagnostics", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    const body = await response.json().catch(() => null);
    // Only a stored snapshot counts as reported. A throttled report keeps the
    // new state pending and retries once the server window has passed.
    if (response.ok && body?.recorded === true) {
      state.lastSignature = signature;
      state.lastSentAt = now;
    } else if (response.ok && body?.reason === "rate_limited") {
      scheduleSyncDiagnosticsReport(partition, RATE_LIMIT_RETRY_MS);
    }
  } catch {
    // Diagnostics must never disturb the learner's offline work.
  }
}
