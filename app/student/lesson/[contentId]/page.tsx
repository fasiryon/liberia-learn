import { getEnabledToolkitCategories } from "@/components/toolkit/ToolkitProvider";
import { enabledToolIds } from "@/lib/learner-experience/tools";
import LessonViewerClient from "./LessonViewerClient";

// Server shell: toolkit switches are server flags, resolved here for the native lesson player's tool panel.
export default function LessonViewerPage() {
  return <LessonViewerClient enabledToolIds={enabledToolIds(getEnabledToolkitCategories())} />;
}
