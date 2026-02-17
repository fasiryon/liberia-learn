import { describe, it, expect } from "vitest";
import { liberianize } from "@/lib/localization/liberia-context";
import { standardizeTone, toneGuidance } from "@/lib/localization/tone-standardizer";

describe("liberianize", () => {
  it("replaces Western names with Liberian names", () => {
    expect(liberianize("John went to the store")).toBe("Tamba went to the store");
    expect(liberianize("Jane and Mary")).toBe("Musu and Fatu");
  });

  it("replaces currency references", () => {
    expect(liberianize("It costs $50")).toBe("It costs 50 LD");
    expect(liberianize("He paid 100 dollars")).toBe("He paid 100 Liberian dollars");
  });

  it("replaces place names", () => {
    expect(liberianize("She lives in New York")).toBe("She lives in Monrovia");
    expect(liberianize("Visit the supermarket")).toBe("Visit the market");
  });

  it("replaces food references", () => {
    expect(liberianize("They ate pizza")).toBe("They ate jollof rice");
    expect(liberianize("Buy some apples")).toBe("Buy some mango");
  });

  it("replaces animal references", () => {
    expect(liberianize("A bear in the forest")).toBe("A chimpanzee in the forest");
  });

  it("replaces measurement units", () => {
    expect(liberianize("It was 5 miles away")).toBe("It was 5 kilometer away");
  });

  it("is safe to run on already-Liberian content", () => {
    const text = "Musu went to Monrovia market and bought jollof rice for 200 LD.";
    expect(liberianize(text)).toBe(text);
  });
});

describe("standardizeTone", () => {
  it("simplifies complex words for grade 1-3", () => {
    expect(standardizeTone("You must utilize this tool", 2)).toBe("You must use this tool");
    expect(standardizeTone("Additionally, demonstrate the concept", 1)).toBe(
      "also, show the concept"
    );
  });

  it("partially simplifies for grade 4-6", () => {
    expect(standardizeTone("You must utilize this tool", 5)).toBe("You must use this tool");
  });

  it("does not simplify for grade 7+", () => {
    expect(standardizeTone("You must utilize this tool", 8)).toBe(
      "You must utilize this tool"
    );
  });
});

describe("toneGuidance", () => {
  it("returns appropriate guidance per grade band", () => {
    expect(toneGuidance(1)).toContain("early elementary");
    expect(toneGuidance(5)).toContain("upper elementary");
    expect(toneGuidance(8)).toContain("middle school");
    expect(toneGuidance(11)).toContain("high school");
  });
});
