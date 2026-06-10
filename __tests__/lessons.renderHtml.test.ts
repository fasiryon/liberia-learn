import { describe, expect, it } from "vitest";
import { looksLikeHtml, renderSimpleMarkdown, sanitizeLessonHtml } from "@/lib/lessons";

describe("looksLikeHtml", () => {
  it("detects teacher-authored HTML bodies", () => {
    expect(looksLikeHtml("<p>Addition is combining two numbers.</p>")).toBe(true);
    expect(looksLikeHtml("  <h2>Photosynthesis</h2>")).toBe(true);
    expect(looksLikeHtml("<ul><li>One</li></ul>")).toBe(true);
  });

  it("does not flag markdown or plain text", () => {
    expect(looksLikeHtml("# Heading\n\nSome text")).toBe(false);
    expect(looksLikeHtml("Plain prose about plants.")).toBe(false);
    expect(looksLikeHtml("5 < 7 is true")).toBe(false);
  });
});

describe("renderSimpleMarkdown with HTML input", () => {
  it("passes HTML bodies through instead of escaping them", () => {
    const html = "<p>This is a quick demo lesson.</p>";
    expect(renderSimpleMarkdown(html)).toBe(html);
  });

  it("still renders markdown bodies as before", () => {
    const out = renderSimpleMarkdown("## Topic\n\n- one\n- two");
    expect(out).toBe("<h2>Topic</h2><ul><li>one</li><li>two</li></ul>");
  });

  it("escapes HTML-looking text inside markdown bodies", () => {
    const out = renderSimpleMarkdown("Compare: 1 <b>bold</b> attempt");
    expect(out).toContain("&lt;b&gt;");
  });
});

describe("sanitizeLessonHtml", () => {
  it("strips script and style blocks", () => {
    const out = sanitizeLessonHtml("<p>ok</p><script>alert(1)</script><style>p{}</style>");
    expect(out).toBe("<p>ok</p>");
  });

  it("strips unterminated script blocks", () => {
    expect(sanitizeLessonHtml("<p>ok</p><script>alert(1)")).toBe("<p>ok</p>");
  });

  it("removes inline event handlers", () => {
    const out = sanitizeLessonHtml('<p onclick="steal()" onmouseover=\'x()\'>hi</p>');
    expect(out).toBe("<p>hi</p>");
  });

  it("removes embedded form/iframe elements", () => {
    const out = sanitizeLessonHtml('<p>a</p><iframe src="https://evil"></iframe><form><input></form>');
    expect(out).toBe("<p>a</p>");
  });

  it("neutralizes javascript: URLs", () => {
    const out = sanitizeLessonHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });
});
