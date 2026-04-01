"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export const guardianWelcomeStorageKey = "guardian_has_seen_welcome";

export function GuardianWelcomeGate({
  enabled,
}: {
  enabled: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!enabled || pathname === "/guardian/welcome") return;
    if (typeof window === "undefined") return;
    const hasSeenWelcome = window.localStorage.getItem(guardianWelcomeStorageKey);
    if (!hasSeenWelcome) {
      router.replace("/guardian/welcome");
    }
  }, [enabled, pathname, router]);

  return null;
}
