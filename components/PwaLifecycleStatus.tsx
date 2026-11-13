"use client";

import { useEffect, useState } from "react";
import { useFixedBandHeight } from "./useFixedBandHeight";

type PwaUpdateDetail = { registration?: ServiceWorkerRegistration };
type PwaState = "online" | "offline" | "update" | "required" | "storage" | "failure" | null;

export function PwaLifecycleStatus() {
  const [state, setState] = useState<PwaState>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState<PwaState>(null);
  // Reserved by globals.css so the notice never hides a focused or final control (issue #199).
  const noticeRef = useFixedBandHeight<HTMLDivElement>("--ll-status-notice", 16);
  // A dismissal covers only the message that was showing; any new lifecycle state shows again.
  useEffect(() => { setDismissed(null); }, [state]);

  useEffect(() => {
    const setOffline = () => setState("offline");
    const setOnline = () => setState((current) => current === "offline" ? null : current);
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PwaUpdateDetail>).detail;
      setRegistration(detail?.registration ?? null);
      setState("update");
    };
    const onRequired = (event: Event) => {
      const detail = (event as CustomEvent<PwaUpdateDetail>).detail;
      setRegistration(detail?.registration ?? null);
      setState("required");
    };
    const onStorage = () => setState("storage");
    const onPwaState = (event: Event) => {
      const detail = (event as CustomEvent<{ state?: string }>).detail;
      if (detail?.state === "install-failed" || detail?.state === "unsupported") setState("failure");
    };

    if (!navigator.onLine) setOffline();
    window.addEventListener("offline", setOffline);
    window.addEventListener("online", setOnline);
    window.addEventListener("liberialearn-pwa-update-available", onUpdate);
    window.addEventListener("liberialearn-pwa-update-required", onRequired);
    window.addEventListener("liberialearn-storage-error", onStorage);
    window.addEventListener("liberialearn-pwa-state", onPwaState);
    return () => {
      window.removeEventListener("offline", setOffline);
      window.removeEventListener("online", setOnline);
      window.removeEventListener("liberialearn-pwa-update-available", onUpdate);
      window.removeEventListener("liberialearn-pwa-update-required", onRequired);
      window.removeEventListener("liberialearn-storage-error", onStorage);
      window.removeEventListener("liberialearn-pwa-state", onPwaState);
    };
  }, []);

  async function activateUpdate() {
    registration?.waiting?.postMessage({ type: "ACTIVATE_UPDATE" });
    if (registration?.waiting) {
      await new Promise<void>((resolve) => {
        const onChange = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener("controllerchange", onChange);
        window.setTimeout(resolve, 3000);
      });
      window.location.reload();
    }
  }

  if (!state || state === dismissed) return null;

  const copy = {
    offline: "Offline. Saved work stays on this device.",
    update: "An app update is ready. Your saved work will be preserved.",
    required: "Update required before this trusted content can continue.",
    storage: "Local storage is unavailable. Keep this page open and reconnect before leaving.",
    failure: "Offline support could not start. Reconnect before closing this page.",
  }[state];

  return (
    <div ref={noticeRef} role="status" aria-live="polite" data-pwa-status={state} className="fixed bottom-[calc(0.5rem+var(--ll-fixed-footer,0px)+var(--ll-cookie-notice,0px))] left-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3 text-sm text-[var(--ll-text)] shadow-xl sm:right-auto sm:max-w-sm">
      <div className="min-w-0 flex-1">
        <p>{copy}</p>
        {(state === "update" || state === "required") && registration?.waiting && (
          <button type="button" onClick={activateUpdate} className="mt-2 rounded-lg bg-[var(--ll-yellow)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-bg)]">
            Update LiberiaLearn
          </button>
        )}
      </div>
      <button type="button" onClick={() => setDismissed(state)} aria-label="Dismiss this notice" className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-base leading-none text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ll-yellow)]">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
