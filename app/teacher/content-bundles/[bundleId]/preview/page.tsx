import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getContentBundlePreviewResolver } from "@/lib/content-bundle/preview/server";
import { buildPreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { ContentBundlePreview, ContentBundlePreviewUnavailable, type PreviewMode } from "@/components/teacher/content-bundle-preview/ContentBundlePreview";

export const dynamic = "force-dynamic";

/**
 * Read-only Teacher Preview of a resolved ContentBundle V1. Rendering a preview is not
 * publishing, releasing or assigning; this route has no write path.
 */
export default async function ContentBundlePreviewPage({ params, searchParams }: { params: { bundleId: string }; searchParams: { version?: string; view?: string; item?: string } }) {
  const user = await requireRole("TEACHER", "ADMIN").catch(() => null);
  if (!user) redirect("/login");

  const bundleId = decodeURIComponent(params.bundleId);
  const resolution = await getContentBundlePreviewResolver().resolveForTeacherPreview({
    bundleId,
    bundleVersion: typeof searchParams.version === "string" && searchParams.version !== "" ? searchParams.version : null,
    viewer: { userId: user.id, role: user.role, schoolId: user.schoolId ?? null },
  });

  switch (resolution.status) {
    case "RESOLVED": {
      const mode: PreviewMode = searchParams.view === "student" ? "student" : "teacher";
      return <ContentBundlePreview models={buildPreviewModels(resolution)} initialMode={mode} initialItemId={typeof searchParams.item === "string" ? searchParams.item : null} />;
    }
    case "NOT_FOUND":
      return <ContentBundlePreviewUnavailable title="Bundle not found" message="No content bundle with this id and version is available to preview." />;
    case "FORBIDDEN":
      return <ContentBundlePreviewUnavailable title="Preview not allowed" message="Your account cannot preview this content bundle." />;
    case "INVALID":
      return <ContentBundlePreviewUnavailable title="Bundle cannot be previewed" message={`This bundle failed validation (${resolution.errors.length} problem${resolution.errors.length === 1 ? "" : "s"}), so nothing from it is shown.`} />;
    case "RESOLVER_UNAVAILABLE":
      return <ContentBundlePreviewUnavailable title="Preview not available yet" message={resolution.reason} />;
  }
}
