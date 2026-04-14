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

    let isMounted = true;

    async function registerServiceWorker() {
      try {
        const getRegistration =
          typeof navigator.serviceWorker.getRegistration === "function"
            ? navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker)
            : null;
        const existingRegistration = getRegistration
          ? await getRegistration("/sw.js")
          : null;
        const registration =
          existingRegistration ?? (await navigator.serviceWorker.register("/sw.js"));

        if (!isMounted) return;
        console.log("SW registered");

        if (supportsBackgroundSync(registration)) {
          await registration.sync.register("liberialearn-sync");
        }

        registration.addEventListener?.("updatefound", () => {
          registration.update().catch(() => null);
        });
      } catch (err) {
        console.warn("SW failed:", err);
      }
    }

    void registerServiceWorker();

    const onControllerChange = () => {
      if (!isMounted) return;
      window.dispatchEvent(new CustomEvent("liberialearn:sw-controller-change"));
    };
    navigator.serviceWorker.addEventListener?.("controllerchange", onControllerChange);

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener?.("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
