import { createRoot } from "react-dom/client";
import { StudentShellV2 } from "../../components/student/StudentShellV2";
import { TodayV2 } from "../../components/student/TodayV2";
import { LearnV2 } from "../../components/student/learn/LearnV2";
import StudentProgressDashboard from "../../components/student/StudentProgressDashboard";
import { LabsHubView } from "../../components/learner-experience/LabsHub";
import GlobalAssistantShell from "../../components/rag/GlobalAssistantShell";
import { StudentTutorPageContent } from "../../components/student/StudentTutorPageContent";
import { getAssistantRoleConfig } from "../../lib/ai/rag/assistantAccess";
import { labsTabFixture, showcaseFixture } from "../product-design-v2/labFixtures";
import { usePathname } from "./navigation";
import "../../app/globals.css";
function App() {
  const path = usePathname();
  const showcase = showcaseFixture("all");
  return <StudentShellV2 identity={{ name: "Component Preview", grade: 7, userId: "fixture-student", schoolId: "fixture-school" }} utilities={<GlobalAssistantShell roleConfig={getAssistantRoleConfig("STUDENT")!} initialGrade={7} suggestedSubjects={["MATH"]} positionClassName="bottom-40 right-4" />}>
    {path === "/student/today" ? <TodayV2 /> : path === "/student/learn" ? <LearnV2 /> : path === "/student/progress" ? <StudentProgressDashboard /> : path === "/student/labs" ? <LabsHubView tab={labsTabFixture(7)} requested={new URLSearchParams(location.search).get("tab")} showcase={showcase.labs} aiLabsEnabled /> : <StudentTutorPageContent available />}
  </StudentShellV2>;
}
createRoot(document.getElementById("root")!).render(<App />);
