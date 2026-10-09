/** Browser-only fixture harness. Production components; explicit fake identity and mocked API data. */
import { createRoot } from "react-dom/client";
import { StudentShellV2 } from "../../components/student/StudentShellV2";
import { TodayV2 } from "../../components/student/TodayV2";
import GovernedLearningPage from "../../app/student/learn/page";
import "../../app/globals.css";
const path = window.location.pathname;
const grade = Number(new URLSearchParams(window.location.search).get("grade") ?? sessionStorage.getItem("fixture-grade") ?? 4);
sessionStorage.setItem("fixture-grade", String(grade));
createRoot(document.getElementById("root")!).render(<StudentShellV2 identity={{ name: "Pewu Fixture", grade, userId: "fixture-student", schoolId: "fixture-school" }}>
  {path === "/student/today" ? <TodayV2 /> : path === "/student/learn" ? <GovernedLearningPage /> : <main style={{ padding: 24 }}><a href="/student/today">Back to Today</a><h1>{path.includes("assignments") ? "Assignment fixture" : path.includes("labs") ? "Labs destination fixture" : path.includes("progress") ? "Progress destination fixture" : "Help destination fixture"}</h1><p>Destination routing fixture. This harness does not certify server authorization or the destination screen.</p></main>}
</StudentShellV2>);
