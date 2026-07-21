import { processOneRosterImportBatch } from "@/lib/interoperability/onerosterService";

type OneRosterImportPayload = {
  batchId?: unknown;
  schoolId?: unknown;
};

export async function handleOneRosterImportJob(payload: OneRosterImportPayload) {
  const batchId = typeof payload?.batchId === "string" ? payload.batchId.trim() : "";
  const schoolId = typeof payload?.schoolId === "string" ? payload.schoolId.trim() : "";
  if (!batchId || !schoolId) {
    throw new Error("ONEROSTER_IMPORT requires batchId and schoolId");
  }
  return processOneRosterImportBatch(batchId, schoolId);
}
