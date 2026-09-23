import { prisma } from "../lib/db";
import { buildCurriculumCoverageProgramReport, buildRepositoryOnlyCoverageReport } from "../lib/learning-authority/curriculumCoverageProgram";
import scope from "../curriculum/releases/k12-scope.json";

async function main() {
const repositoryOnly = process.argv.includes("--repository-only");
if (repositoryOnly) {
  process.stdout.write(JSON.stringify(buildRepositoryOnlyCoverageReport({ scope: scope.scope, databaseError: "repository_only_requested" }), null, 2) + "\n");
  return;
}
try {
const content = await prisma.curriculumContent.findMany({
  where: { schoolId: null },
  select: {
    grade: true, subject: true, status: true, contentId: true, version: true,
    provenance: { select: {
      provenanceCompleteness: true, lifecycleState: true,
      currentRevision: { select: { originKind: true, governanceEvents: { select: { reviewAuthority: true, lifecycleResult: true } } } },
    } },
  },
});
const sources = await prisma.curriculumAuthoritySource.findMany({
  select: { id: true, authorityType: true, status: true, subject: true, gradeMin: true, gradeMax: true, currentVersionId: true,
    currentVersion: { select: { verificationStatus: true } } },
});
const objectives = await prisma.moeCurriculumObjective.findMany({
  select: { grade: true, subject: true, sourceVersionId: true, verificationStatus: true },
});
const report = buildCurriculumCoverageProgramReport({
  scope: scope.scope,
  sources: sources.map((source) => ({ ...source, verificationStatus: source.currentVersion?.verificationStatus ?? null })),
  objectives,
  content: content.map((item) => ({
    grade: item.grade, subject: item.subject, status: item.status, contentId: item.contentId, version: item.version,
    provenanceCompleteness: item.provenance?.provenanceCompleteness ?? null,
    lifecycleState: item.provenance?.lifecycleState ?? null,
    originKind: item.provenance?.currentRevision?.originKind ?? null,
    reviewAuthorities: item.provenance?.currentRevision?.governanceEvents.map((event) => event.reviewAuthority).filter((value) => Boolean(value)) ?? [],
  })),
});
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
await prisma.$disconnect();
} catch (error) {
  const reason = error instanceof Error ? error.message : "database_unavailable";
  process.stdout.write(JSON.stringify(buildRepositoryOnlyCoverageReport({ scope: scope.scope, databaseError: reason }), null, 2) + "\n");
  await prisma.$disconnect();
}
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exitCode = 1;
});
