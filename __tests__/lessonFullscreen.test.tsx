import fs from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LessonFullscreenButton } from "@/components/lesson/LessonFullscreenButton";
import {
  addFullscreenChangeListener,
  exitLessonFullscreen,
  getFullscreenElement,
  isElementFullscreen,
  requestLessonFullscreen,
} from "@/lib/lesson/fullscreen";

function repoFile(filePath: string) {
  return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

describe("lesson fullscreen controls", () => {
  it("renders the fullscreen toggle button", () => {
    const html = renderToString(
      <LessonFullscreenButton targetRef={{ current: null }} />
    );

    expect(html).toContain("View slides fullscreen");
    expect(html).toContain("Fullscreen");
  });

  it("requests fullscreen on the slide container when the standard API exists", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const element = { requestFullscreen } as unknown as HTMLElement;
    const doc = { documentElement: {} } as Document;

    await requestLessonFullscreen(element, doc);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("uses the WebKit-prefixed request path for Safari fallback", async () => {
    const webkitRequestFullscreen = vi.fn().mockResolvedValue(undefined);
    const element = { webkitRequestFullscreen } as unknown as HTMLElement;
    const doc = { documentElement: {} } as Document;

    await requestLessonFullscreen(element, doc);

    expect(webkitRequestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("falls back to the document element only when the slide container has no fullscreen API", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const element = {} as HTMLElement;
    const doc = {
      documentElement: { requestFullscreen },
    } as unknown as Document;

    await requestLessonFullscreen(element, doc);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("exits fullscreen through standard and WebKit document APIs", async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    await exitLessonFullscreen({ exitFullscreen } as unknown as Document);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);

    const webkitExitFullscreen = vi.fn().mockResolvedValue(undefined);
    await exitLessonFullscreen({ webkitExitFullscreen } as unknown as Document);
    expect(webkitExitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("reads standard and WebKit fullscreen state", () => {
    const element = {} as Element;

    expect(getFullscreenElement({ fullscreenElement: element } as unknown as Document)).toBe(element);
    expect(getFullscreenElement({ webkitFullscreenElement: element } as unknown as Document)).toBe(element);
    expect(isElementFullscreen(element as HTMLElement, { fullscreenElement: element } as unknown as Document)).toBe(true);
  });

  it("listens for standard and WebKit fullscreenchange events and cleans them up", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const doc = { addEventListener, removeEventListener } as unknown as Document;
    const listener = vi.fn();

    const cleanup = addFullscreenChangeListener(doc, listener);

    expect(addEventListener).toHaveBeenCalledWith("fullscreenchange", listener);
    expect(addEventListener).toHaveBeenCalledWith("webkitfullscreenchange", listener);

    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith("fullscreenchange", listener);
    expect(removeEventListener).toHaveBeenCalledWith("webkitfullscreenchange", listener);
  });

  it("wires the shared fullscreen button into student and teacher slide viewers", () => {
    const scheduledLesson = repoFile("app/student/lessons/[id]/LessonDeliveryClient.tsx");
    expect(scheduledLesson).toContain("LessonFullscreenButton");
    expect(scheduledLesson).toContain("goToAssessmentFromSlides");
    expect(scheduledLesson).toContain("exitLessonFullscreen");
    expect(repoFile("app/student/lesson/[contentId]/page.tsx")).toContain("LessonFullscreenButton");
    expect(repoFile("app/teacher/lesson/[contentId]/TeacherLessonViewClient.tsx")).toContain("LessonFullscreenButton");
    expect(repoFile("app/globals.css")).toContain(".ll-slide-fullscreen:fullscreen");
  });
});
