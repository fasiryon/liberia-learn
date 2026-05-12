import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SubjectGrade, AttendanceSummary } from "@/lib/reportCards/generateReportCard";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

function gradeLetter(avg: number) {
  if (avg >= 90) return "A";
  if (avg >= 80) return "B";
  if (avg >= 70) return "C";
  if (avg >= 60) return "D";
  return "F";
}

export default async function PrintReportCardPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();

  const card = await prisma.reportCard.findUnique({
    where: { id: params.id },
    include: {
      student: {
        include: {
          user: { select: { name: true, schoolId: true } },
        },
      },
      term: {
        include: { academicYear: { select: { yearLabel: true } } },
      },
    },
  });

  if (!card) notFound();

  const role = (session.user as any).role as string;
  const userId = session.user.id;

  // Access control
  if (role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (card.studentId !== student?.id || card.status !== "PUBLISHED") notFound();
  } else if (role === "GUARDIAN") {
    const link = await prisma.studentGuardian.findFirst({
      where: { guardianId: userId, studentId: card.studentId },
    });
    if (!link || card.status !== "PUBLISHED") notFound();
  } else if (role === "TEACHER" || role === "ADMIN") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
    if (card.schoolId !== user?.schoolId) notFound();
  } else {
    notFound();
  }

  const school = await prisma.school.findUnique({
    where: { id: card.schoolId },
    select: { name: true },
  });

  const grades = card.subjectGrades as SubjectGrade[];
  const att = card.attendanceSummary as AttendanceSummary;
  const studentName = card.student.user.name ?? "Student";
  const termName = card.term.name;
  const yearLabel = card.term.academicYear.yearLabel;
  const schoolName = school?.name ?? "LiberiaLearn School";

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 16mm; }
        }
        body { font-family: Georgia, serif; background: white; color: #111; }
      `}</style>

      <main
        style={{
          maxWidth: "794px",
          margin: "0 auto",
          padding: "40px 48px",
          background: "white",
          color: "#111",
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <p style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#555" }}>
            {schoolName}
          </p>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "6px 0" }}>
            OFFICIAL REPORT CARD
          </h1>
          <p style={{ fontSize: "12px", color: "#555" }}>
            Liberia Ministry of Education &mdash; Academic Year {yearLabel}
          </p>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #111", marginBottom: "20px" }} />

        {/* Student info row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            marginBottom: "24px",
            fontSize: "13px",
          }}
        >
          <div>
            <p style={{ color: "#555", fontSize: "11px", textTransform: "uppercase", marginBottom: "2px" }}>Student Name</p>
            <p style={{ fontWeight: "bold" }}>{studentName}</p>
          </div>
          <div>
            <p style={{ color: "#555", fontSize: "11px", textTransform: "uppercase", marginBottom: "2px" }}>Term</p>
            <p style={{ fontWeight: "bold" }}>{termName}</p>
          </div>
          <div>
            <p style={{ color: "#555", fontSize: "11px", textTransform: "uppercase", marginBottom: "2px" }}>Academic Year</p>
            <p style={{ fontWeight: "bold" }}>{yearLabel}</p>
          </div>
        </div>

        {/* Subject grades table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f5f5f5", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "bold" }}>Subject</th>
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: "bold" }}>Avg Score</th>
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: "bold" }}>Exam</th>
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: "bold" }}>Mastery</th>
              <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: "bold" }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.subject} style={{ borderBottom: "1px solid #e0e0e0" }}>
                <td style={{ padding: "7px 10px" }}>{g.subject.replace(/_/g, " ")}</td>
                <td style={{ padding: "7px 10px", textAlign: "center" }}>{g.average}%</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#555" }}>
                  {g.examScore != null ? `${g.examScore}%` : "—"}
                </td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#555" }}>
                  {g.masteryScore != null ? `${g.masteryScore}%` : "—"}
                </td>
                <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: "bold" }}>
                  {gradeLetter(g.average)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Grading key */}
        <p style={{ fontSize: "11px", color: "#666", marginBottom: "20px" }}>
          Grading: A = 90–100 &nbsp; B = 80–89 &nbsp; C = 70–79 &nbsp; D = 60–69 &nbsp; F = Below 60
        </p>

        {/* Attendance box */}
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "20px",
            fontSize: "13px",
          }}
        >
          <p style={{ fontWeight: "bold", marginBottom: "6px" }}>Attendance</p>
          <div style={{ display: "flex", gap: "24px" }}>
            <span>Present: <strong>{att.present}</strong></span>
            <span>Absent: <strong>{att.absent}</strong></span>
            <span>Late: <strong>{att.late}</strong></span>
            <span>Attendance Rate: <strong>{att.rate}%</strong></span>
          </div>
        </div>

        {/* Teacher comment */}
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "16px",
            minHeight: "60px",
            fontSize: "13px",
          }}
        >
          <p style={{ fontWeight: "bold", marginBottom: "4px" }}>Teacher Comment</p>
          <p style={{ color: card.teacherComment ? "#111" : "#aaa" }}>
            {card.teacherComment ?? "No comment provided."}
          </p>
        </div>

        {/* Principal comment */}
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "28px",
            minHeight: "60px",
            fontSize: "13px",
          }}
        >
          <p style={{ fontWeight: "bold", marginBottom: "4px" }}>Principal Comment</p>
          <p style={{ color: card.principalComment ? "#111" : "#aaa" }}>
            {card.principalComment ?? "No comment provided."}
          </p>
        </div>

        {/* Signature lines */}
        <div style={{ display: "flex", gap: "60px", marginBottom: "36px", fontSize: "13px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid #111", paddingTop: "4px" }}>
              Teacher Signature
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderTop: "1px solid #111", paddingTop: "4px" }}>
              Principal Signature
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: "11px", color: "#888", borderTop: "1px solid #e0e0e0", paddingTop: "12px" }}>
          Generated by LiberiaLearn &mdash; Liberia Ministry of Education
        </p>

        <PrintButton />
      </main>
    </>
  );
}
