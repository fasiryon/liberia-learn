"use client";

import { useEffect, useRef, useState } from "react";

const DISMISSED_KEY = "pwa_dismissed_at";
const INSTALLED_KEY = "pwa_installed";
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 30_000;

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const promptRef = useRef<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(INSTALLED_KEY) === "true") return;
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    let timer: ReturnType<typeof setTimeout>;

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      promptRef.current = event as typeof promptRef.current;
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  async function handleInstall() {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "true");
    } else {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-4 shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:rounded-xl sm:border">
      <p className="text-sm text-[var(--ll-text)]">
        📲 Add LiberiaLearn to your home screen for offline access
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="flex-1 rounded-lg bg-[var(--ll-yellow)] py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
        >
          Add to Home Screen
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text-muted)]"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
