import { describe, expect, it, vi } from "vitest";
import {
  persistLessonMode,
  readPersistedLessonMode,
  trackLessonModeChanged,
} from "@/app/student/lessons/[id]/LessonDeliveryClient";

describe("lesson mode persistence", () => {
  it("persists selected mode to localStorage", () => {
    const storage = { setItem: vi.fn() };
    persistLessonMode(storage, "slides");
    expect(storage.setItem).toHaveBeenCalledWith("lesson_mode", "slides");
  });

  it("reads only valid persisted modes", () => {
    expect(readPersistedLessonMode({ getItem: () => "listen" })).toBe("listen");
    expect(readPersistedLessonMode({ getItem: () => "bad" })).toBe("read");
  });

  it("logs mode changes through the learning event endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await trackLessonModeChanged(fetcher as unknown as typeof fetch, {
      contentId: "content-1",
      lessonId: "work-1",
      mode: "slides",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/track",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("LESSON_MODE_CHANGED"),
      })
    );
    expect(fetcher.mock.calls[0][1].body).toContain('"mode":"slides"');
  });
});
