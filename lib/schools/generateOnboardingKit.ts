import { generateCanvaAsset } from "@/lib/canva/canvaMcp";

export async function generateOnboardingKit(input: {
  schoolName: string;
  county?: string | null;
  principalName?: string | null;
  schoolCode?: string | null;
}): Promise<{ canvaUrl: string }> {
  const response = await generateCanvaAsset(`Create an editable Canva onboarding kit for a newly provisioned LiberiaLearn school.

School: ${input.schoolName}
County: ${input.county ?? "Liberia"}
Principal/Admin: ${input.principalName ?? "School administrator"}
School Code: ${input.schoolCode ?? "provided in LiberiaLearn"}

Create three export-ready PDF documents in one organized Canva design:
1. School flyer
2. Parent introduction letter
3. Student quick-start guide

Use LiberiaLearn and school branding, modern professional education style,
clear setup next steps, and editable Canva layouts.

Return the Canva design URL.`);

  return { canvaUrl: response.canvaUrl };
}
