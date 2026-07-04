// Phase 4A — quality gates for AI-generated illustrations.
// Two layers:
//   1. structuralGate  — cheap, always runs (valid, non-trivial image bytes).
//   2. visionQualityCheck — optional (MEDIA_VISION_QA=1). Uses a vision model to
//      reject rendered text, distorted anatomy, or a missing/wrong subject.
// Prompt-side negative guidance (see stylePrompts) is the first line of defense;
// the vision gate is a paid backstop, off by default to protect the budget.

export type QAResult = { ok: boolean; reason?: string; skipped?: boolean };

const MIN_IMAGE_BYTES = 2 * 1024; // 2KB — anything smaller is a broken render

export function structuralGate(bytes: Buffer | Uint8Array): QAResult {
  if (!bytes || bytes.length < MIN_IMAGE_BYTES) {
    return { ok: false, reason: `image too small (${bytes?.length ?? 0} bytes)` };
  }
  return { ok: true };
}

export function isVisionQAEnabled(): boolean {
  return process.env.MEDIA_VISION_QA === "1" && !!process.env.OPENAI_API_KEY;
}

/**
 * Vision QA via OpenAI. Returns { ok:false, reason } when the image contains
 * rendered text, distorted human anatomy, or does not depict the subject.
 * Falls back to { ok:true, skipped:true } when disabled or on any error
 * (fail-open — we don't discard a possibly-fine image on an infra hiccup).
 */
export async function visionQualityCheck(input: {
  imageUrl: string;
  subjectFocus: string;
}): Promise<QAResult> {
  if (!isVisionQAEnabled()) return { ok: true, skipped: true };
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MEDIA_VISION_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content:
              "You are a strict QA checker for educational illustrations. Respond with a compact JSON " +
              'object: {"text":bool,"anatomy":bool,"subject":bool}. ' +
              "text=true if the image contains rendered words/letters. " +
              "anatomy=true if it shows distorted human faces/hands/bodies. " +
              "subject=true if it clearly depicts the requested subject.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Requested subject: ${input.subjectFocus}` },
              { type: "image_url", image_url: { url: input.imageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { ok: true, skipped: true };
    const data: any = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[^}]*\}/);
    if (!match) return { ok: true, skipped: true };
    const verdict = JSON.parse(match[0]);
    if (verdict.text === true) return { ok: false, reason: "rendered text detected" };
    if (verdict.anatomy === true) return { ok: false, reason: "distorted anatomy detected" };
    if (verdict.subject === false) return { ok: false, reason: "subject missing or wrong" };
    return { ok: true };
  } catch {
    return { ok: true, skipped: true };
  }
}
