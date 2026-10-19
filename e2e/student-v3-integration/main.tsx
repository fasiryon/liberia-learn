/** Integrated production component tree. All identities, curriculum and API responses are synthetic test fixtures. */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { StudentShellV2, StudentOptionalPrompts } from "../../components/student/StudentShellV2";
import { TodayV2 } from "../../components/student/TodayV2";
import { LearnV2 } from "../../components/student/learn/LearnV2";
import { LessonCatalog } from "../../components/student/learn/LessonCatalog";
import StudentProgressDashboard from "../../components/student/StudentProgressDashboard";
import { LabsHubView } from "../../components/learner-experience/LabsHub";
import GlobalAssistantShell from "../../components/rag/GlobalAssistantShell";
import { StudentTutorPageContent } from "../../components/student/StudentTutorPageContent";
import { getAssistantRoleConfig } from "../../lib/ai/rag/assistantAccess";
import { labsTabFixture, showcaseFixture } from "../product-design-v2/labFixtures";
import LessonViewerClient from "../../app/student/lesson/[contentId]/LessonViewerClient";
import LessonDeliveryClient from "../../app/student/lessons/[id]/LessonDeliveryClient";
import { TextbookReader } from "../../components/textbooks/TextbookReader";
import { readingPages } from "../../components/textbooks/model";
import { legacyCurriculumResponse } from "../product-design-v2/legacyLessonFixtures";
import { navigate, usePathname } from "./navigation";
import "../../app/globals.css";
function Hub() {
  const [html, setHtml] = useState("");
  useEffect(() => { void fetch("/artifacts/textbook-v1/hub-after.html").then(r => r.text()).then(setHtml); }, []);
  return <div onClick={event => { const a = (event.target as HTMLElement).closest("a"); if (a?.getAttribute("href")?.startsWith("/")) { event.preventDefault(); navigate(a.getAttribute("href")!); } }} dangerouslySetInnerHTML={{ __html: html }} />;
}
const fixture = legacyCurriculumResponse();
const book = { id: "fixture-halves", version: "integration-fixture-v1", title: "Place value — synthetic integration fixture", subject: "MATH", grade: 7, source: "authorized-reading" as const, pages: fixture.payload.body_standard.split(/\n## /).flatMap((body, index) => readingPages({ body_standard: body }, index === 0 ? fixture.payload.title : body.split("\n")[0], 7)) };
function App() {
  const path = usePathname();
  const contentId = path.match(/^\/student\/lesson\/([^/]+)$/)?.[1];
  const assignedId = path.match(/^\/student\/lessons\/([^/]+)$/)?.[1];
  return <StudentShellV2 identity={{ name: "Synthetic integration fixture", grade: 7, userId: "fixture-student", schoolId: "fixture-school" }} utilities={<StudentOptionalPrompts><GlobalAssistantShell roleConfig={getAssistantRoleConfig("STUDENT")!} initialGrade={7} suggestedSubjects={["MATH"]} positionClassName="bottom-40 right-4" /></StudentOptionalPrompts>}>
    {contentId ? <LessonViewerClient key={contentId} enabledToolIds={[]} /> : assignedId ? <LessonDeliveryClient key={assignedId} lessonId={assignedId} enabledToolIds={[]} /> : path === "/student/lessons" ? <LessonCatalog /> : path.startsWith("/student/textbooks/") ? <TextbookReader book={book} persistenceScope="fixture-school:fixture-student" /> : path === "/student/textbooks" ? <Hub /> : path === "/student/today" ? <TodayV2 /> : path === "/student/learn" ? <LearnV2 /> : path === "/student/progress" ? <StudentProgressDashboard /> : path === "/student/labs" ? <LabsHubView tab={labsTabFixture(7)} requested={null} showcase={showcaseFixture("all").labs} aiLabsEnabled /> : <StudentTutorPageContent available />}
  </StudentShellV2>;
}
createRoot(document.getElementById("root")!).render(<App />);
