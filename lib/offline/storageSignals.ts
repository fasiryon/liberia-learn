"use client";

/** Report storage failures without including learner payloads or answers. */
export function reportOfflineStorageError(operation: string, error: unknown): void {
  const code = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "unknown";
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("liberialearn-storage-error", { detail: { operation, code } }));
  }
  console.warn("Offline storage operation failed", { operation, code });
}
