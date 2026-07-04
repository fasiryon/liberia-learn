/**
 * __tests__/media/processLesson.test.ts — Phase 4A Deliverable 5 (shared engine)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/media/photoCuration", () => ({ curatePhoto: vi.fn() }));
vi.mock("@/lib/media/generateIllustration", () => ({ generateLessonIllustration: vi.fn() }));
vi.mock("@/lib/media/blobStorage", () => ({
  lessonMediaPath: (a: any) => `lesson-media/${a.lessonId}/${a.kind}.jpg`,
  uploadLessonImage: vi.fn(async ({ path }: any) => `https://blob/${path}`),
}));

import { processLessonMedia } from "@/lib/media/processLesson";
import { curatePhoto } from "@/lib/media/photoCuration";
import { generateLessonIllustration } from "@/lib/media/generateIllustration";

const base = { contentId: "x1", grade: 5, body: "", topics: [] };

beforeEach(() => vi.clearAllMocks());

describe("processLessonMedia", () => {
  it("marks ABSTRACT lessons SKIPPED with no cost and no generation calls", async () => {
    const out = await processLessonMedia({ ...base, title: "Algebra", subject: "MATH" });
    expect(out.status).toBe("SKIPPED");
    expect(out.cost).toBe(0);
    expect(out.update.imageGenerationStatus).toBe("SKIPPED");
    expect(curatePhoto).not.toHaveBeenCalled();
    expect(generateLessonIllustration).not.toHaveBeenCalled();
  });

  it("curates a PHOTO lesson at $0 without calling Fal", async () => {
    (curatePhoto as any).mockResolvedValue({
      imageUrl: "https://cdn/p.jpg",
      provider: "pexels",
      meta: { alt: "x", provider: "pexels", category: "PHOTO", credit: "A", license: "Pexels License" },
    });
    const out = await processLessonMedia({ ...base, title: "Community Life", subject: "CIVICS" });
    expect(out.status).toBe("CURATED");
    expect(out.cost).toBe(0);
    expect(out.provider).toBe("pexels");
    expect(out.update.heroImageUrl).toBe("https://cdn/p.jpg");
    expect(generateLessonIllustration).not.toHaveBeenCalled();
  });

  it("generates a VISUAL hero and inline, uploading to blob and summing cost", async () => {
    (generateLessonIllustration as any).mockResolvedValue({
      ok: true, bytes: Buffer.alloc(5000), contentType: "image/jpeg", prompt: "p", attempts: 1, cost: 0.003,
    });
    const body = "The cell has a nucleus.\n\nThe chloroplast is green.\n\nThe membrane is thin.";
    const out = await processLessonMedia({ ...base, title: "Plant Cell", subject: "SCIENCE", body });
    expect(out.status).toBe("GENERATED");
    expect(out.provider).toBe("fal");
    expect(String(out.update.heroImageUrl)).toContain("blob/lesson-media");
    expect(out.inlineCount).toBeGreaterThanOrEqual(2);
    expect(out.cost).toBeCloseTo(0.003 * (1 + out.inlineCount), 5);
  });

  it("returns FAILED when hero generation is rejected", async () => {
    (generateLessonIllustration as any).mockResolvedValue({ ok: false, bytes: null, reason: "too small", attempts: 2, cost: 0.006 });
    const out = await processLessonMedia({ ...base, title: "Atoms", subject: "CHEMISTRY" });
    expect(out.status).toBe("FAILED");
    expect(out.reason).toContain("too small");
    expect(out.update.imageGenerationStatus).toBe("FAILED");
  });

  it("skips inline generation in heroesOnly mode", async () => {
    (generateLessonIllustration as any).mockResolvedValue({
      ok: true, bytes: Buffer.alloc(5000), contentType: "image/jpeg", prompt: "p", attempts: 1, cost: 0.003,
    });
    const body = "cell nucleus\n\nchloroplast\n\nmembrane";
    const out = await processLessonMedia({ ...base, title: "Cell", subject: "SCIENCE", body }, { heroesOnly: true });
    expect(out.inlineCount).toBe(0);
    expect(generateLessonIllustration).toHaveBeenCalledTimes(1);
  });
});
