"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4">
      <div className="max-w-sm space-y-5 text-center">
        <h1 className="text-xl font-bold text-[var(--ll-text)]">You are offline.</h1>
        <p className="text-sm leading-relaxed text-[var(--ll-text-muted)]">
          Your work has been saved and will sync when you reconnect.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[var(--ll-yellow)] px-6 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/30 hover:bg-[var(--ll-yellow-soft)]"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
