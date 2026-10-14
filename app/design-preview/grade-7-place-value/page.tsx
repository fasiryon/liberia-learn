import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceValueDemo } from "@/components/experience/demo/PlaceValueDemo";
import { isStudentDesignPreviewEnabled } from "@/lib/learner-experience/demo/designPreview";

// Student Experience V3 design preview: a clearly labelled DEMO with synthetic Grade 7 content. It is not
// served by the lesson delivery seam, is not a release, and makes no API call or write. Like the lab
// review harness it 404s in production builds unless STUDENT_DESIGN_PREVIEW=1 is set explicitly.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "DEMO · Grade 7 place value · LiberiaLearn", robots: { index: false, follow: false } };

export default function Grade7PlaceValueDemoPage() {
  if (!isStudentDesignPreviewEnabled(process.env)) notFound();
  return <PlaceValueDemo />;
}
