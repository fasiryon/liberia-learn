import { describe, it, expect } from "vitest";
import { matchesGuardianChallengeName } from "@/lib/agents/sms/nameMatch";

describe("matchesGuardianChallengeName", () => {
  it("matches an exact full name", () => {
    expect(matchesGuardianChallengeName("Pewu Gongloe", "Pewu Gongloe")).toBe(true);
  });

  it("matches a single first-name token against the full name (Pewu -> Pewu Gongloe)", () => {
    expect(matchesGuardianChallengeName("Pewu", "Pewu Gongloe")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesGuardianChallengeName("pewu gongloe", "Pewu Gongloe")).toBe(true);
  });

  it("strips diacritics", () => {
    expect(matchesGuardianChallengeName("Pewu Gongloe", "Pêwu Gôngloé")).toBe(true);
    expect(matchesGuardianChallengeName("Pêwu", "Pewu Gongloe")).toBe(true);
  });

  it("tolerates a small typo on longer tokens", () => {
    expect(matchesGuardianChallengeName("Gonglo", "Pewu Gongloe")).toBe(true); // 1 char off, len 6/7
  });

  it("requires an exact match for short tokens (no fuzzy tolerance)", () => {
    expect(matchesGuardianChallengeName("Jon", "Pewu Jo")).toBe(false);
  });

  it("rejects a name with a token that doesn't match at all", () => {
    expect(matchesGuardianChallengeName("Pewu Wrongname", "Pewu Gongloe")).toBe(false);
  });

  it("rejects a completely different name", () => {
    expect(matchesGuardianChallengeName("Emmanuel Toe", "Pewu Gongloe")).toBe(false);
  });

  it("rejects an empty input name", () => {
    expect(matchesGuardianChallengeName("", "Pewu Gongloe")).toBe(false);
    expect(matchesGuardianChallengeName("   ", "Pewu Gongloe")).toBe(false);
  });

  it("rejects when the student has no name on file", () => {
    expect(matchesGuardianChallengeName("Pewu", "")).toBe(false);
  });

  it("handles extra whitespace", () => {
    expect(matchesGuardianChallengeName("  Pewu   Gongloe  ", "Pewu Gongloe")).toBe(true);
  });
});
