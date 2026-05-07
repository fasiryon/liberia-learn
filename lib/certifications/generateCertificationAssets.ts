import { generateCanvaAsset } from "@/lib/canva/canvaMcp";

export async function generateCertificationBanner(input: {
  title: string;
  subject: string;
  grade: number;
}): Promise<{ canvaUrl: string }> {
  const response = await generateCanvaAsset(`Create a cinematic academic Canva banner for a LiberiaLearn certification pathway.

Certification: ${input.title}
Subject: ${input.subject}
Grade: Grade ${input.grade}

Requirements:
- certification pathway identity
- future-career oriented visuals
- LiberiaLearn national branding
- professional education tone
- dashboard and social-ready banner layout

Return the Canva design URL.`);

  return { canvaUrl: response.canvaUrl };
}

export async function generateHiggsfieldPromoVideo(input: {
  title: string;
  subject: string;
  grade: number;
}): Promise<{ videoUrl: string }> {
  const endpoint = process.env.HIGGSFIELD_API_URL?.trim();
  const apiKey = process.env.HIGGSFIELD_API_KEY?.trim();
  if (!endpoint || !apiKey) {
    throw Object.assign(new Error("Higgsfield unavailable"), { status: 503 });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `Create a short cinematic 15-30 second promo video for the ${input.title} certification pathway in Grade ${input.grade} ${input.subject}. Use an education and future workforce tone suitable for marketing and social media in Liberia.`,
      durationSeconds: 20,
    }),
  });

  if (!response.ok) {
    throw Object.assign(new Error("Higgsfield generation failed"), { status: response.status });
  }

  const data = await response.json();
  const videoUrl = typeof data?.videoUrl === "string" ? data.videoUrl : "";
  if (!videoUrl) {
    throw Object.assign(new Error("Higgsfield URL not returned"), { status: 502 });
  }

  return { videoUrl };
}
