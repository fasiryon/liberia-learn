"use client";

import { useState } from "react";

export function CanvaConnectButton({ disabled }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/canva/auth-url");
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Could not start Canva OAuth");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleConnect}
      disabled={disabled || loading}
      className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
    >
      {loading ? "Redirecting…" : "Connect Canva"}
    </button>
  );
}

export function CanvaDisconnectButton() {
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    if (!confirm("Disconnect Canva? This will remove the stored access token.")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/canva/disconnect", { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/admin/settings/canva";
      } else {
        const data = await res.json();
        alert(data.error ?? "Disconnect failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
