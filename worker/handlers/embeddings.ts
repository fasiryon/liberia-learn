import { getLessonEmbeddingSource, saveLessonEmbedding } from "@/lib/ai/rag/embeddingService";
import { syncCurriculumContentRagChunks } from "@/lib/ai/rag/ragIngestionService";
import { routedCompletion } from "@/lib/ai/routedCompletion";

type EmbeddingsJobPayload = {
  lessonId: string;
};

export async function handleGenerateEmbeddingsJob(payload: EmbeddingsJobPayload) {
  if (!payload?.lessonId) {
    throw new Error("lessonId is required for GENERATE_EMBEDDINGS");
  }

  const source = await getLessonEmbeddingSource(payload.lessonId);
  const result = await routedCompletion({
    mode: "embedding",
    input: source,
  });

  await saveLessonEmbedding(payload.lessonId, result.embedding);
  await syncCurriculumContentRagChunks(payload.lessonId);
}
