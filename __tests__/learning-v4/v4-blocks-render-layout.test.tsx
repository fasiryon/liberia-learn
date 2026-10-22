// CoS real-route findings D2/D3 (2026-10-22): long displayed equations wrap between their `=` steps instead of
// overflowing a 360 px card, and a triangle's height label never shares a line with its side labels.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MathExpression } from "@/components/experience/MathText";
import { ShapeDiagram } from "@/components/experience/teaching/v4/MathBlocks";

describe("displayed equality chains (D2)", () => {
  it("splits a chain into one piece per = step, spoken once", () => {
    const html = renderToStaticMarkup(<MathExpression tex="P = 2(l + w) = 2(90 + 45) = 2 \times 135 = 270\ \text{m}" display />);
    expect(html).toContain('class="ll5-math ll5-math-chain"');
    expect(html.match(/<math /g)).toHaveLength(5);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(6);
    expect(html).toMatch(/role="math" aria-label="P equals [^"]+270 metres"/);
    expect(html.match(/<mo>=<\/mo>/g)).toHaveLength(4);
  });

  it("leaves single equations, inline math and non-chains as one math element", () => {
    for (const html of [renderToStaticMarkup(<MathExpression tex="A = l \times w" display />), renderToStaticMarkup(<MathExpression tex="a = b = c" />)]) {
      expect(html).not.toContain("ll5-math-chain");
      expect(html.match(/<math /g)).toHaveLength(1);
    }
  });
});

describe("triangle height label placement (D3)", () => {
  const labels = (html: string) => [...html.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)"[^>]*>([^<]+)<\/text>/g)].map(([, x, y, anchor, text]) => ({ x: +x, y: +y, anchor, text }));
  const shapes = [
    { kind: "TRIANGLE", base: 10, height: 12, apexOffset: 5, sideLabels: [13, 13], unit: "m" },
    { kind: "TRIANGLE", base: 6, height: 4, apexOffset: 3, sideLabels: [5, 5], unit: "m" },
    { kind: "TRIANGLE", base: 8, height: 6, apexOffset: 6, sideLabels: [10, 6.32], unit: "cm" },
    { kind: "TRIANGLE", base: 5, height: 4, apexOffset: 7, unit: "m" },
  ] as const;

  it.each(shapes)("keeps h clear of the side labels ($base × $height, apex $apexOffset)", (shape) => {
    const html = renderToStaticMarkup(<ShapeDiagram shape={shape as never} views={["HEIGHT", "PERIMETER"]} reveal={false} />);
    const all = labels(html.replace(/<!-- -->/g, ""));
    const h = all.find((label) => label.text.startsWith("h = "))!;
    expect(h).toBeDefined();
    for (const side of all.filter((label) => /^\d/.test(label.text))) expect(Math.abs(side.y - h.y)).toBeGreaterThan(24);
    if (shape.apexOffset > shape.base) expect(h.anchor).toBe("start");
  });
});
