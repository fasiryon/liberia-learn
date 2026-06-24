import DOMPurify from "isomorphic-dompurify";

type LessonPayload = {
  body?: string | null;
  body_standard?: string | null;
  body_block?: string | null;
};

export function selectLessonBody(
  payload: LessonPayload,
  classFormat?: string | null,
  mode?: string | null
) {
  const format = classFormat ?? "standard";
  if (format === "block_a" || format === "block_b" || format === "block_single") {
    return payload.body_block ?? payload.body_standard ?? payload.body ?? "";
  }
  // For slides mode: prefer body_block (has ## headings for structured slides)
  if (mode === "slides") {
    return payload.body_block ?? payload.body_standard ?? payload.body ?? "";
  }
  return payload.body_standard ?? payload.body_block ?? payload.body ?? "";
}

export function lessonDurationLabel(classFormat?: string | null) {
  if (classFormat === "block_a" || classFormat === "block_b" || classFormat === "block_single") {
    return "90-min block (A/B Day)";
  }
  return "45-min period";
}

// Teacher-authored lessons (Wave 4 create flow) store the body as HTML
// (<p>...</p>), while AI-generated lessons store markdown. Escaping HTML
// bodies shows students literal tags, so HTML passes through sanitized.
const HTML_BLOCK_RE = /^\s*<(p|h[1-6]|ul|ol|li|div|section|article|blockquote|table|figure|pre|strong|em|br)\b/i;

export function looksLikeHtml(value: string) {
  return HTML_BLOCK_RE.test(value);
}

// Allowlist mirrors what renderSimpleMarkdown emits, plus the inline/structural
// tags teachers legitimately author via the Wave 4 rich-text editor. Anything
// not on this list (script, style, svg, math, iframe, object, embed, form, …)
// is removed by DOMPurify along with all event handlers and unsafe URI schemes.
const LESSON_ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "blockquote",
  "a",
  "img",
  "br",
  "hr",
];

// Global attribute allowlist. `a` only ever needs href; `img` only needs
// src/alt. DOMPurify also enforces its own safe-URI policy, which strips
// javascript:/data:/vbscript: schemes (data: is not in DOMPurify's default
// allowed-URI regexp), so encoded-scheme bypasses are neutralised too.
const LESSON_ALLOWED_ATTR = ["href", "src", "alt"];

export function sanitizeLessonHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: LESSON_ALLOWED_TAGS,
    ALLOWED_ATTR: LESSON_ALLOWED_ATTR,
    // Belt-and-braces: explicitly forbid the highest-risk elements even though
    // the allowlist already excludes them.
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "svg", "math"],
    FORBID_ATTR: ["style"],
    // Never allow data: URIs (would re-enable data:text/html script payloads).
    ALLOW_DATA_ATTR: false,
    // Drop unknown protocols rather than keeping them as text.
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Keep text content of removed nodes (matches prior behaviour for benign
    // wrappers) but strip the elements themselves.
    KEEP_CONTENT: true,
  });
}

export function renderSimpleMarkdown(markdown: string) {
  if (!markdown) return "";
  if (looksLikeHtml(markdown)) return sanitizeLessonHtml(markdown);
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("### ")) return `<h3>${escapeHtml(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${escapeHtml(block.slice(3))}</h2>`;
      if (block.startsWith("# ")) return `<h2>${escapeHtml(block.slice(2))}</h2>`;
      if (block.startsWith("**") && block.endsWith("**") && !block.slice(2, -2).includes("\n")) {
        return `<h3>${escapeHtml(block.slice(2, -2))}</h3>`;
      }
      if (block.startsWith("- ") || block.split("\n").every((l) => l.trim().startsWith("- "))) {
        const items = block
          .split("\n")
          .filter((line) => line.trim().startsWith("- "))
          .map((line) => `<li>${escapeHtml(line.trim().slice(2))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      if (/^\d+\.\s/.test(block)) {
        const items = block
          .split("\n")
          .filter((line) => /^\d+\.\s/.test(line.trim()))
          .map((line) => line.trim().replace(/^\d+\.\s/, ""))
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
