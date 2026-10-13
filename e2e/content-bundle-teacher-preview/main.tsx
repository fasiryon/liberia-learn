/** Browser-only harness: the production preview component over fixture-resolved display models. */
import { createRoot } from "react-dom/client";
// @ts-expect-error virtual module served by vite.config.ts
import models from "virtual:cbp-models";
import { ContentBundlePreview, ContentBundlePreviewUnavailable } from "../../components/teacher/content-bundle-preview/ContentBundlePreview";
import "../../app/globals.css";

const params = new URLSearchParams(window.location.search);
const variant = params.get("fixture") === "lab" ? "lab" : "default";
const state = models.states[params.get("state") ?? ""];
createRoot(document.getElementById("root")!).render(
  state ? <ContentBundlePreviewUnavailable {...state} /> : <ContentBundlePreview models={models[variant]} initialMode={params.get("view") === "student" ? "student" : "teacher"} initialItemId={params.get("item")} />,
);
