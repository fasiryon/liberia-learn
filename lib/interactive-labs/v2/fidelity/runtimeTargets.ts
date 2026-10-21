import type { CapabilityProfile } from "../types";
/** Locked runtime targets. Kept separate from build-only measurement and device/source records. */
export const RUNTIME_TARGETS = Object.freeze({
  fps: Object.freeze({ HIGH:60, STANDARD:45, LOW:30, FALLBACK_2D:30 } satisfies Record<CapabilityProfile,number>),
  interactiveMs:Object.freeze({cold:5000,warmOffline:3000}),memoryCeilingMB:200,jsHeapCeilingMB:64,
});
export function downgradeFrameBudgetMs(profile:CapabilityProfile):number {return Math.round((1000/RUNTIME_TARGETS.fps[profile])*1.15*10)/10;}
