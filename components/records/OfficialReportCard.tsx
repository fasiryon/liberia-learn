import type { ReportCardView } from "@/lib/academic-records/v2/reportCardView";

/**
 * Accessible, printable official report card (Academic Records V2). Server-renderable, no client
 * state. Not yet mounted on any route: activation is a separate, authorized change.
 */
export function OfficialReportCard({ view }: { view: ReportCardView }) {
  return (
    <article aria-labelledby="report-card-heading" className="mx-auto max-w-3xl space-y-6 bg-[var(--ll-surface,white)] p-6 text-[var(--ll-text,#111)] print:max-w-none print:p-0">
      <header className="space-y-1 border-b border-[var(--ll-border,#ccc)] pb-4">
        <h1 id="report-card-heading" className="text-xl font-semibold">{view.heading}</h1>
        <p className="text-sm">{view.subheading}</p>
        {view.watermark ? (
          <p role="status" className="mt-2 inline-block rounded border-2 border-current px-2 py-1 text-sm font-bold uppercase tracking-wide">
            {view.watermark}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="grades-heading">
        <h2 id="grades-heading" className="mb-2 text-lg font-semibold">Academic grades</h2>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Subject grades for this reporting period, with how each grade was made up</caption>
          <thead>
            <tr className="border-b border-[var(--ll-border,#ccc)] text-left">
              <th scope="col" className="py-2 pr-3">Subject</th>
              <th scope="col" className="py-2 pr-3">Grade</th>
              <th scope="col" className="py-2 pr-3">Result</th>
              <th scope="col" className="py-2">How the grade was made up</th>
            </tr>
          </thead>
          <tbody>
            {view.subjects.map((subject) => (
              <tr key={subject.subject} className="border-b border-[var(--ll-border,#eee)] align-top">
                <th scope="row" className="py-2 pr-3 text-left font-medium">{subject.subject}</th>
                <td className="py-2 pr-3">{subject.grade}</td>
                <td className="py-2 pr-3">{subject.result}</td>
                <td className="py-2">
                  {subject.breakdown}
                  {subject.comment ? <p className="mt-1 italic">Teacher: {subject.comment}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="attendance-heading">
        <h2 id="attendance-heading" className="mb-1 text-lg font-semibold">Attendance</h2>
        <p className="text-sm">{view.attendance}</p>
      </section>

      <section aria-labelledby="mastery-heading" className="rounded border border-dashed border-[var(--ll-border,#999)] p-4">
        <h2 id="mastery-heading" className="text-lg font-semibold">{view.mastery.title}</h2>
        <p className="mb-2 text-sm">{view.mastery.note}</p>
        {view.mastery.rows.length === 0 ? (
          <p className="text-sm">No skill mastery evidence has been recorded yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Skill mastery indicators, separate from academic grades</caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="py-1 pr-3">Subject</th>
                <th scope="col" className="py-1 pr-3">Skill</th>
                <th scope="col" className="py-1">Level</th>
              </tr>
            </thead>
            <tbody>
              {view.mastery.rows.map((row) => (
                <tr key={`${row.subject}-${row.objective}`}>
                  <td className="py-1 pr-3">{row.subject}</td>
                  <td className="py-1 pr-3">{row.objective}</td>
                  <td className="py-1">{row.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {([
        ["strengths", "Strengths", view.strengths],
        ["improvement", "Areas for improvement", view.areasForImprovement],
        ["intervention", "Support plan", view.interventionPlan],
      ] as const).map(([id, title, items]) => (items.length > 0 ? (
        <section key={id} aria-labelledby={`${id}-heading`}>
          <h2 id={`${id}-heading`} className="mb-1 text-lg font-semibold">{title}</h2>
          <ul className="list-disc pl-5 text-sm">{items.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null))}

      {view.yearEnd ? (
        <section aria-labelledby="year-end-heading">
          <h2 id="year-end-heading" className="mb-1 text-lg font-semibold">Year-end decision</h2>
          <p className="text-sm font-medium">{view.yearEnd}</p>
        </section>
      ) : null}

      {view.principalComment ? (
        <section aria-labelledby="principal-heading">
          <h2 id="principal-heading" className="mb-1 text-lg font-semibold">Principal&apos;s comment</h2>
          <p className="text-sm">{view.principalComment}</p>
        </section>
      ) : null}

      <footer className="border-t border-[var(--ll-border,#ccc)] pt-3 text-xs">
        {view.amendmentNotice ? <p className="font-medium">{view.amendmentNotice}</p> : null}
        <p>{view.recordLine}</p>
      </footer>
    </article>
  );
}
