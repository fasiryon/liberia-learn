import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { TextbookReader } from "../../components/textbooks/TextbookReader";
import { LegacyReading } from "../../components/experience/LegacyLesson";
import { LessonPlayerV2, type LessonPlayerRuntime } from "../../components/learner-experience/LessonPlayerV2";
import GlobalAssistantShell from "../../components/rag/GlobalAssistantShell";
import { getAssistantRoleConfig } from "../../lib/ai/rag/assistantAccess";
import { hydropowerLessonExperience } from "../../lib/learner-experience/fixtures/hydropowerLesson";
import { parseLessonBlocks, splitLessonSections } from "../../lib/learner-experience/lessonText";
import type { ReadingBook } from "../../components/textbooks/model";
import "../../app/globals.css";

// Synthetic component/runtime fixture only: no release, school session or server evidence channel.
const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "empty";
function Reader() {
  const [empty, setEmpty] = useState(mode === "empty");
  const book: ReadingBook = { id: "review-reader", version: "1", title: "Authorized reading fixture", subject: "MATH", grade: 7, source: "authorized-reading", pages: empty ? [] : [{ title: "First page", chapter: "First chapter", body: "Read this paragraph." }] };
  return <><button onClick={() => setEmpty(true)}>Remove fixture pages</button><TextbookReader book={book} persistenceScope="synthetic-school:synthetic-reader" /></>;
}
function Native() {
  const sceneId = params.get("scene") ?? "explain";
  const scene = hydropowerLessonExperience.scenes.find(s => s.id === sceneId)!;
  const experience = { ...hydropowerLessonExperience, id: `repair-fixture-${sceneId}`, scenes: [scene] };
  const runtime: LessonPlayerRuntime = {
    identity: { lessonId: "review-native", contentId: "review-native", lessonVersion: "1", contentVersion: "1", revisionId: null, releaseId: null, releaseIdentity: null },
    target: { kind: "CONTENT", contentId: "review-native" }, availability: "CURRENT", labLinks: [],
    evidence: { status: "PRESENTATION_ONLY" }, evidenceDisposition: "RAW_OBSERVATION", serverCompletion: null,
  };
  const [shellReady, setShellReady] = useState(!params.has("late"));
  useEffect(() => { const timer = setTimeout(() => setShellReady(true), 100); return () => clearTimeout(timer); }, []);
  return <><LessonPlayerV2 experience={experience} runtime={runtime} toolsByScene={{}} exitHref="/" returnSceneId={null} />
    {shellReady && <GlobalAssistantShell roleConfig={getAssistantRoleConfig("STUDENT")!} initialGrade={7} suggestedSubjects={["MATH"]} initialOpen={params.has("late")} />}
    <span data-shell-ready={shellReady} /></>;
}
createRoot(document.getElementById("root")!).render(mode === "heading"
  ? <main><LegacyReading title="A different lesson title" sections={splitLessonSections(parseLessonBlocks("## Opening\n\nRead this paragraph."), "A different lesson title")} /></main>
  : mode === "native" ? <Native /> : <Reader />);
