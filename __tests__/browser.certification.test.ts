import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  clearExamSession,
  parsePersistedExamSession,
  persistExamSession,
} from "@/app/student/exams/[examId]/StudentExamSessionClient";
import {
  clearLessonProgressState,
  parseLessonProgressState,
  persistLessonProgressState,
} from "@/app/student/lessons/[id]/LessonDeliveryClient";

const swPath = path.join(process.cwd(), "public", "sw.js");

describe("browser certification", () => {
  it("service worker bypasses api routes, caches lesson pages, and serves offline fallback", () => {
    const sw = fs.readFileSync(swPath, "utf8");
    expect(sw).toContain('pathname.startsWith("/api/")');
    expect(sw).toContain("isLessonPage(url.pathname)");
    expect(sw).toContain("staleWhileRevalidate(event.request, CONTENT_CACHE)");
    expect(sw).toContain('caches.match("/offline.html")');
  });

  it("exam session helpers save, restore, and clear state", () => {
    const storage = {
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    persistExamSession(storage, "exam-key", {
      answers: [1, 2, 3],
      currentIndex: 2,
      startedAt: "2026-04-01T10:00:00.000Z",
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      "exam-key",
      JSON.stringify({
        answers: [1, 2, 3],
        currentIndex: 2,
        startedAt: "2026-04-01T10:00:00.000Z",
      })
    );

    expect(
      parsePersistedExamSession(
        JSON.stringify({
          answers: [1, 2, 3],
          currentIndex: 2,
          startedAt: "2026-04-01T10:00:00.000Z",
        })
      )
    ).toEqual({
      answers: [1, 2, 3],
      currentIndex: 2,
      startedAt: "2026-04-01T10:00:00.000Z",
    });

    clearExamSession(storage, "exam-key");
    expect(storage.removeItem).toHaveBeenCalledWith("exam-key");
  });

  it("lesson progress helpers save, restore, and clear scroll state", () => {
    const storage = {
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    persistLessonProgressState(storage, "lesson-key", {
      scrollPosition: 480,
      lastReadSection: "exit-ticket",
    });

    expect(storage.setItem).toHaveBeenCalledWith(
      "lesson-key",
      JSON.stringify({
        scrollPosition: 480,
        lastReadSection: "exit-ticket",
      })
    );

    expect(
      parseLessonProgressState(
        JSON.stringify({
          scrollPosition: 480,
          lastReadSection: "exit-ticket",
        })
      )
    ).toEqual({
      scrollPosition: 480,
      lastReadSection: "exit-ticket",
    });

    clearLessonProgressState(storage, "lesson-key");
    expect(storage.removeItem).toHaveBeenCalledWith("lesson-key");
  });
});
