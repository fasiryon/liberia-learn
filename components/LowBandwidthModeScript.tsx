"use client";

import { useLayoutEffect } from "react";
import { initLowBandwidthMode } from "@/lib/lowBandwidthMode";

/** Applies the existing low-bandwidth preference without executable inline HTML. */
export function LowBandwidthModeScript() {
  useLayoutEffect(() => initLowBandwidthMode(), []);
  return null;
}
