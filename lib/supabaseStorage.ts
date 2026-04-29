const DEFAULT_LOGO_BUCKET = "school-logos";
const DEFAULT_LESSON_AUDIO_BUCKET = "lesson-audio";
const DEFAULT_LESSON_PDF_BUCKET = "lesson-pdf";

function getSupabaseConfig(bucketOverride?: string) {
  const baseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error("Supabase storage is not configured");
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    serviceKey,
    bucket: bucketOverride ?? process.env.SUPABASE_SCHOOL_LOGO_BUCKET ?? DEFAULT_LOGO_BUCKET,
  };
}

export async function uploadBinaryToSupabase(input: {
  bucket: string;
  path: string;
  contentType: string;
  body: Buffer;
}) {
  const { baseUrl, serviceKey, bucket } = getSupabaseConfig(input.bucket);
  const key = input.path.replace(/^\/+/, "");
  const url = `${baseUrl}/storage/v1/object/${bucket}/${key}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": input.contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: input.body as unknown as BodyInit,
  });

  if (!response.ok) {
    throw new Error(`Supabase upload failed (${response.status})`);
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${key}`;
}

export function lessonAudioSupabasePath(input: {
  grade: number;
  subject: string;
  contentId: string;
  voice: string;
}) {
  const safeSubject = input.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const safeContentId = input.contentId.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  const safeVoice = input.voice.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "alloy";
  return `grade-${input.grade}/${safeSubject}/${safeContentId}/${safeVoice}.mp3`;
}

export async function uploadLessonAudioToSupabase(input: {
  grade: number;
  subject: string;
  contentId: string;
  voice: string;
  body: Buffer;
}) {
  return uploadBinaryToSupabase({
    bucket: process.env.SUPABASE_LESSON_AUDIO_BUCKET ?? DEFAULT_LESSON_AUDIO_BUCKET,
    path: lessonAudioSupabasePath(input),
    contentType: "audio/mpeg",
    body: input.body,
  });
}

export function lessonPdfSupabasePath(input: {
  grade: number;
  subject: string;
  format: string;
  version: string;
}) {
  const safeSubject = input.subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const safeFormat = input.format.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student";
  const safeVersion = input.version.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "v1";
  return `textbooks/grade-${input.grade}/${safeSubject}/${safeFormat}/${safeVersion}.pdf`;
}

export async function uploadLessonPdfToSupabase(fileBuffer: Buffer, path: string) {
  return uploadBinaryToSupabase({
    bucket: process.env.SUPABASE_LESSON_PDF_BUCKET ?? DEFAULT_LESSON_PDF_BUCKET,
    path,
    contentType: "application/pdf",
    body: fileBuffer,
  });
}

export async function uploadSchoolLogoToSupabase(input: {
  schoolId: string;
  file: File;
}) {
  const { baseUrl, serviceKey, bucket } = getSupabaseConfig();
  const extension = input.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const key = `${input.schoolId}/${Date.now()}.${extension}`;
  const url = `${baseUrl}/storage/v1/object/${bucket}/${key}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": input.file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: Buffer.from(await input.file.arrayBuffer()),
  });

  if (!response.ok) {
    throw new Error(`Supabase logo upload failed (${response.status})`);
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${key}`;
}
