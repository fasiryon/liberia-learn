import { getEnabledToolkitCategories } from "@/components/toolkit/ToolkitProvider";
import { enabledToolIds } from "@/lib/learner-experience/tools";
import LessonDeliveryClient from "./LessonDeliveryClient";
// activeVideo teacher-recorded video playback is rendered by LessonDeliveryClient

export default function StudentLessonPage({ params }: { params: { id: string } }) {
  // Toolkit switches are server flags; a native lesson's tool panel shows only tools switched on here.
  return <LessonDeliveryClient lessonId={params.id} enabledToolIds={enabledToolIds(getEnabledToolkitCategories())} />;
}
