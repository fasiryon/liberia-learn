import { describe, it, expect, afterEach } from "vitest";
import { isFeatureEnabled } from "@/lib/featureFlags";

/**
 * Feature flag tests.
 *
 * isFeatureEnabled() reads process.env at call time (not at module init),
 * so env vars can be mutated between assertions without module resets.
 */
describe("isFeatureEnabled", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING;
    delete process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE;
  });

  it("returns false when env var is absent", () => {
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(false);
  });

  it("returns true when env var is exactly 'true'", () => {
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING = "true";
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(true);
  });

  it("is strict — '1' does not enable the flag", () => {
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING = "1";
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(false);
  });

  it("is strict — 'yes' does not enable the flag", () => {
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING = "yes";
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(false);
  });

  it("is strict — 'TRUE' (uppercase) does not enable the flag", () => {
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING = "TRUE";
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(false);
  });

  it("handles ACCESSIBILITY_MODE flag independently", () => {
    process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE = "true";
    expect(isFeatureEnabled("ENABLE_ACCESSIBILITY_MODE")).toBe(true);
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(false);
  });

  it("both flags can be enabled simultaneously", () => {
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING = "true";
    process.env.NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE = "true";
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(true);
    expect(isFeatureEnabled("ENABLE_ACCESSIBILITY_MODE")).toBe(true);
  });

  it("returns false after env var is removed", () => {
    process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING = "true";
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(true);
    delete process.env.NEXT_PUBLIC_ENABLE_GUIDED_ONBOARDING;
    expect(isFeatureEnabled("ENABLE_GUIDED_ONBOARDING")).toBe(false);
  });
});
