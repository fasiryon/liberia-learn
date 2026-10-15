/** The assistant remains the layout's existing grounded instance, portalled into this page-owned host. */
export function StudentTutorPageContent({ available }: { available: boolean }) {
  return <main className="pdv2-dashboard-page" aria-labelledby="student-help-heading">
    <header className="student-tutor-page-header"><h1 id="student-help-heading">Help with your learning</h1>
      <p>{available ? "Ask a question about a lesson or concept. Your class and grade set the scope of the help you receive." : "The AI tutor is temporarily unavailable. Please ask your teacher for help with this topic."}</p>
    </header>
    {available && <div id="student-tutor-panel" className="student-tutor-host" />}
  </main>;
}
