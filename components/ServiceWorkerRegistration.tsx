"use client";

import { useEffect } from "react";

type SyncCapableServiceWorkerRegistration = ServiceWorkerRegistration & {
  sync: {
    register(tag: string): Promise<void>;
  };
};

function supportsBackgroundSync(
  registration: ServiceWorkerRegistration
): registration is SyncCapableServiceWorkerRegistration {
  return "sync" in registration;
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const browserWindow = typeof window === "undefined" ? null : window;
    const dispatchState = (state: string, registration?: ServiceWorkerRegistration) => {
      if (!browserWindow || typeof CustomEvent === "undefined") return;
      browserWindow.dispatchEvent(new CustomEvent("liberialearn-pwa-state", {
        detail: { state, registration },
      }));
    };

    if (!("serviceWorker" in navigator)) {
      dispatchState("unsupported");
      return;
    }

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
        dispatchState("ready", registration);

        const announceUpdate = () => {
          if (!registration.waiting || !browserWindow || typeof CustomEvent === "undefined") return;
          browserWindow.dispatchEvent(new CustomEvent("liberialearn-pwa-update-available", {
            detail: { registration },
          }));
        };

        if (typeof registration.addEventListener === "function") {
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed") announceUpdate();
            });
          });
        }
        announceUpdate();
        browserWindow?.addEventListener("online", announceUpdate);
        // Update checks piggyback on the learner returning to the app instead
        // of a background timer: a visible tab checks at most every 30 min.
        let lastUpdateCheck = Date.now();
        const checkForUpdate = () => {
          if (browserWindow?.document?.visibilityState !== "visible" || !navigator.onLine) return;
          if (Date.now() - lastUpdateCheck < 30 * 60 * 1000) return;
          lastUpdateCheck = Date.now();
          registration.update().catch(() => null);
        };
        browserWindow?.document?.addEventListener("visibilitychange", checkForUpdate);

        if (supportsBackgroundSync(registration)) {
          await registration.sync.register("liberialearn-sync").catch(() => null);
        }

        return () => {
          browserWindow?.removeEventListener("online", announceUpdate);
          browserWindow?.document?.removeEventListener("visibilitychange", checkForUpdate);
        };
      } catch (err) {
        dispatchState("install-failed");
        console.warn("Service worker registration failed", err);
      }
    }

    let cleanup: (() => void) | undefined;
    void registerServiceWorker().then((value) => { cleanup = value; });
    return () => cleanup?.();
  }, []);

  return null;
}
