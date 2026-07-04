// Phase 4A — Fal.ai FLUX.1 [schnell] text-to-image client.
// https://fal.run/fal-ai/flux/schnell  (Authorization: Key $FAL_KEY)

export const FAL_FLUX_SCHNELL_ENDPOINT = "https://fal.run/fal-ai/flux/schnell";
// Conservative per-image cost for budgeting (schnell ~$0.003/MP at landscape_4_3).
export const FAL_COST_PER_IMAGE = 0.003;

export type FalImageResult = {
  url: string;
  contentType: string;
};

export class FalGenerationError extends Error {}

function falKey(): string | undefined {
  const v = process.env.FAL_KEY;
  return v && v.trim() ? v.trim() : undefined;
}

/** Generate a single image via Flux schnell. Throws FalGenerationError on failure. */
export async function generateFalImage(input: {
  prompt: string;
  imageSize?: string;
  outputFormat?: "jpeg" | "png"; // fal schnell supports jpeg | png only
  numInferenceSteps?: number;
  signal?: AbortSignal;
}): Promise<FalImageResult> {
  const key = falKey();
  if (!key) throw new FalGenerationError("FAL_KEY is not configured");

  let res: Response;
  try {
    res = await fetch(FAL_FLUX_SCHNELL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        image_size: input.imageSize ?? "landscape_4_3",
        num_inference_steps: input.numInferenceSteps ?? 4,
        num_images: 1,
        enable_safety_checker: true,
        output_format: input.outputFormat ?? "jpeg",
      }),
      signal: input.signal,
    });
  } catch (e: any) {
    throw new FalGenerationError(`Fal request failed: ${e?.message ?? "network error"}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FalGenerationError(`Fal returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data: any = await res.json();
  const image = Array.isArray(data?.images) ? data.images[0] : null;
  if (!image?.url) throw new FalGenerationError("Fal response contained no image url");
  return { url: image.url, contentType: image.content_type ?? "image/jpeg" };
}

/** Fetch generated image bytes (fal cdn urls are ephemeral — download promptly). */
export async function fetchImageBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new FalGenerationError(`Failed to download image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
