import { generateCanvaAsset } from "@/lib/canva/canvaMcp";

export async function generateMOEReport(input: {
  reportDate: string;
  totalSchools: number;
  totalStudents: number;
  totalLessonsDelivered: number;
  countyBreakdown: Array<{
    county: string;
    schools: number;
    activeStudents: number;
    completionRate: number;
  }>;
  topSubjects: string[];
  weakSubjects: string[];
}): Promise<{ canvaUrl: string }> {
  const response = await generateCanvaAsset(`Create a professional education
progress report presentation in Canva
for the Ministry of Education,
Republic of Liberia.

Report Date: ${input.reportDate}

Key Statistics:
- Total Schools: ${input.totalSchools}
- Total Students: ${input.totalStudents}
- Lessons Delivered: ${input.totalLessonsDelivered}

County Performance:
${JSON.stringify(input.countyBreakdown, null, 2)}

Strong Subjects: ${input.topSubjects.join(", ")}
Areas Needing Support: ${input.weakSubjects.join(", ")}

Create a slide deck with:
Slide 1: Title "LiberiaLearn National Progress Report ${input.reportDate}"
Slide 2: Key national metrics
Slide 3: County performance table
Slide 4: Curriculum coverage status
Slide 5: Recommendations

Use professional colors.
Include the Ministry of Education branding.
Return the Canva presentation URL.`);

  return { canvaUrl: response.canvaUrl };
}
