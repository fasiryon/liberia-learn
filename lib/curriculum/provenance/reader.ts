import { prisma } from "@/lib/db";

export async function getCurriculumProvenanceExplanation(contentId: string) {
  const content = await prisma.curriculumContent.findUnique({
    where: { contentId },
    include: {
      provenance: {
        include: {
          currentRevision: {
            include: {
              author: { select: { id: true, name: true, role: true } },
              evidence: {
                orderBy: { createdAt: "asc" },
                include: {
                  supersededBy: { select: { id: true, status: true } },
                },
              },
              governanceEvents: {
                orderBy: { sequence: "asc" },
                include: {
                  actor: { select: { id: true, name: true, role: true } },
                },
              },
            },
          },
          revisions: {
            orderBy: { sequence: "desc" },
            select: {
              id: true,
              sequence: true,
              revisionKind: true,
              originKind: true,
              contentHash: true,
              createdAt: true,
              sourceRevisionId: true,
            },
          },
        },
      },
    },
  });
  if (!content) return null;
  const root = content.provenance;
  const current = root?.currentRevision ?? null;
  const latestDecision = current?.governanceEvents
    .filter((event) => event.lifecycleResult !== null)
    .at(-1) ?? null;
  const completenessReason =
    !root
      ? "No provenance root exists for this legacy content."
      : root.provenanceCompleteness === "VERIFIED"
        ? "Required lineage for this revision is complete and internally consistent."
        : root.provenanceCompleteness === "PARTIAL"
          ? "Some lineage is proven, but one or more applicable provenance fields are unavailable."
          : "The historical source cannot be proven without fabricating missing facts.";
  return {
    content: {
      id: content.id,
      contentId: content.contentId,
      title: content.title,
      grade: content.grade,
      subject: content.subject,
      status: content.status,
      moeAlignments: content.moeAlignments,
      waecSyllabusTopics: content.waecSyllabusTopics,
    },
    provenance: root
      ? {
          id: root.id,
          completeness: root.provenanceCompleteness,
          completenessReason,
          lifecycleState: root.lifecycleState,
          currentRevisionId: root.currentRevisionId,
        }
      : null,
    currentRevision: current
      ? {
          id: current.id,
          sequence: current.sequence,
          revisionKind: current.revisionKind,
          originKind: current.originKind,
          snapshotSchemaVersion: current.snapshotSchemaVersion,
          contentHash: current.contentHash,
          contentSnapshot: current.contentSnapshot,
          author: current.author,
          generator: {
            name: current.generatorName,
            version: current.generatorVersion,
            generatedAt: current.generatedAt,
          },
          ai: {
            provider: current.aiProvider,
            model: current.aiModel,
            generationCorrelationId: current.generationCorrelationId,
            promptKey: current.primaryPromptKey,
            promptVersion: current.primaryPromptVersion,
            promptHash: current.primaryPromptHash,
          },
          sourceRevisionId: current.sourceRevisionId,
          evidence: current.evidence,
          governanceEvents: current.governanceEvents,
        }
      : null,
    revisionHistory: root?.revisions ?? [],
    latestDecision,
  };
}
