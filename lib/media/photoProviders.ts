// Phase 4A — Unsplash + Pexels API clients (free commercial tiers).
// Network-facing; each returns [] gracefully on missing key / error.

export type PhotoCandidate = {
  provider: "unsplash" | "pexels";
  imageUrl: string; // direct image url to fetch/store
  pageUrl: string; // human source page (attribution link)
  credit: string; // photographer name
  creditUrl: string; // photographer profile
  license: string;
  description: string; // alt / description text used for relevance scoring
  width: number;
  /** Unsplash requires pinging this endpoint when an image is used. */
  downloadLocation?: string;
};

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

export async function searchUnsplash(query: string, perPage = 8): Promise<PhotoCandidate[]> {
  const key = env("UNSPLASH_ACCESS_KEY");
  if (!key) return [];
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&per_page=${perPage}&content_filter=high&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    return results
      .filter((r) => r?.urls?.regular)
      .map((r) => ({
        provider: "unsplash" as const,
        imageUrl: r.urls.regular,
        pageUrl: r.links?.html ?? "https://unsplash.com",
        credit: r.user?.name ?? "Unknown",
        creditUrl: r.user?.links?.html ?? "https://unsplash.com",
        license: "Unsplash License",
        description: [r.description, r.alt_description, ...(r.tags ?? []).map((t: any) => t?.title)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        width: Number(r.width) || 0,
        downloadLocation: r.links?.download_location,
      }));
  } catch {
    return [];
  }
}

export async function searchPexels(query: string, perPage = 8): Promise<PhotoCandidate[]> {
  const key = env("PEXELS_API_KEY");
  if (!key) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      query
    )}&per_page=${perPage}&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return [];
    const data: any = await res.json();
    const photos: any[] = Array.isArray(data?.photos) ? data.photos : [];
    return photos
      .filter((p) => p?.src?.large)
      .map((p) => ({
        provider: "pexels" as const,
        imageUrl: p.src.large2x ?? p.src.large,
        pageUrl: p.url ?? "https://pexels.com",
        credit: p.photographer ?? "Unknown",
        creditUrl: p.photographer_url ?? "https://pexels.com",
        license: "Pexels License",
        description: String(p.alt ?? "").toLowerCase(),
        width: Number(p.width) || 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Unsplash API guideline: trigger the download endpoint whenever an image is
 * actually used. Fire-and-forget; never throws.
 */
export async function triggerUnsplashDownload(downloadLocation?: string): Promise<void> {
  const key = env("UNSPLASH_ACCESS_KEY");
  if (!key || !downloadLocation) return;
  try {
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` } });
  } catch {
    /* non-fatal */
  }
}
