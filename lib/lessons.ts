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

export function sanitizeLessonHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?(<\/script>|$)/gi, "")
    .replace(/<style\b[\s\S]*?(<\/style>|$)/gi, "")
    .replace(/<\/?(iframe|object|embed|form|input|button|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, '$1="#"');
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
