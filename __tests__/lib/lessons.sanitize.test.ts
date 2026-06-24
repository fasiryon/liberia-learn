import { describe, expect, it } from "vitest";
import { sanitizeLessonHtml, renderSimpleMarkdown } from "@/lib/lessons";

/**
 * A1 — Stored XSS sanitizer hardening.
 *
 * `sanitizeLessonHtml` is the only thing standing between a teacher-authored
 * lesson body and `dangerouslySetInnerHTML` in the principal's moderation
 * preview and every student's lesson view. The previous regex-based
 * implementation was bypassable; these tests pin the known bypass vectors so
 * the DOMPurify-backed implementation cannot regress.
 *
 * Two invariants, asserted on every vector:
 *   1. No executable script survives (no live <script> tag).
 *   2. No inline event handler survives (no `on*=` attribute).
 */

const EVENT_HANDLER_RE = /\son\w+\s*=/i;
const LIVE_SCRIPT_RE = /<script/i;

function expectNeutralised(out: string) {
  expect(out).not.toMatch(LIVE_SCRIPT_RE);
  expect(out).not.toMatch(EVENT_HANDLER_RE);
  expect(out.toLowerCase()).not.toContain("javascript:");
}

describe("sanitizeLessonHtml — XSS bypass vectors", () => {
  it("strips <svg/onload=...> (slash separator, no leading whitespace)", () => {
    const out = sanitizeLessonHtml("<svg/onload=alert(1)>");
    expectNeutralised(out);
    expect(out.toLowerCase()).not.toContain("<svg");
  });

  it("strips <img/onerror=...> handler while it may keep a benign img", () => {
    const out = sanitizeLessonHtml("<img/onerror=alert(1) src=x>");
    expectNeutralised(out);
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("neutralises entity-encoded javascript: scheme in href", () => {
    const out = sanitizeLessonHtml('<a href="jav&#x09;ascript:alert(1)">click</a>');
    expectNeutralised(out);
    // anchor text may survive; the dangerous href must not
    expect(out.toLowerCase()).not.toContain("alert(1)");
  });

  it("strips data:text/html href that embeds a script", () => {
    const out = sanitizeLessonHtml('<a href="data:text/html,<script>alert(1)</script>">click</a>');
    expectNeutralised(out);
    expect(out.toLowerCase()).not.toContain("data:text/html");
  });

  it("strips iframe with javascript: src", () => {
    const out = sanitizeLessonHtml('<iframe src="javascript:alert(1)"></iframe>');
    expectNeutralised(out);
    expect(out.toLowerCase()).not.toContain("<iframe");
  });

  it("strips MathML-wrapped script (foreign content bypass)", () => {
    const out = sanitizeLessonHtml("<math><mtext><script>alert(1)</script></mtext></math>");
    expectNeutralised(out);
    expect(out.toLowerCase()).not.toContain("<math");
  });

  it("does NOT decode already-encoded entities back into live HTML", () => {
    const out = sanitizeLessonHtml("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expectNeutralised(out);
    // the encoded entities must remain encoded, not become a real tag
    expect(out).toContain("&lt;script&gt;");
  });

  it("strips <object> and <embed> elements", () => {
    const out = sanitizeLessonHtml('<object data="javascript:alert(1)"></object><embed src="x">');
    expectNeutralised(out);
    expect(out.toLowerCase()).not.toContain("<object");
    expect(out.toLowerCase()).not.toContain("<embed");
  });

  it("strips a no-whitespace event handler via tag attribute", () => {
    const out = sanitizeLessonHtml('<p onclick="steal()">hi</p>');
    expectNeutralised(out);
    expect(out).toContain("hi");
  });
});

describe("sanitizeLessonHtml — allowlist preserves legitimate lesson markup", () => {
  it("keeps formatting tags the markdown renderer produces", () => {
    const html =
      "<h2>Topic</h2><p>Intro <strong>bold</strong> and <em>italic</em>.</p>" +
      "<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>" +
      "<blockquote>quote</blockquote><pre><code>x = 1</code></pre><hr />";
    const out = sanitizeLessonHtml(html);
    expect(out).toContain("<h2>Topic</h2>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>italic</em>");
    expect(out).toContain("<ul>");
    expect(out).toContain("<ol>");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("<code>");
  });

  it("keeps a safe https link and a safe image", () => {
    const out = sanitizeLessonHtml(
      '<a href="https://moe.gov.lr">MOE</a> <img src="https://cdn/x.png" alt="diagram">'
    );
    expect(out).toContain('href="https://moe.gov.lr"');
    expect(out).toContain('<img');
    expect(out).toContain('alt="diagram"');
    expectNeutralised(out);
  });
});

describe("renderSimpleMarkdown still routes HTML bodies through the sanitizer", () => {
  it("sanitises HTML-looking teacher bodies", () => {
    const out = renderSimpleMarkdown('<p>Lesson</p><svg/onload=alert(1)>');
    expectNeutralised(out);
    expect(out).toContain("<p>Lesson</p>");
  });

  it("escapes XSS attempts inside markdown bodies", () => {
    const out = renderSimpleMarkdown("Compare 1 <b>bold</b> attempt <script>alert(1)</script>");
    expectNeutralised(out);
    expect(out).toContain("&lt;");
  });
});
