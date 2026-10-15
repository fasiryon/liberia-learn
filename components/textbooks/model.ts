import type { LessonExperience } from "@/lib/learner-experience/types";

export type BookPage = { title: string; chapter: string; body: string; image?: { src: string; alt: string }; reveals?: { label: string; text: string }[]; explorer?: boolean; citrus?: boolean };
export type ReadingBook = { id: string; version: string; title: string; subject: string; grade: number; source: "demonstration" | "authorized-reading"; pages: BookPage[]; narration?: { src: string; label: string }[] };

/** Presentation pagination only. No completion, assessment or publication state. */
export function paginateText(body: string, wordsPerPage = 180): string[] {
  if (!body.trim()) return [];
  const words = body.trim().split(/\s+/);
  // Split only overlong paragraphs, retaining markdown and all source text.
  if (words.length <= wordsPerPage) return [body.trim()];
  const pages: string[] = [];
  let pending = "";
  for (const paragraph of body.trim().split(/\n\s*\n/)) {
    if ((pending + " " + paragraph).trim().split(/\s+/).length > wordsPerPage && pending) { pages.push(pending); pending = ""; }
    if (paragraph.split(/\s+/).length > wordsPerPage) {
      const tokens = paragraph.split(/\s+/);
      for (let i = 0; i < tokens.length; i += wordsPerPage) pages.push(tokens.slice(i, i + wordsPerPage).join(" "));
    } else pending = pending ? pending + "\n\n" + paragraph : paragraph;
  }
  if (pending) pages.push(pending);
  return pages;
}

export function safeAssetUrl(value: string): string | undefined {
  if (/[\\\u0000-\u0020]/.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { return new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
}

/** Input must already have passed the shared learner-safe projection on the server. */
export function readingPages(projected: Record<string, unknown>, title: string, grade: number): BookPage[] {
  const experience = projected.lessonExperience as LessonExperience | undefined;
  if (experience?.scenes) return experience.scenes.flatMap(scene => {
    const band = grade <= 3 ? "EARLY_PRIMARY" : grade <= 6 ? "UPPER_PRIMARY" : grade <= 9 ? "JUNIOR_SECONDARY" : "SENIOR_SECONDARY";
    const body = scene.content.ageVariants?.[band]?.body ?? scene.content.body;
    const image = scene.media?.find(m => m.kind === "IMAGE" || m.kind === "DIAGRAM");
    const parts = paginateText(body);
    return (parts.length ? parts : [""]).map((part, index) => ({ title: scene.title, chapter: scene.title, body: part,
      ...(index === 0 && image ? { image: { src: safeAssetUrl(image.ref) ?? "", alt: image.alt } } : {}),
      ...(index === 0 && scene.interaction.kind === "DIAGRAM_REVEAL" ? { reveals: scene.interaction.steps.map(step => ({ label: step.label, text: step.description })) } : {}),
    }));
  });
  const body = [projected.body_standard, projected.body, projected.body_block].find(v => typeof v === "string" && v.trim());
  return typeof body === "string" ? paginateText(body).map((part, index) => ({ title: index === 0 ? title : "Continue reading", chapter: title, body: part })) : [];
}

export type ReaderMemory = { page: number; bookmarks: number[]; size: number; layout: "spread" | "single" };
export function readMemory(raw: string | null, count: number): ReaderMemory {
  const fallback: ReaderMemory = { page: 0, bookmarks: [], size: 1, layout: "spread" };
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return fallback;
    const page = Number.isInteger(value.page) && value.page >= 0 && value.page < count ? value.page : 0;
    return { page, bookmarks: Array.isArray(value.bookmarks) ? [...new Set<number>(value.bookmarks.filter((p: unknown) => typeof p === "number" && Number.isInteger(p) && p >= 0 && p < count))] : [],
      size: [1, 1.15, 1.3].includes(value.size) ? value.size : 1, layout: value.layout === "single" ? "single" : "spread" };
  } catch { return fallback; }
}
