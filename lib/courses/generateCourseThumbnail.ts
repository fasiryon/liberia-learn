import { generateCanvaAsset } from "@/lib/canva/canvaMcp";

export async function generateCourseThumbnail(input: {
  courseName: string;
  subject: string;
  gradeLevel: number;
  schoolName?: string | null;
  tenantId: string | null;
}): Promise<{ canvaUrl: string; designId: string }> {
  const response = await generateCanvaAsset(`Create a modern educational course thumbnail in Canva.

Course: ${input.courseName}
Subject: ${input.subject}
Grade Level: Grade ${input.gradeLevel}
School: ${input.schoolName ?? "LiberiaLearn"}
Tenant ID: ${input.tenantId ?? "national"}

Requirements:
- LiberiaLearn branding colors with confident education styling
- readable typography for dashboard cards
- subject-themed visuals
- 16:9 layout optimized for course catalog cards
- no tiny text

Return the Canva design URL.`);

  return { canvaUrl: response.canvaUrl, designId: response.designId };
}
