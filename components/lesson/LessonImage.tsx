"use client";

// Phase 4A — hero + inline illustration rendering with skeleton loading,
// 404 fallback placeholder, attribution, and low-bandwidth suppression.

import { useEffect, useState } from "react";
import { getLowBandwidthMode, subscribeLowBandwidth } from "@/lib/lowBandwidthMode";

export type HeroImageMetaLike = {
  alt: string;
  caption?: string | null;
  provider: string;
  source?: string | null;
  license?: string | null;
  credit?: string | null;
  category?: string;
};

export type InlineIllustrationLike = {
  position: number | string;
  url: string;
  alt: string;
  caption?: string | null;
  provider: string;
  source?: string | null;
  license?: string | null;
  credit?: string | null;
};

function attributionLine(meta: { provider: string; credit?: string | null }): string | null {
  if (meta.provider === "unsplash") return `Photo by ${meta.credit ?? "Unknown"} on Unsplash`;
  if (meta.provider === "pexels") return `Photo by ${meta.credit ?? "Unknown"} on Pexels`;
  if (meta.provider === "fal") return "AI-generated illustration";
  return null;
}

/** Skeleton + graceful 404 fallback wrapper around a single image. */
function ImageWithStates({
  url,
  alt,
  className,
  aspect,
}: {
  url: string;
  alt: string;
  className?: string;
  aspect: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 text-[var(--ll-text-muted)] ${aspect} ${className ?? ""}`}
      >
        <span className="px-4 text-center text-xs">Illustration unavailable</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${aspect} ${className ?? ""}`}>
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-[var(--ll-border)]/40" aria-hidden="true" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

export function LessonHero({ url, meta }: { url: string; meta: HeroImageMetaLike }) {
  const credit = attributionLine(meta);
  return (
    <figure className="ll-lesson-hero mb-5">
      <ImageWithStates url={url} alt={meta.alt} aspect="aspect-[16/9]" className="w-full" />
      {meta.caption || credit ? (
        <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ll-text-muted)]">
          {meta.caption ? <span className="italic">{meta.caption}</span> : <span />}
          {credit ? (
            <span>
              {meta.source ? (
                <a href={meta.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--ll-text)]">
                  {credit}
                </a>
              ) : (
                credit
              )}
            </span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Inline illustration — suppressed entirely under low-bandwidth mode. */
export function LessonInlineImage({ illustration }: { illustration: InlineIllustrationLike }) {
  const [lowBandwidth, setLowBandwidth] = useState(false);
  useEffect(() => {
    setLowBandwidth(getLowBandwidthMode());
    return subscribeLowBandwidth(setLowBandwidth);
  }, []);

  if (lowBandwidth) return null;
  const credit = attributionLine(illustration);

  return (
    <figure className="ll-inline-illustration my-5 mx-auto max-w-md">
      <ImageWithStates url={illustration.url} alt={illustration.alt} aspect="aspect-[4/3]" className="w-full" />
      {illustration.caption || credit ? (
        <figcaption className="mt-1.5 text-center text-xs text-[var(--ll-text-muted)]">
          {illustration.caption ?? illustration.alt}
          {credit ? <span className="block opacity-80">{credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
