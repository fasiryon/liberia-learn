"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "push_prompt_dismissed_until";
const DISMISS_DAYS = 7;

export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;

    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return;

    const timer = setTimeout(() => setVisible(true), 30_000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
    setVisible(false);
  }

  async function enable() {
    setVisible(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const res = await fetch("/api/notifications/vapid-public-key");
      if (!res.ok) return;
      const { publicKey } = await res.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(sub.getKey("p256dh")!),
            auth: arrayBufferToBase64(sub.getKey("auth")!),
          },
          deviceName: navigator.userAgent.slice(0, 80),
        }),
      });
    } catch {
      // ignore — non-critical
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-sm items-start gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 shadow-lg">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--ll-text)]">Stay up to date</p>
          <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">
            Get notified about grades, assignments, and messages.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={dismiss}
            className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
          >
            Not now
          </button>
          <button
            onClick={enable}
            className="rounded-full bg-[var(--ll-yellow)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text-faint)]"
          >
            Turn on
          </button>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
