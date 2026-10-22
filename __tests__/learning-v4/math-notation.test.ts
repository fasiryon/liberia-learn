// Interactive Learning V4: TeX in lesson text is typeset, read aloud correctly, and never shows raw commands.
import { describe, expect, it } from "vitest";
import { hasMath, parseTex, plainMathText, segmentMath, speakMathText, texToPlain, texToSpeech } from "@/lib/learner-experience/math/tex";

const speech = (tex: string) => texToSpeech(parseTex(tex));
const plain = (tex: string) => texToPlain(parseTex(tex));

describe("the founder's formulas render as mathematics, not raw TeX", () => {
  it.each([
    ["A_{\\text{rectangle}}=l\\times w", "A rectangle equals l times w", "A_rectangle = l × w"],
    ["P_{\\text{rectangle}}=2(l+w)", "P rectangle equals 2 l plus w", "P_rectangle = 2(l + w)"],
    ["A_{\\text{triangle}}=\\frac12 bh", "A triangle equals one half b h", "A_triangle = 1/2bh"],
    ["90\\times45=4050\\ \\text{m}^2", "90 times 45 equals 4050 square metres", "90 × 45 = 4050 m²"],
    ["2(90+45)=270\\ \\text{m}", "2 90 plus 45 equals 270 metres", "2(90 + 45) = 270 m"],
    ["\\frac{3}{4},\\quad \\frac{2}{3},\\quad \\frac{5}{8}", "3 quarters 2 thirds 5 eighths", "3/4, 2/3, 5/8"],
  ])("%s", (tex, spoken, text) => {
    expect(speech(tex)).toBe(spoken);
    expect(plain(tex).replace(/\s+/g, " ")).toBe(text);
  });

  it("keeps thousands separators as one number", () => {
    expect(parseTex("4,050")).toEqual({ t: "num", v: "4,050" });
    expect(speech("A = 4,050\\ \\text{m}^2")).toBe("A equals 4050 square metres");
  });

  it("never shows a backslash for an unknown command", () => {
    expect(plain("\\unknowncommand{x} + 1")).not.toContain("\\");
    expect(speech("\\mystery")).toBe("mystery");
  });
});

describe("segmenting lesson text", () => {
  it("finds delimited inline and display math", () => {
    expect(segmentMath("Area is $A = l \\times w$ here.")).toEqual([{ kind: "text", text: "Area is " }, { kind: "math", tex: "A = l \\times w", display: false }, { kind: "text", text: " here." }]);
    expect(segmentMath("$$x^2 = 4$$")).toEqual([{ kind: "math", tex: "x^2 = 4", display: true }]);
    expect(segmentMath("\\[ a \\\\ b \\]").filter((segment) => segment.kind === "math")).toHaveLength(2);
  });

  it("recovers bare TeX that legacy lessons printed raw, without swallowing prose", () => {
    const segments = segmentMath("The area is A = l \\times w for any rectangle.");
    expect(segments).toEqual([{ kind: "text", text: "The area is " }, { kind: "math", tex: "A = l \\times w", display: false }, { kind: "text", text: " for any rectangle." }]);
    expect(plainMathText("Its area is 90 \\times 45 = 4050 \\text{m}^2.")).toBe("Its area is 90 × 45 = 4050 m².");
  });

  it("repairs double-escaped TeX from a JSON round trip", () => {
    expect(plainMathText("Half is $\\\\frac{1}{2}$")).toBe("Half is 1/2");
  });

  it("leaves money alone", () => {
    for (const text of ["It costs L$500 at the market.", "Pay $5 and $10 later.", "Prices: $ 4 or $ 6"]) {
      expect(hasMath(text)).toBe(false);
      expect(segmentMath(text)).toEqual([{ kind: "text", text }]);
    }
  });

  it("reads lesson text aloud with mathematics spoken", () => {
    expect(speakMathText("Use $A = \\frac{1}{2} b h$ for triangles.")).toBe("Use A equals one half b h for triangles.");
  });

  it("never leaves a TeX command in plain text for any authored V4 string", () => {
    const samples = ["$\\frac{5}{8} - \\frac{1}{4}$", "$P = 2(12 + 5) = 2 \\times 17 = 34\\ \\text{m}$", "$\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4} = 1\\frac{1}{4}$ L.", "$23 = 20 + 3$"];
    for (const sample of samples) expect(plainMathText(sample)).not.toMatch(/\\[a-z]+/i);
  });
});
