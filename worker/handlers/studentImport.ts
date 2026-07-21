import { processStudentImportBatch } from "@/lib/school-operations";

type StudentImportPayload = {
  batchId?: unknown;
  schoolId?: unknown;
};

export async function handleStudentImportJob(payload: StudentImportPayload) {
  const batchId = typeof payload?.batchId === "string" ? payload.batchId.trim() : "";
  const schoolId = typeof payload?.schoolId === "string" ? payload.schoolId.trim() : "";

  if (!batchId || !schoolId) {
    throw new Error("STUDENT_IMPORT requires batchId and schoolId");
  }

  return processStudentImportBatch(batchId, schoolId);
}
