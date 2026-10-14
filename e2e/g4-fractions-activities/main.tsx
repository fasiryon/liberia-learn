/** Browser-only harness: the production Teacher Preview component over fixture-resolved display models. */
import { createRoot } from "react-dom/client";
// @ts-expect-error virtual module served by vite.config.ts
import models from "virtual:g4-activity-models";
import { ContentBundlePreview } from "../../components/teacher/content-bundle-preview/ContentBundlePreview";
import "../../app/globals.css";

const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")!).render(
  <ContentBundlePreview models={models} initialMode={params.get("view") === "student" ? "student" : "teacher"} initialItemId={params.get("item")} />,
);
