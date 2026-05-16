import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

export type ProgressReportData = {
  studentName: string;
  grade: number | null;
  termName: string;
  schoolName: string;
  generatedDate: string;
  attendance: {
    present: number;
    absent: number;
    late: number;
    rate: number;
  };
  subjects: Array<{
    subject: string;
    assignmentsAvg: number;
    examScore: number | null;
    masteryPct: number | null;
    gradeLetter: string;
  }>;
  overallAvg: number;
  lessonCompletion: {
    total: number;
    bySubject: Array<{ subject: string; completed: number; total: number }>;
  };
  teacherComment: string | null;
};

function gradeLetter(avg: number) {
  if (avg >= 90) return "A";
  if (avg >= 80) return "B";
  if (avg >= 70) return "C";
  if (avg >= 60) return "D";
  return "F";
}

function barString(completed: number, total: number, width = 10): string {
  if (total === 0) return "░".repeat(width);
  const filled = Math.round((completed / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function attendanceColor(rate: number): string {
  if (rate >= 90) return "#16a34a";
  if (rate >= 75) return "#d97706";
  return "#dc2626";
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111",
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
  },
  headerSchool: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#555",
    textAlign: "center",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 8,
    color: "#555",
    textAlign: "center",
    marginBottom: 16,
  },
  divider: {
    borderBottomWidth: 2,
    borderBottomColor: "#111",
    marginBottom: 14,
  },
  studentRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  studentCell: {
    flex: 1,
  },
  cellLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    color: "#777",
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 2,
  },
  table: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#fafafa",
  },
  colSubject: { width: "30%", fontFamily: "Helvetica-Bold", fontSize: 9 },
  colCenter: { width: "17.5%", textAlign: "center", fontSize: 9 },
  colGrade: { width: "17.5%", textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 10, color: "#166534" },
  colHeaderSubject: { width: "30%", fontFamily: "Helvetica-Bold", fontSize: 9, color: "#555" },
  colHeaderCenter: { width: "17.5%", textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 9, color: "#555" },
  attendanceBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 3,
    padding: 10,
    marginBottom: 10,
  },
  attendanceRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
  },
  attendanceStat: {
    fontSize: 9,
  },
  attendanceRate: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  lessonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 3,
    fontSize: 9,
  },
  lessonSubject: {
    width: "18%",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  lessonBar: {
    width: "55%",
    fontFamily: "Courier",
    fontSize: 8,
    color: "#166534",
  },
  lessonCount: {
    width: "27%",
    fontSize: 8,
    color: "#555",
  },
  commentBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 3,
    padding: 10,
    minHeight: 50,
    marginBottom: 14,
  },
  signatureRow: {
    flexDirection: "row",
    gap: 30,
    marginBottom: 30,
    marginTop: 10,
  },
  signatureLine: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 3,
    fontSize: 9,
    color: "#555",
  },
  footer: {
    fontSize: 8,
    color: "#999",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 8,
    marginTop: "auto",
  },
  overallRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#f0fdf4",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  overallLabel: { width: "30%", fontFamily: "Helvetica-Bold", fontSize: 9 },
  overallValue: { width: "17.5%", textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: 10, color: "#166534" },
  overallSpacer: { width: "17.5%" },
});

