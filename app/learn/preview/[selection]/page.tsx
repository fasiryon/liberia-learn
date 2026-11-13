import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLearningPreviewEnabled, loadStudentLearningPreview, parsePreviewSelection } from "@/lib/curriculum/v4/learningPreview";
import { LearningPreviewPlayer } from "@/components/learner-experience/LearningPreviewPlayer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Pilot lesson | LiberiaLearn", robots: { index: false, follow: false } };

export default async function LearningPreviewPage({ params }: { params: { selection: string } }) {
  noStore();
  if (!isLearningPreviewEnabled()) notFound();
  const selection = parsePreviewSelection(params.selection);
  if (!selection) notFound();
  const preview = await (async () => {
    try {
      const user = await requireRole("STUDENT");
      return await loadStudentLearningPreview(prisma, user, selection);
    } catch { return null; }
  })();
  if (!preview) notFound();
  return <LearningPreviewPlayer selection={selection} packageHash={preview.identity.packageHash}
    expiresAt={preview.expiresAt} experience={preview.experience} sceneAttachments={preview.sceneAttachments}
    initialOfflineAuthorization={preview.offlineAuthorization} offlineIntegritySha256={preview.offlineIntegritySha256} />;
}
