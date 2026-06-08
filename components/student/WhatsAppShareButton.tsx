"use client";

import { useState } from "react";

export default function WhatsAppShareButton({ certificateId }: { certificateId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/certificates/${certificateId}/share`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = await res.json() as { whatsappText: string };
      window.open(
        `https://wa.me/?text=${encodeURIComponent(data.whatsappText)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-colors hover:opacity-90 disabled:opacity-60"
    >
      {loading ? "Opening…" : "Share to WhatsApp"}
    </button>
  );
}
