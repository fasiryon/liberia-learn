import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { teacherDiagnosticGroups } from "@/lib/content-bundle/preview/diagnostics";
import { ContentBundlePreview, ContentBundlePreviewUnavailable, type PreviewMode } from "@/components/teacher/content-bundle-preview/ContentBundlePreview";

export const dynamic = "force-dynamic";

/**
 * Read-only Teacher Preview of a resolved ContentBundle V1. Rendering a preview is not
 * publishing, releasing or assigning; this route has no write path.
 */
export default async function ContentBundlePreviewPage({ params, searchParams }: { params: { bundleId: string }; searchParams: { version?: string; view?: string; item?: string; school?: string; fixture?: string } }) {
  const user = await requireRole("TEACHER", "ADMIN").catch(() => null);
  if (!user) redirect("/login");

  const bundleId = decodeURIComponent(params.bundleId);
  const resolution = await getContentBundlePreviewResolver().resolveForTeacherPreview({
    bundleId,
    bundleVersion: typeof searchParams.version === "string" ? searchParams.version : null,
    viewer: { userId: user.id, role: user.role, schoolId: user.schoolId ?? null },
    schoolId: typeof searchParams.school === "string" ? searchParams.school : user.schoolId ?? undefined,
    fixturePreview: searchParams.fixture === "1",
  });

  switch (resolution.status) {
    case "RESOLVED": {
      const mode: PreviewMode = searchParams.view === "student" ? "student" : "teacher";
      return <ContentBundlePreview models={buildPreviewModels(resolution)} initialMode={mode} initialItemId={typeof searchParams.item === "string" ? searchParams.item : null} />;
    }
    case "UNAVAILABLE":
      return <ContentBundlePreviewUnavailable title="Content unavailable for preview" message="This content is not currently available for preview." groups={teacherDiagnosticGroups(resolution.diagnostics)} readiness={resolution.authorityMetadata?.readiness} />;
    case "INCOMPATIBLE":
      return <ContentBundlePreviewUnavailable title="Bundle cannot safely be resolved" message="This bundle cannot safely be resolved. Its content is withheld." groups={teacherDiagnosticGroups(resolution.diagnostics)} readiness={resolution.authorityMetadata?.readiness} />;
  }
}
