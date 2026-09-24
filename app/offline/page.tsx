"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4">
      <div className="max-w-sm space-y-5 text-center">
        <h1 className="text-xl font-bold text-[var(--ll-text)]">You are offline.</h1>
        <p className="text-sm leading-relaxed text-[var(--ll-text-muted)]">
          Answers you saved on this device will sync when you reconnect. Anything not yet saved may need to be done again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[var(--ll-yellow)] px-6 py-2.5 text-sm font-semibold text-[var(--ll-bg)] shadow-lg shadow-emerald-500/30 hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
