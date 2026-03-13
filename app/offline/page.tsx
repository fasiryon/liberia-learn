"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="max-w-sm space-y-5 text-center">
        <h1 className="text-xl font-bold text-slate-50">You are offline.</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          Your work has been saved and will sync when you reconnect.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
