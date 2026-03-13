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
    if (!("serviceWorker" in navigator)) {
      return;
    }

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered");

        if (supportsBackgroundSync(registration)) {
          await registration.sync.register("offline-queue-sync");
        }
      } catch (err) {
        console.warn("SW failed:", err);
      }
    }

    void registerServiceWorker();
  }, []);

  return null;
}
