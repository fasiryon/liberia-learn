"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  certificationId: string;
  bannerUrl: string | null;
  videoUrl: string | null;
  status: string;
};

export function CertificationAssetsClient({ certificationId, bannerUrl, videoUrl, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<"banner" | "video" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateAssets() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/certifications/generate-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Asset generation failed");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Asset generation failed");
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = status !== "processing" && !loading;

  return (
    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--ll-text)]">Pathway Media Assets</h2>
          <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Status: {loading ? "pending" : status}</p>
        </div>
        <button
          type="button"
          onClick={generateAssets}
          disabled={!canGenerate}
          className="rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90 disabled:opacity-60"
        >
          {status === "failed" ? "Retry Banner + Video" : loading ? "Generating..." : "Generate Banner + Video"}
        </button>
      </div>
      {error ? <p className="mt-3 text-xs text-[var(--ll-danger)]">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {bannerUrl ? (
          <button type="button" onClick={() => setPreview("banner")} className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)]">
            Preview banner
          </button>
        ) : null}
        {videoUrl ? (
          <button type="button" onClick={() => setPreview("video")} className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)]">
            Preview video
          </button>
        ) : null}
      </div>
      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-3xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-4" onClick={(event) => event.stopPropagation()}>
            {preview === "banner" && bannerUrl ? (
              <iframe title="Certification banner" src={bannerUrl} className="h-[70vh] w-full rounded-lg border border-[var(--ll-border)]" />
            ) : null}
            {preview === "video" && videoUrl ? (
              <video src={videoUrl} controls className="max-h-[70vh] w-full rounded-lg" />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
