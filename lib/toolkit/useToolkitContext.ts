"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useToolkit } from "@/components/toolkit/ToolkitContext";
import type { GradeBand, LessonType, Subject, ToolContext } from "@/lib/toolkit/toolRegistry";

const GRADE_BANDS: GradeBand[] = ["1-3", "4-6", "7-9", "10-12"];
const LESSON_TYPES: LessonType[] = ["assessment", "practice", "lesson", "lab"];
const SUBJECTS: Subject[] = ["math", "science", "english", "engineering", "cs"];

export function useToolkitContext(): ToolContext | null {
  const runtime = useToolkit();
  const params = useParams();
  const search = useSearchParams();

  return useMemo(() => {
    if (runtime?.context) return runtime.context;

    const fromSearch = {
      subject: search.get("subject") ?? undefined,
      gradeBand: search.get("gradeBand") ?? undefined,
      lessonType: search.get("lessonType") ?? undefined,
      strandKey: search.get("strandKey") ?? undefined,
    };

    const inferredLessonType =
      fromSearch.lessonType ??
      (typeof params?.mode === "string" ? params.mode : undefined) ??
      (typeof params?.lessonType === "string" ? params.lessonType : undefined);

    const inferredSubject =
      fromSearch.subject ??
      (typeof params?.subject === "string" ? params.subject : undefined);

    const inferredGradeBand =
      fromSearch.gradeBand ??
      (typeof params?.gradeBand === "string" ? params.gradeBand : undefined);

    if (
      !inferredSubject ||
      !inferredGradeBand ||
      !inferredLessonType ||
      !SUBJECTS.includes(inferredSubject as Subject) ||
      !GRADE_BANDS.includes(inferredGradeBand as GradeBand) ||
      !LESSON_TYPES.includes(inferredLessonType as LessonType)
    ) {
      return null;
    }

    return {
      subject: inferredSubject as Subject,
      gradeBand: inferredGradeBand as GradeBand,
      lessonType: inferredLessonType as LessonType,
      strandKey: fromSearch.strandKey,
    };
  }, [params, runtime, search]);
}
