"use client";

import { useEffect, useState } from "react";

type PwaUpdateDetail = { registration?: ServiceWorkerRegistration };
type PwaState = "online" | "offline" | "update" | "required" | "storage" | "failure" | null;

export function PwaLifecycleStatus() {
  const [state, setState] = useState<PwaState>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const setOffline = () => setState("offline");
    const setOnline = () => setState((current) => current === "offline" ? null : current);
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PwaUpdateDetail>).detail;
      setRegistration(detail?.registration ?? null);
      setState("update");
    };
    const onRequired = () => setState("required");
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

  if (!state) return null;

  const copy = {
    offline: "Offline. Saved work stays on this device.",
    update: "An app update is ready. Your saved work will be preserved.",
    required: "Update required before this trusted content can continue.",
    storage: "Local storage is unavailable. Keep this page open and reconnect before leaving.",
    failure: "Offline support could not start. Reconnect before closing this page.",
  }[state];

  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3 text-sm text-[var(--ll-text)] shadow-xl">
      <p>{copy}</p>
      {state === "update" && registration?.waiting && (
        <button type="button" onClick={activateUpdate} className="mt-2 rounded-lg bg-[var(--ll-yellow)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text-faint)]">
          Update LiberiaLearn
        </button>
      )}
    </div>
  );
}
