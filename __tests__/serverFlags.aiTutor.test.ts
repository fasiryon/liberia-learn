import { afterEach, describe, expect, it } from "vitest";
import { isAiTutorEnabled } from "@/lib/serverFlags";

describe("isAiTutorEnabled", () => {
  afterEach(() => {
    delete process.env.AI_TUTOR_ENABLED;
  });

  it("returns false when the flag is absent", () => {
    expect(isAiTutorEnabled()).toBe(false);
  });

  it("returns true when set to a clean 'true'", () => {
    process.env.AI_TUTOR_ENABLED = "true";
    expect(isAiTutorEnabled()).toBe(true);
  });

  it("returns true when the value has a trailing CRLF (vercel env pull artifact)", () => {
    // Regression: a corrupted env value of "true\r\n" caused the tutor to 404
    // because the gate used a strict === "true" comparison.
    process.env.AI_TUTOR_ENABLED = "true\r\n";
    expect(isAiTutorEnabled()).toBe(true);
  });

  it("returns true when the value has surrounding whitespace", () => {
    process.env.AI_TUTOR_ENABLED = "  true  ";
    expect(isAiTutorEnabled()).toBe(true);
  });

  it("returns false for a non-true value", () => {
    process.env.AI_TUTOR_ENABLED = "false";
    expect(isAiTutorEnabled()).toBe(false);
  });
});
