// Regression coverage for review-capture renderer identity: a silent fallback must never count as HIGH evidence.
import { describe, expect, it } from "vitest";
import { expectedRendererFamily, rendererFamily, verifyRendererIdentity } from "@/lib/interactive-labs/v2/review/rendererIdentity";

describe("review renderer identity", () => {
  it("maps each profile to the renderer that must draw it", () => {
    expect(expectedRendererFamily("HIGH")).toBe("three");
    expect(expectedRendererFamily("STANDARD")).toBe("three");
    expect(expectedRendererFamily("LOW")).toBe("webgl-pass");
    expect(expectedRendererFamily("FALLBACK_2D")).toBe("svg");
    expect(rendererFamily("three@186")).toBe("three");
    expect(rendererFamily("webgl")).toBeNull();
  });

  it("passes only when the requested profile is in use and its renderer drew", () => {
    expect(verifyRendererIdentity({ requestedProfile: "HIGH", actualProfile: "HIGH", actualRenderer: "three@186", framesRendered: 3 })).toEqual({ ok: true });
    expect(verifyRendererIdentity({ requestedProfile: "LOW", actualProfile: "LOW", actualRenderer: "webgl-pass", framesRendered: 1 })).toEqual({ ok: true });
    expect(verifyRendererIdentity({ requestedProfile: "FALLBACK_2D", actualProfile: "FALLBACK_2D", actualRenderer: "svg", framesRendered: 1 })).toEqual({ ok: true });
  });

  it("fails the silent HIGH → FALLBACK_2D fallback that earlier captures hid", () => {
    const verdict = verifyRendererIdentity({ requestedProfile: "HIGH", actualProfile: "FALLBACK_2D", actualRenderer: "svg", framesRendered: 1 });
    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.reason).toMatch(/^profile_mismatch/);
  });

  it("fails a mounted three.js layer that never drew (lost context) and an unidentified renderer", () => {
    expect(verifyRendererIdentity({ requestedProfile: "STANDARD", actualProfile: "STANDARD", actualRenderer: "three@186", framesRendered: 0 })).toEqual({ ok: false, reason: "renderer_never_drew: three@186 reported 0 frames" });
    expect(verifyRendererIdentity({ requestedProfile: "HIGH", actualProfile: "HIGH", actualRenderer: null, framesRendered: 5 }).ok).toBe(false);
    expect(verifyRendererIdentity({ requestedProfile: "LOW", actualProfile: "LOW", actualRenderer: "three@186", framesRendered: 5 })).toEqual({ ok: false, reason: "renderer_mismatch: LOW expects webgl-pass, got three@186" });
  });
});