export function ProgressReportDocument({ data }: { data: ProgressReportData }) {
  const attColor = attendanceColor(data.attendance.rate);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <Text style={styles.headerSchool}>{data.schoolName}</Text>
        <Text style={styles.headerTitle}>STUDENT PROGRESS REPORT</Text>
        <Text style={styles.headerSub}>Liberia Ministry of Education</Text>
        <View style={styles.divider} />

        {/* Student info */}
        <View style={styles.studentRow}>
          <View style={styles.studentCell}>
            <Text style={styles.cellLabel}>Student Name</Text>
            <Text style={styles.cellValue}>{data.studentName}</Text>
          </View>
          <View style={styles.studentCell}>
            <Text style={styles.cellLabel}>Grade</Text>
            <Text style={styles.cellValue}>{data.grade != null ? `Grade ${data.grade}` : "—"}</Text>
          </View>
          <View style={styles.studentCell}>
            <Text style={styles.cellLabel}>Term</Text>
            <Text style={styles.cellValue}>{data.termName}</Text>
          </View>
          <View style={styles.studentCell}>
            <Text style={styles.cellLabel}>Date Generated</Text>
            <Text style={styles.cellValue}>{data.generatedDate}</Text>
          </View>
        </View>

        {/* SECTION 1 — Attendance */}
        <Text style={styles.sectionTitle}>Section 1 — Attendance Summary</Text>
        <View style={styles.attendanceBox}>
          <View style={styles.attendanceRow}>
            <Text style={styles.attendanceStat}>Present: <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.attendance.present}</Text> days</Text>
            <Text style={styles.attendanceStat}>Absent: <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.attendance.absent}</Text></Text>
            <Text style={styles.attendanceStat}>Late: <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.attendance.late}</Text></Text>
          </View>
          <Text style={{ ...styles.attendanceRate, marginTop: 6, color: attColor }}>
            Attendance Rate: {data.attendance.rate}%{" "}
            {data.attendance.rate >= 90 ? "(Excellent)" : data.attendance.rate >= 75 ? "(Satisfactory)" : "(Needs Improvement)"}
          </Text>
        </View>

        {/* SECTION 2 — Academic Performance */}
        <Text style={styles.sectionTitle}>Section 2 — Academic Performance</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colHeaderSubject}>Subject</Text>
            <Text style={styles.colHeaderCenter}>Assignments Avg</Text>
            <Text style={styles.colHeaderCenter}>Exam Score</Text>
            <Text style={styles.colHeaderCenter}>Mastery %</Text>
            <Text style={styles.colHeaderCenter}>Grade</Text>
          </View>
          {data.subjects.map((s, i) => (
            <View key={s.subject} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.colSubject}>{s.subject.replace(/_/g, " ")}</Text>
              <Text style={styles.colCenter}>{s.assignmentsAvg}%</Text>
              <Text style={styles.colCenter}>{s.examScore != null ? `${s.examScore}%` : "—"}</Text>
              <Text style={styles.colCenter}>{s.masteryPct != null ? `${s.masteryPct}%` : "—"}</Text>
              <Text style={styles.colGrade}>{s.gradeLetter}</Text>
            </View>
          ))}
          <View style={styles.overallRow}>
            <Text style={styles.overallLabel}>Overall Average</Text>
            <Text style={styles.overallSpacer} />
            <Text style={styles.overallSpacer} />
            <Text style={styles.overallSpacer} />
            <Text style={styles.overallValue}>{gradeLetter(data.overallAvg)} ({data.overallAvg}%)</Text>
          </View>
        </View>

        {/* SECTION 3 — Lesson Completion */}
        <Text style={styles.sectionTitle}>Section 3 — Lesson Completion</Text>
        <Text style={{ fontSize: 9, marginBottom: 6, color: "#555" }}>
          Total lessons completed this term: {data.lessonCompletion.total}
        </Text>
        {data.lessonCompletion.bySubject.map((s) => (
          <View key={s.subject} style={styles.lessonRow}>
            <Text style={styles.lessonSubject}>{s.subject.replace(/_/g, " ").slice(0, 10)}</Text>
            <Text style={styles.lessonBar}>{barString(s.completed, s.total)}</Text>
            <Text style={styles.lessonCount}>{s.completed}/{s.total}</Text>
          </View>
        ))}

        {/* SECTION 4 — Teacher Comment */}
        <Text style={styles.sectionTitle}>Section 4 — Teacher Comment</Text>
        <View style={styles.commentBox}>
          <Text style={{ fontSize: 9, color: data.teacherComment ? "#111" : "#aaa" }}>
            {data.teacherComment ?? "No comment added."}
          </Text>
        </View>

        {/* SECTION 5 — Signatures */}
        <Text style={styles.sectionTitle}>Section 5 — Signatures</Text>
        <View style={styles.signatureRow}>
          <View style={styles.signatureLine}><Text>Teacher</Text><Text style={{ marginTop: 18 }}>Date: ___________</Text></View>
          <View style={styles.signatureLine}><Text>Parent / Guardian</Text><Text style={{ marginTop: 18 }}>Date: ___________</Text></View>
          <View style={styles.signatureLine}><Text>Principal</Text><Text style={{ marginTop: 18 }}>Date: ___________</Text></View>
        </View>

        {/* FOOTER */}
        <Text style={styles.footer}>
          Generated by LiberiaLearn | Liberia Ministry of Education | {data.generatedDate}
        </Text>
      </Page>
    </Document>
  );
}
