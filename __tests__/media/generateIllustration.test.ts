/**
 * __tests__/media/generateIllustration.test.ts — Phase 4A Deliverable 3
 * Style prompts, Fal client, quality gates, retry-once orchestration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildIllustrationPrompt, styleForBand } from "@/lib/media/stylePrompts";
import { structuralGate, isVisionQAEnabled } from "@/lib/media/imageQA";
import { generateFalImage, FalGenerationError } from "@/lib/media/falClient";
import { generateLessonIllustration } from "@/lib/media/generateIllustration";

describe("buildIllustrationPrompt", () => {
  it("applies K-3 cartoon style and bans text/people", () => {
    const p = buildIllustrationPrompt({ subjectFocus: "a plant cell", subject: "SCIENCE", band: "K-3" });
    expect(p).toContain("cartoon");
    expect(p).toContain("no text");
    expect(p).toContain("no human faces");
    expect(p).toContain("a plant cell");
  });

  it("applies 9-12 scientific diagram style", () => {
    const p = buildIllustrationPrompt({ subjectFocus: "the heart", subject: "BIOLOGY", band: "9-12", isDiagram: true });
    expect(p).toContain("scientific diagram");
    expect(styleForBand("9-12")).toContain("scientific diagram");
  });

  it("simplifies the prompt on retry", () => {
    const p = buildIllustrationPrompt({ subjectFocus: "atom", subject: "CHEMISTRY", band: "4-8", retry: true });
    expect(p).toContain("single clear subject");
  });
});

describe("structuralGate", () => {
  it("rejects tiny buffers and accepts real ones", () => {
    expect(structuralGate(Buffer.alloc(100)).ok).toBe(false);
    expect(structuralGate(Buffer.alloc(5000)).ok).toBe(true);
  });
});

describe("isVisionQAEnabled", () => {
  it("is off unless MEDIA_VISION_QA=1 and OPENAI key present", () => {
    delete process.env.MEDIA_VISION_QA;
    expect(isVisionQAEnabled()).toBe(false);
  });
});

describe("generateFalImage", () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
    delete process.env.FAL_KEY;
  });

  it("throws when FAL_KEY is missing", async () => {
    delete process.env.FAL_KEY;
    await expect(generateFalImage({ prompt: "x" })).rejects.toBeInstanceOf(FalGenerationError);
  });

  it("posts to the schnell endpoint and parses the image url", async () => {
    process.env.FAL_KEY = "k";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ images: [{ url: "https://fal/img.jpg", content_type: "image/jpeg" }] }),
    })) as any;
    global.fetch = fetchMock;
    const r = await generateFalImage({ prompt: "a cell" });
    expect(r.url).toBe("https://fal/img.jpg");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("fal-ai/flux/schnell");
    expect(opts.headers.Authorization).toBe("Key k");
  });
});

describe("generateLessonIllustration", () => {
  const origFetch = global.fetch;
  beforeEach(() => {
    process.env.FAL_KEY = "k";
    delete process.env.MEDIA_VISION_QA;
  });
  afterEach(() => {
    global.fetch = origFetch;
    delete process.env.FAL_KEY;
  });

  it("returns bytes and cost on first-attempt success", async () => {
    global.fetch = vi.fn(async (url: any) => {
      if (String(url).includes("fal.run")) {
        return { ok: true, json: async () => ({ images: [{ url: "https://fal/i.jpg", content_type: "image/jpeg" }] }) } as any;
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array(5000).buffer } as any;
    }) as any;
    const r = await generateLessonIllustration({ subjectFocus: "a leaf", subject: "SCIENCE", band: "4-8" });
    expect(r.bytes).not.toBeNull();
    expect(r.attempts).toBe(1);
    expect(r.cost).toBeGreaterThan(0);
  });

  it("retries once then rejects when the image is always broken", async () => {
    global.fetch = vi.fn(async (url: any) => {
      if (String(url).includes("fal.run")) {
        return { ok: true, json: async () => ({ images: [{ url: "https://fal/i.jpg", content_type: "image/jpeg" }] }) } as any;
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array(100).buffer } as any; // too small
    }) as any;
    const r = await generateLessonIllustration({ subjectFocus: "a leaf", subject: "SCIENCE", band: "4-8" });
    expect(r.bytes).toBeNull();
    expect(r.attempts).toBe(2);
    expect((r as any).reason).toContain("too small");
    expect(r.cost).toBeCloseTo(0.006, 5); // two billed attempts
  });
});
