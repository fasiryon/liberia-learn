import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAudioOnlyFallback,
  buildPrintableWorksheet,
} from "@/lib/teaching/recovery";

const { mockLoadCachedLesson } = vi.hoisted(() => ({
  mockLoadCachedLesson: vi.fn(),
}));

vi.mock("@/lib/lesson-offline-cache", () => ({
  loadCachedLesson: mockLoadCachedLesson,
}));

import {
  getAudioOnlyFallback,
  getPrintableWorksheet,
} from "@/lib/teaching/recovery.client";

beforeEach(() => {
  mockLoadCachedLesson.mockReset();
});

describe("recovery formatters", () => {
  it("builds audio-only material from an already cached lesson", () => {
    expect(
      buildAudioOnlyFallback({
        metadata: { contentId: "c1" },
        payload: { body: "Fractions are parts of a whole." },
        audio: { storageUrl: "https://cdn.example.com/audio.mp3" },
      })
    ).toEqual({
      narration: "Fractions are parts of a whole.",
      audioUrl: "https://cdn.example.com/audio.mp3",
    });
  });

  it("builds a printable structure from cached lesson content", () => {
    const worksheet = buildPrintableWorksheet({
      metadata: { contentId: "c1" },
      payload: {
        title: "Fractions",
        objectives: ["Understand fractions"],
        body: "Fractions are parts of a whole.",
      },
      audio: null,
    });

    expect(worksheet.title).toBe("Fractions");
    expect(worksheet.objectives).toEqual(["Understand fractions"]);
    expect(worksheet.sections.length).toBeGreaterThan(0);
  });
});

describe("client recovery cache adapter", () => {
  it("reads audio-only material from the browser lesson cache", async () => {
    mockLoadCachedLesson.mockResolvedValue({
      metadata: { contentId: "c1" },
      payload: { body: "Fractions are parts of a whole." },
      audio: null,
    });

    await expect(getAudioOnlyFallback("c1")).resolves.toEqual({
      narration: "Fractions are parts of a whole.",
      audioUrl: null,
    });
    expect(mockLoadCachedLesson).toHaveBeenCalledWith("c1");
  });

  it("reads printable material from the browser lesson cache", async () => {
    mockLoadCachedLesson.mockResolvedValue({
      metadata: { contentId: "c1" },
      payload: {
        title: "Fractions",
        objectives: ["Understand fractions"],
        body: "Fractions are parts of a whole.",
      },
      audio: null,
    });

    const worksheet = await getPrintableWorksheet("c1");
    expect(worksheet?.title).toBe("Fractions");
  });

  it("returns null when the device has no cached lesson", async () => {
    mockLoadCachedLesson.mockResolvedValue(null);
    await expect(getAudioOnlyFallback("missing")).resolves.toBeNull();
    await expect(getPrintableWorksheet("missing")).resolves.toBeNull();
  });
});
