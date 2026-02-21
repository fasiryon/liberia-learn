"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AttachDemoSchoolButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAttach() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/attach-demo-school", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      // Refresh the page so the server-side session picks up the new schoolId
      // Need to force a full page reload since the JWT needs to be refreshed
      window.location.href = "/admin";
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleAttach}
        disabled={loading}
        className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50"
      >
        {loading ? "Attaching..." : "Switch to Demo School"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

