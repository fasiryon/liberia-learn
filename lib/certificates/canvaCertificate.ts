import { generateCanvaAsset } from "@/lib/canva/canvaMcp";

export async function generateCertificate(input: {
  studentName: string;
  schoolName: string;
  grade: number;
  subject: string;
  completionDate: string;
  certificateId: string;
}): Promise<{ canvaUrl: string; designId: string }> {
  const response = await generateCanvaAsset(`Create a certificate of completion
in Canva with these details:

Student Name: ${input.studentName}
School: ${input.schoolName}
Grade: Grade ${input.grade}
Subject: ${input.subject}
Completion Date: ${input.completionDate}
Certificate ID: ${input.certificateId}

Use a professional certificate template.
The title should be:
"Certificate of Achievement"

The text should read:
"This certifies that ${input.studentName}
has successfully completed the
Grade ${input.grade} ${input.subject} curriculum
at ${input.schoolName}
on ${input.completionDate}"

Use colors that suggest education and achievement. Return the Canva design URL.`);

  return { canvaUrl: response.canvaUrl, designId: response.designId };
}
