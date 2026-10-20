import { isLessonAudioIntegrityCurrent } from "@/lib/audio/lessonAudioIntegrity";
import { selectStudentLessonAudioText } from "@/lib/curriculum/studentLessonProjection";
import { safeAssetUrl } from "./model";

/** Existing generated lesson audio only, pinned to the authorized text and content version. */
export function preparedNarration(audio: { status: string; contentVersion: string; storageUrl?: string | null; audioParts?: unknown } | null | undefined, version: string, payload: unknown) {
  const text = selectStudentLessonAudioText(payload);
  if (!audio || !text || audio.status !== "GENERATED" || audio.contentVersion !== version || !isLessonAudioIntegrityCurrent(audio.audioParts, text)) return undefined;
  const parts = Array.isArray(audio.audioParts) ? audio.audioParts.filter(p => p && typeof p === "object" && typeof p.storageUrl === "string") : [];
  if (parts.length) {
    if (parts.some(p => p.status !== "GENERATED" || !safeAssetUrl(p.storageUrl))) return undefined;
    return parts.slice().sort((a,b) => Number(a.partNumber ?? 0) - Number(b.partNumber ?? 0)).map((p,i) => ({ src: safeAssetUrl(p.storageUrl)!, label: `Narration part ${i + 1}` }));
  }
  const src = audio.storageUrl ? safeAssetUrl(audio.storageUrl) : undefined;
  return src ? [{ src, label: "Full reading narration" }] : undefined;
}
