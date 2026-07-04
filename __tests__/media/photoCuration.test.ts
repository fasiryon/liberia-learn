/**
 * __tests__/media/photoCuration.test.ts — Phase 4A Deliverable 2
 * Keyword derivation, candidate ranking, attribution, provider degradation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deriveSearchQuery, keywordTokens } from "@/lib/media/keywords";
import { rankCandidates, attributionLine, curatePhoto } from "@/lib/media/photoCuration";
import type { PhotoCandidate } from "@/lib/media/photoProviders";

describe("keywordTokens / deriveSearchQuery", () => {
  it("strips stopwords and lesson boilerplate", () => {
    const tokens = keywordTokens({ title: "Introduction to the Water Cycle" });
    expect(tokens).toContain("water");
    expect(tokens).toContain("cycle");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("introduction");
  });

  it("adds Liberian/West African context bias for civics", () => {
    const q = deriveSearchQuery({ title: "The Role of Local Government", subject: "CIVICS" });
    expect(q.toLowerCase()).toContain("government");
    expect(q.toLowerCase()).toContain("liberia");
  });

  it("falls back to subject when title has no usable tokens", () => {
    const q = deriveSearchQuery({ title: "The A An", subject: "SCIENCE" });
    expect(q.length).toBeGreaterThan(0);
  });
});

function cand(over: Partial<PhotoCandidate>): PhotoCandidate {
  return {
    provider: "unsplash",
    imageUrl: "https://img/x.jpg",
    pageUrl: "https://unsplash.com/p/x",
    credit: "Jane Doe",
    creditUrl: "https://unsplash.com/@jane",
    license: "Unsplash License",
    description: "",
    width: 3000,
    ...over,
  };
}

describe("rankCandidates", () => {
  it("ranks higher keyword overlap first", () => {
    const tokens = ["water", "cycle", "rain"];
    const ranked = rankCandidates(
      [
        cand({ description: "a cat sleeping", width: 4000 }),
        cand({ description: "the water cycle rain clouds", width: 2000 }),
      ],
      tokens
    );
    expect(ranked[0].description).toContain("water");
  });

  it("uses resolution as a tiebreaker when overlap is equal", () => {
    const ranked = rankCandidates(
      [cand({ description: "unrelated", width: 1000 }), cand({ description: "unrelated", width: 4000 })],
      ["water"]
    );
    expect(ranked[0].width).toBe(4000);
  });
});

describe("attributionLine", () => {
  it("formats Unsplash and Pexels credits", () => {
    expect(attributionLine({ provider: "unsplash", credit: "Ada L" })).toBe("Photo by Ada L on Unsplash");
    expect(attributionLine({ provider: "pexels", credit: "Bo K" })).toBe("Photo by Bo K on Pexels");
    expect(attributionLine({ provider: "fal", credit: null })).toBeNull();
  });
});

describe("curatePhoto degradation", () => {
  const origFetch = global.fetch;
  beforeEach(() => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.PEXELS_API_KEY;
  });
  afterEach(() => {
    global.fetch = origFetch;
  });

  it("returns null when no provider keys are configured", async () => {
    const result = await curatePhoto({ title: "Community Life", subject: "CIVICS" });
    expect(result).toBeNull();
  });

  it("selects and attributes the top candidate from a live-shaped response", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    global.fetch = vi.fn(async (url: any) => {
      if (String(url).includes("api.unsplash.com")) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                urls: { regular: "https://images.unsplash.com/photo1" },
                links: { html: "https://unsplash.com/p/1", download_location: "https://api.unsplash.com/dl/1" },
                user: { name: "Kofi A", links: { html: "https://unsplash.com/@kofi" } },
                width: 4000,
                alt_description: "market community in liberia",
                tags: [{ title: "community" }, { title: "market" }],
              },
            ],
          }),
        } as any;
      }
      return { ok: true, json: async () => ({ dl: 1 }) } as any; // download trigger
    }) as any;

    const result = await curatePhoto({ title: "Community Market Life", subject: "CIVICS" });
    expect(result).not.toBeNull();
    expect(result!.provider).toBe("unsplash");
    expect(result!.meta.credit).toBe("Kofi A");
    expect(result!.meta.license).toBe("Unsplash License");
    expect(result!.meta.category).toBe("PHOTO");
    expect(attributionLine(result!.meta)).toBe("Photo by Kofi A on Unsplash");
  });
});
