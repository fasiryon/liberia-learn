import { describe, expect, it } from "vitest";
import { summarizeAudioCoverage } from "@/lib/audio/audioCoverage";
import { buildLessonAudioIntegrity } from "@/lib/audio/lessonAudioIntegrity";

function lesson(overrides: Record<string, unknown> = {}) {
  const payload = { body: "Learner lesson text." };
  return {
    contentId: "lesson-1",
    grade: 5,
    subject: "ENGLISH",
    version: "v1",
    payload,
    audioAssets: [{
      status: "GENERATED",
      contentVersion: "v1",
      audioParts: [{
        partNumber: 1,
        status: "GENERATED",
        charLength: payload.body.length,
        ...buildLessonAudioIntegrity({ sourceText: payload.body, audio: Buffer.from("mp3") }),
      }],
    }],
    ...overrides,
  };
}

describe("NR-14 audio coverage", () => {
  it("counts only current, integrity-verified audio as ready", () => {
    const result = summarizeAudioCoverage([
      lesson(),
      lesson({ contentId: "stale", audioAssets: [{ status: "GENERATED", contentVersion: "v1", audioParts: [] }] }),
      lesson({ contentId: "failed", audioAssets: [{ status: "FAILED", contentVersion: "v1", audioParts: [] }] }),
      lesson({ contentId: "missing", audioAssets: [] }),
      lesson({ contentId: "opted-out", payload: { body: "Learner lesson text.", audioOptOut: true }, audioAssets: [] }),
    ]);

    expect(result).toEqual({ eligible: 4, ready: 1, missing: 1, stale: 1, failed: 1, optedOut: 1, excluded: 0 });
  });

  it("treats a changed learner source as stale", () => {
    const current = lesson();
    current.payload = { body: "Changed learner lesson text." };
    expect(summarizeAudioCoverage([current])).toMatchObject({ eligible: 1, stale: 1, ready: 0 });
  });

  it("does not treat metadata without an asset hash as ready", () => {
    const current = lesson();
    current.audioAssets[0].audioParts = [{
      partNumber: 1,
      status: "GENERATED",
      charLength: 20,
      sourceTextHash: "anything",
      language: "en",
      format: "mp3",
      generatorVersion: "nr14-2026.1",
    }];
    expect(summarizeAudioCoverage([current])).toMatchObject({ eligible: 1, stale: 1, ready: 0 });
  });
});
