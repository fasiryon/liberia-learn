"use client";

import { useEffect } from "react";
import {
  applyLowBandwidthAttribute,
  readLowBandwidthPreference,
  resolveLowBandwidthMode,
} from "@/lib/lowBandwidthMode";

type NavigatorConnection = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function getConnection(): NavigatorConnection | null {
  if (typeof navigator === "undefined") return null;
  return (
    (navigator as Navigator & {
      connection?: NavigatorConnection;
      mozConnection?: NavigatorConnection;
      webkitConnection?: NavigatorConnection;
    }).connection ??
    (navigator as any).mozConnection ??
    (navigator as any).webkitConnection ??
    null
  );
}

export function LowBandwidthModeScript() {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const sync = () => {
      const preference = readLowBandwidthPreference(window.localStorage);
      applyLowBandwidthAttribute(
        document.documentElement,
        resolveLowBandwidthMode(preference, getConnection())
      );
    };

    sync();

    const connection = getConnection();
    connection?.addEventListener?.("change", sync);
    window.addEventListener("storage", sync);

    return () => {
      connection?.removeEventListener?.("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return null;
}
