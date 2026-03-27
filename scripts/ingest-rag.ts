import { syncPolicyRagChunks, syncPublishedCurriculumRagChunks } from "@/lib/ai/rag/ragIngestionService";

async function main() {
  const curriculumCount = await syncPublishedCurriculumRagChunks();
  const policyChunkCount = await syncPolicyRagChunks();

  console.log(
    JSON.stringify(
      {
        ok: true,
        indexedCurriculumRecords: curriculumCount,
        indexedPolicyChunks: policyChunkCount,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[RAG_INGEST]", error);
  process.exit(1);
});
