"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { flushSubmissionQueue } from "@/lib/offline/flushQueue";
import { describePendingLogout, safeLogout } from "@/lib/safe-logout";

/**
 * Shared logout flow. A first attempt tries to sync; if work is still
 * unsynced the learner sees a warning and may confirm. Confirming always
 * completes logout (shared-device privacy) and keeps the work isolated
 * under the learner's own account on this device.
 */
export function useSafeLogout(callbackUrl = "/login") {
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  async function run(keepPendingWork: boolean) {
    setBusy(true);
    try {
      const result = await safeLogout({
        keepPendingWork,
        flushPendingSyncAttempt: async () => { await flushSubmissionQueue(); },
      });
      if (!result.completed) {
        setPendingCount(result.unsyncedCount);
        return;
      }
      await signOut({ callbackUrl });
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    pendingCount,
    warning: pendingCount ? describePendingLogout(pendingCount) : null,
    logout: () => run(false),
    confirmLogoutKeepingWork: () => run(true),
    cancel: () => setPendingCount(null),
  };
}
