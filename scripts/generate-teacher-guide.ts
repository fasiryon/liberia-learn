/**
 * Generates a 2-page A4 Teacher Quick-Start Guide PDF and uploads it to Vercel Blob.
 * Sets (or logs) the TEACHER_GUIDE_BLOB_URL env var for use in app/teacher/help/page.tsx.
 *
 * Usage:
 *   npx tsx scripts/generate-teacher-guide.ts
 *
 * Requires:
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob write token
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import { put } from "@vercel/blob";

// ── Styles ──────────────────────────────────────────────────────────────────

const YELLOW = "#F59E0B";
const DARK   = "#111827";
const MUTED  = "#6B7280";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 40,
    paddingVertical: 36,
    fontSize: 10,
    color: DARK,
  },
  headerBar: {
    backgroundColor: YELLOW,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 9,
    color: "#FEF3C7",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: YELLOW,
    paddingBottom: 3,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 7,
    alignItems: "flex-start",
  },
  stepBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: YELLOW,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 1,
  },
  stepNum: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  stepTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  stepDesc: {
    fontSize: 9,
    color: MUTED,
    marginTop: 1,
    lineHeight: 1.4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  colFeature: { width: "35%", fontFamily: "Helvetica-Bold", fontSize: 9 },
  colPath:    { width: "65%", color: MUTED, fontSize: 9 },
  faqCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 7,
    marginBottom: 6,
  },
  faqQ: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 2 },
  faqA: { fontSize: 9, color: MUTED, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: MUTED },
  pageNum: { fontSize: 8, color: MUTED },
  twoCol: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  tip: {
    backgroundColor: "#FFFBEB",
    borderLeftWidth: 3,
    borderLeftColor: YELLOW,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
    borderRadius: 2,
  },
  tipText: { fontSize: 9, color: DARK, lineHeight: 1.4 },
});

// ── Data ────────────────────────────────────────────────────────────────────

const STEPS = [
  { n: "1", title: "Create a Class", desc: "Classes → New Class. Pick a subject and grade. Students enrol with the class code." },
  { n: "2", title: "Add Students", desc: "Share your school code for self-registration, or Admin → Import Students (CSV)." },
  { n: "3", title: "Assign a Lesson", desc: "Curriculum Library → pick an MOE-aligned lesson → 'Assign to Class'. Appears instantly." },
  { n: "4", title: "Review Homework", desc: "Assignments → Submissions. AI pre-grades each entry — you approve or adjust before release." },
  { n: "5", title: "Message a Guardian", desc: "Student profile → Message Guardian. They receive a push notification and can reply." },
];

const FEATURES = [
  ["Lessons",              "/teacher/lessons"],
  ["Assignments & Grading","/teacher/assignments"],
  ["Gradebook",            "/teacher/gradebook"],
  ["AI Tutor Oversight",   "/teacher/tutor-analytics"],
  ["Guardian Messages",    "/teacher/messages"],
  ["Offline Mode",         "Auto-enabled on poor connections"],
  ["Alert Preferences",    "/teacher/settings/alerts"],
];

const FAQS = [
  {
    q: "Students can't see the lesson I assigned",
    a: "Make sure the lesson is Published (not Draft). Go to Curriculum → My Lessons and check the status badge.",
  },
  {
    q: "Offline mode isn't saving lessons",
    a: "Students must tap 'Save for Offline' while connected. The offline banner appears when connection drops.",
  },
  {
    q: "AI grades seem wrong",
    a: "You have full authority to override any AI grade in the Submissions view. Approved grades are final.",
  },
  {
    q: "A guardian isn't receiving messages",
    a: "Confirm the guardian linked their account via the guardian portal. Check their notification settings.",
  },
];

const TIPS = [
  "Use the AI Tutor tab to see which concepts students asked about most — it reveals hidden confusion before test day.",
  "Enable Daily Digest alerts (Settings → Alerts) to get a morning summary instead of individual notifications.",
  "Download progress reports (Gradebook → Report Cards) as PDFs to share at parent meetings.",
];

// ── Document ─────────────────────────────────────────────────────────────────

function GuideDocument() {
  return React.createElement(
    Document,
    { title: "LiberiaLearn Teacher Quick-Start Guide", author: "LiberiaLearn" },
    // PAGE 1
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.headerBar },
        React.createElement(Text, { style: styles.headerTitle }, "LiberiaLearn"),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.headerSub }, "Teacher Quick-Start Guide"),
          React.createElement(Text, { style: styles.headerSub }, "Ministry of Education — Liberia"),
        ),
      ),
      // Getting Started
      React.createElement(Text, { style: styles.sectionTitle }, "Getting Started — 5 Key Steps"),
      ...STEPS.map((s) =>
        React.createElement(
          View,
          { key: s.n, style: styles.stepRow },
          React.createElement(
            View,
            { style: styles.stepBadge },
            React.createElement(Text, { style: styles.stepNum }, s.n),
          ),
          React.createElement(
            View,
            { style: { flex: 1 } },
            React.createElement(Text, { style: styles.stepTitle }, s.title),
            React.createElement(Text, { style: styles.stepDesc }, s.desc),
          ),
        ),
      ),
      // Feature Overview
      React.createElement(Text, { style: styles.sectionTitle }, "Feature Overview"),
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: { ...styles.colFeature, color: DARK } }, "Feature"),
        React.createElement(Text, { style: { ...styles.colPath, color: DARK } }, "Where to find it"),
      ),
      ...FEATURES.map(([feat, path]) =>
        React.createElement(
          View,
          { key: feat, style: styles.tableRow },
          React.createElement(Text, { style: styles.colFeature }, feat),
          React.createElement(Text, { style: styles.colPath }, path),
        ),
      ),
      // Footer p1
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerText }, "liberialearn52@gmail.com"),
        React.createElement(
          Text,
          { style: styles.pageNum, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` },
        ),
      ),
    ),
    // PAGE 2
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.headerBar },
        React.createElement(Text, { style: styles.headerTitle }, "LiberiaLearn"),
        React.createElement(Text, { style: styles.headerSub }, "Troubleshooting & Tips — Page 2"),
      ),
      // Two-column layout
      React.createElement(
        View,
        { style: styles.twoCol },
        // Left: FAQ
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(Text, { style: styles.sectionTitle }, "Troubleshooting"),
          ...FAQS.map((f) =>
            React.createElement(
              View,
              { key: f.q, style: styles.faqCard },
              React.createElement(Text, { style: styles.faqQ }, f.q),
              React.createElement(Text, { style: styles.faqA }, f.a),
            ),
          ),
        ),
        // Right: Tips + Support
        React.createElement(
          View,
          { style: styles.col },
          React.createElement(Text, { style: styles.sectionTitle }, "Pro Tips"),
          ...TIPS.map((tip, i) =>
            React.createElement(
              View,
              { key: i, style: styles.tip },
              React.createElement(Text, { style: styles.tipText }, tip),
            ),
          ),
          React.createElement(Text, { style: { ...styles.sectionTitle, marginTop: 18 } }, "Need More Help?"),
          React.createElement(
            View,
            { style: { ...styles.faqCard, borderColor: YELLOW } },
            React.createElement(Text, { style: { ...styles.faqQ, color: DARK } }, "Email Support"),
            React.createElement(Text, { style: styles.faqA }, "liberialearn52@gmail.com"),
            React.createElement(Text, { style: { ...styles.faqQ, marginTop: 8 } }, "Help Centre"),
            React.createElement(Text, { style: styles.faqA }, "Visit /teacher/help in the app for interactive guides and the latest troubleshooting articles."),
          ),
        ),
      ),
      // Footer p2
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerText }, "liberialearn52@gmail.com"),
        React.createElement(
          Text,
          { style: styles.pageNum, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}` },
        ),
      ),
    ),
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Error: BLOB_READ_WRITE_TOKEN is not set.");
    process.exit(1);
  }

  console.log("Rendering PDF...");
  const buffer = await renderToBuffer(React.createElement(GuideDocument));
  console.log(`PDF size: ${(buffer.length / 1024).toFixed(1)} KB`);

  console.log("Uploading to Vercel Blob...");
  const blob = await put("guides/teacher-quick-start.pdf", buffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });

  console.log("\nUpload complete.");
  console.log("Blob URL:", blob.url);
  console.log("\nSet this in Vercel environment variables:");
  console.log(`  TEACHER_GUIDE_BLOB_URL=${blob.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
