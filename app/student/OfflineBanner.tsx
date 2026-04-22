"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="rounded-xl bg-[var(--ll-yellow-soft)] border border-amber-500/30 px-4 py-2 text-sm text-[var(--ll-yellow)] mb-4">
      You are offline. Your work will be saved and synced when you reconnect.
    </div>
  );
}
