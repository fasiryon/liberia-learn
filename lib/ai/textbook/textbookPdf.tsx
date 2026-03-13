import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToStream,
} from "@react-pdf/renderer";
import type { TextbookResult } from "./textbookCompiler";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#0f172a",
  },
  cover: {
    display: "flex",
    justifyContent: "center",
    height: "100%",
  },
  eyebrow: {
    fontSize: 12,
    color: "#047857",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
    fontWeight: 700,
  },
  unitTitle: {
    fontSize: 20,
    marginBottom: 10,
    fontWeight: 700,
  },
  lessonTitle: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 700,
    color: "#111827",
  },
  paragraph: {
    marginBottom: 8,
  },
  tocRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  lessonMeta: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  listItem: {
    marginBottom: 5,
  },
  answerHeader: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 700,
  },
});

function estimateUnitPage(result: TextbookResult, unitIndex: number) {
  let page = 3;
  for (let index = 0; index < unitIndex; index += 1) {
    page += 1 + result.units[index].lessons.length;
  }
  return page;
}

function TextbookDocument({ result }: { result: TextbookResult }) {
  return (
    <Document title={result.title} author="LiberiaLearn">
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.eyebrow}>LiberiaLearn</Text>
          <Text style={styles.title}>
            {result.subject.replace(/_/g, " ")} Grade {result.gradeLevel}
          </Text>
          <Text style={styles.subtitle}>Ministry of Education, Liberia</Text>
          <Text style={styles.subtitle}>Academic Year 2026</Text>
          <Text style={styles.subtitle}>
            Generated: {result.generatedAt.toLocaleDateString("en-LR")}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Table of Contents</Text>
        {result.units.map((unit, index) => (
          <View key={unit.unitId} style={styles.tocRow}>
            <Text>
              Unit {index + 1}: {unit.title}
            </Text>
            <Text>p{estimateUnitPage(result, index)}</Text>
          </View>
        ))}
      </Page>

      {result.units.flatMap((unit, unitIndex) => [
        <Page key={`${unit.unitId}-cover`} size="A4" style={styles.page}>
          <Text style={styles.eyebrow}>Unit {unitIndex + 1}</Text>
          <Text style={styles.unitTitle}>{unit.title}</Text>
          <Text style={styles.paragraph}>
            {unit.description?.trim() || "No unit description provided."}
          </Text>
          <Text style={styles.paragraph}>
            {unit.subject.replace(/_/g, " ")} | Grade {unit.gradeLevel} | {unit.lessons.length} lessons
          </Text>
        </Page>,
        ...unit.lessons.map((lesson) => (
          <Page key={lesson.id} size="A4" style={styles.page}>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <Text style={styles.lessonMeta}>
              {lesson.lessonType ?? "lesson"} | Order {lesson.orderInUnit ?? "-"}
            </Text>
            {lesson.content
              .split(/\n{2,}/)
              .map((paragraph, index) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, index) => (
                <Text key={`${lesson.id}-paragraph-${index}`} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}

            {lesson.assessmentQuestions.length > 0 ? (
              <View>
                <Text style={styles.answerHeader}>Questions</Text>
                {lesson.assessmentQuestions.map((question, index) => (
                  <Text key={`${lesson.id}-question-${index}`} style={styles.listItem}>
                    {index + 1}. {question}
                  </Text>
                ))}
              </View>
            ) : null}

            {(lesson.lessonType === "assessment" || lesson.lessonType === "practice") &&
            lesson.answerKey.length > 0 ? (
              <View>
                <Text style={styles.answerHeader}>Answer Key</Text>
                {lesson.answerKey.map((answer, index) => (
                  <Text key={`${lesson.id}-answer-${index}`} style={styles.listItem}>
                    {index + 1}. {answer}
                  </Text>
                ))}
              </View>
            ) : null}
          </Page>
        )),
      ])}

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Generated by LiberiaLearn</Text>
        <Text style={styles.paragraph}>
          Generated by LiberiaLearn AI Curriculum Factory. Aligned with Ministry of Education
          of Liberia curriculum standards.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderTextbookPdfStream(result: TextbookResult) {
  return renderToStream(<TextbookDocument result={result} />);
}
