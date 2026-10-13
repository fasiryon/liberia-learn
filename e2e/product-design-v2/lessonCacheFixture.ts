export * from "../../lib/lesson-offline-cache";
import { loadCachedLesson as loadReal } from "../../lib/lesson-offline-cache";
/** Synthetic cache admission for browser presentation tests only. Never included in the production bundle. */
export async function loadCachedLesson(contentId: string) {
  const fixture = (window as unknown as { __lessonCacheFixture?: { contentId: string; lesson: unknown } }).__lessonCacheFixture;
  return fixture?.contentId === contentId ? fixture.lesson as Awaited<ReturnType<typeof loadReal>> : loadReal(contentId);
}
