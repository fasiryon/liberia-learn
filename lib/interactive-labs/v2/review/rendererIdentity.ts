// Review evidence must prove which renderer actually drew a capture. Earlier "HIGH" captures silently fell back to
// FALLBACK_2D; a capture whose actual renderer or profile differs from the requested one is a FAIL, not evidence.
import type { CapabilityProfile } from "../types";

/** Identity strings the renderers write to `data-lab-renderer` on their root element. */
export const RENDERER_IDENTITY = { webglPass: "webgl-pass", svg: "svg", threePrefix: "three@" } as const;

export type RendererFamily = "three" | "webgl-pass" | "svg";

export function expectedRendererFamily(profile: CapabilityProfile): RendererFamily {
  return profile === "HIGH" || profile === "STANDARD" ? "three" : profile === "LOW" ? "webgl-pass" : "svg";
}

export function rendererFamily(identity: string | null | undefined): RendererFamily | null {
  if (!identity) return null;
  if (identity.startsWith(RENDERER_IDENTITY.threePrefix)) return "three";
  if (identity === RENDERER_IDENTITY.webglPass) return "webgl-pass";
  if (identity === RENDERER_IDENTITY.svg) return "svg";
  return null;
}

export type RendererObservation = {
  requestedProfile: CapabilityProfile;
  /** The profile the player actually resolved to (after any downgrade). */
  actualProfile: string | null;
  /** `data-lab-renderer` of the scene that is actually mounted. */
  actualRenderer: string | null;
  /** Frames the mounted renderer reports having drawn; 0 means it never rendered. */
  framesRendered: number;
};

export type RendererVerdict = { ok: boolean; reason?: string };

/** PASS only if the requested profile is the one in use and its renderer family actually drew at least one frame. */
export function verifyRendererIdentity(observation: RendererObservation): RendererVerdict {
  const expected = expectedRendererFamily(observation.requestedProfile);
  if (observation.actualProfile !== observation.requestedProfile) return { ok: false, reason: `profile_mismatch: requested ${observation.requestedProfile}, player resolved ${observation.actualProfile ?? "none"}` };
  const family = rendererFamily(observation.actualRenderer);
  if (family === null) return { ok: false, reason: `renderer_unidentified: ${observation.actualRenderer ?? "no data-lab-renderer"}` };
  if (family !== expected) return { ok: false, reason: `renderer_mismatch: ${observation.requestedProfile} expects ${expected}, got ${observation.actualRenderer}` };
  if (!(observation.framesRendered > 0)) return { ok: false, reason: `renderer_never_drew: ${observation.actualRenderer} reported 0 frames` };
  return { ok: true };
}
