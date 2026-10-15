import { describe, expect, it } from "vitest";
import { preparedNarration } from "@/components/textbooks/narration.server";
import { buildLessonAudioIntegrity } from "@/lib/audio/lessonAudioIntegrity";
import { selectStudentLessonAudioText } from "@/lib/curriculum/studentLessonProjection";

describe("textbook prepared narration", () => {
  const payload = { body: "Read about equal halves." };
  const integrity = buildLessonAudioIntegrity({ sourceText: selectStudentLessonAudioText(payload), audio: new Uint8Array([1,2,3]) });
  const audio = { status: "GENERATED", contentVersion: "v1", storageUrl: "https://example.test/reading.mp3", audioParts: [{ ...integrity, status: "GENERATED", partNumber: 1, storageUrl: "https://example.test/reading.mp3" }] };
  it("reuses only audio pinned to the current learner text and version", () => {
    expect(preparedNarration(audio, "v1", payload)).toEqual([{ src: audio.storageUrl, label: "Narration part 1" }]);
    expect(preparedNarration(audio, "v2", payload)).toBeUndefined();
    expect(preparedNarration(audio, "v1", { body: "Changed reading" })).toBeUndefined();
  });
  it("rejects unverified, incomplete and unsafe generated assets", () => {
    expect(preparedNarration({ ...audio, audioParts: [] }, "v1", payload)).toBeUndefined();
    expect(preparedNarration({ ...audio, status: "PENDING" }, "v1", payload)).toBeUndefined();
    expect(preparedNarration({ ...audio, audioParts: [{ ...integrity, status: "GENERATED", storageUrl: "javascript:bad" }] }, "v1", payload)).toBeUndefined();
    expect(preparedNarration({ ...audio, audioParts: [{ ...integrity, status: "FAILED", storageUrl: audio.storageUrl }] }, "v1", payload)).toBeUndefined();
  });
});
