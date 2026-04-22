"use client";

import { useState } from "react";

type ResetState =
  | { kind: "idle"; message: null }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function DemoResetClient() {
  const [isResetting, setIsResetting] = useState(false);
  const [state, setState] = useState<ResetState>({ kind: "idle", message: null });

  async function handleReset() {
    setIsResetting(true);
    setState({ kind: "idle", message: null });

    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to reset demo data");
      }

      setState({
        kind: "success",
        message: `Demo data reset at ${new Date(payload.resetAt).toLocaleString("en-LR")}.`,
      });
    } catch (error: any) {
      setState({
        kind: "error",
        message: error?.message ?? "Failed to reset demo data",
      });
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
      <div className="rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] p-4">
        <p className="text-sm font-semibold text-[var(--ll-yellow)]">Warning</p>
        <p className="mt-1 text-sm text-[var(--ll-yellow)]/80">
          This will delete all activity data for demo schools and re-seed.
        </p>
      </div>

      <button
        type="button"
        onClick={handleReset}
        disabled={isResetting}
        className="inline-flex items-center justify-center rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-[var(--ll-text)] transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isResetting ? "Resetting Demo Data..." : "Reset Demo Data"}
      </button>

      {state.message ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.kind === "success"
              ? "border-emerald-500/30 bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
