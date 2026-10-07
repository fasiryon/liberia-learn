"use client";

import { useEffect } from "react";

/**
 * While a fixed bottom bar is shown on phones, reserve its height: page content
 * (including the layout's legal footer) pads above it and global status toasts
 * lift above it via --ll-fixed-footer.
 */
export function ReserveBottomBar({ height, query = "(max-width: 639px)" }: { height: string; query?: string }) {
  useEffect(() => {
    const media = window.matchMedia?.(query);
    const root = document.documentElement;
    const apply = () => {
      if (media?.matches) {
        root.style.setProperty("--ll-fixed-footer", height);
        document.body.style.paddingBottom = height;
      } else {
        root.style.removeProperty("--ll-fixed-footer");
        document.body.style.paddingBottom = "";
      }
    };
    apply();
    media?.addEventListener("change", apply);
    return () => {
      media?.removeEventListener("change", apply);
      root.style.removeProperty("--ll-fixed-footer");
      document.body.style.paddingBottom = "";
    };
  }, [height, query]);
  return null;
}
