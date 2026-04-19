"use client";

import { useEffect } from "react";
import type { TextbookResult } from "@/lib/ai/textbook/textbookCompiler";

export default function TextbookOfflineCache({
  cacheKey,
  textbook,
}: {
  cacheKey: string;
  textbook: TextbookResult;
}) {
  useEffect(() => {
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({ cachedAt: new Date().toISOString(), textbook })
      );
    } catch {
      // Local cache is best-effort for offline reading.
    }
  }, [cacheKey, textbook]);

  return null;
}
