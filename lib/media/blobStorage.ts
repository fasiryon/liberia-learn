// Phase 4A — Vercel Blob storage for lesson media (private bucket + signed URLs).
// Mirrors the pattern used by lesson video upload: store the private blob url,
// then generate a short-lived signed downloadUrl at serve time via head().

import type { HeroImageMeta, InlineIllustration } from "./types";

export const LESSON_MEDIA_PREFIX = "lesson-media";

function sanitizeSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/\.{2,}/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || "media"
  );
}

export function lessonMediaPath(input: {
  lessonId: string;
  kind: "hero" | "inline";
  index?: number;
  ext?: string;
}): string {
  const ext = (input.ext || "webp").replace(/[^a-z0-9]/gi, "");
  const id = sanitizeSegment(input.lessonId);
  if (input.kind === "hero") {
    return `${LESSON_MEDIA_PREFIX}/${id}/hero.${ext}`;
  }
  return `${LESSON_MEDIA_PREFIX}/${id}/inline-${input.index ?? 0}.${ext}`;
}

/** Upload an image buffer to the private blob bucket; returns the canonical blob url. */
export async function uploadLessonImage(input: {
  path: string;
  data: Buffer | Uint8Array | ArrayBuffer;
  contentType?: string;
}): Promise<string> {
  const { put } = await import("@vercel/blob");
  const body: Buffer =
    input.data instanceof ArrayBuffer ? Buffer.from(input.data) : Buffer.from(input.data as Uint8Array);
  const blob = await put(input.path, body, {
    access: "private",
    contentType: input.contentType || "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

/**
 * Resolve a stored private blob url into a signed, time-limited download url.
 * Degrades gracefully: on any error (missing blob, no token), returns the input url.
 */
export async function signMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const { head } = await import("@vercel/blob");
    const meta = await head(url);
    return meta.downloadUrl;
  } catch {
    return url;
  }
}

/** Sign a hero image field for delivery. */
export async function signHero(
  heroImageUrl: string | null | undefined,
  meta: HeroImageMeta | null | undefined
): Promise<{ url: string; meta: HeroImageMeta } | null> {
  if (!heroImageUrl || !meta) return null;
  const signed = await signMediaUrl(heroImageUrl);
  if (!signed) return null;
  return { url: signed, meta };
}

/** Sign every inline illustration url for delivery. */
export async function signInlineIllustrations(
  illustrations: InlineIllustration[] | null | undefined
): Promise<InlineIllustration[]> {
  if (!Array.isArray(illustrations) || illustrations.length === 0) return [];
  return Promise.all(
    illustrations.map(async (ill) => ({
      ...ill,
      url: (await signMediaUrl(ill.url)) ?? ill.url,
    }))
  );
}
