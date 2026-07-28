"use client";

import { loadCachedLesson } from "@/lib/lesson-offline-cache";
import {
  buildAudioOnlyFallback,
  buildPrintableWorksheet,
  type AudioOnlyFallback,
  type PrintableWorksheet,
} from "@/lib/teaching/recovery";

export async function getAudioOnlyFallback(
  contentId: string
): Promise<AudioOnlyFallback | null> {
  const cached = await loadCachedLesson(contentId);
  return cached ? buildAudioOnlyFallback(cached) : null;
}

export async function getPrintableWorksheet(
  contentId: string
): Promise<PrintableWorksheet | null> {
  const cached = await loadCachedLesson(contentId);
  return cached ? buildPrintableWorksheet(cached) : null;
}
