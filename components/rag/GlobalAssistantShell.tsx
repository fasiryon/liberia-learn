"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { AssistantRoleConfig } from "@/lib/ai/rag/assistantAccess";
import {
  getAssistantActionEndpoint,
  type AssistantAction,
} from "@/lib/ai/rag/assistantActions";
import type {
  RetrievalContextMode,
  RetrievalMode,
} from "@/lib/ai/rag/retrievalService";

type Source = {
  id: string;
  title: string;
  excerpt: string;
  sourceType: "curriculum" | "lesson" | "standard" | "policy";
  sourceLabel: string | null;
  similarity: number;
  groundingStrength?: "weak" | "grounded";
};

type QueryResult = {
  answer: string;
  sources: Source[];
  retrievalWeak: boolean;
  hadFallback: boolean;
  isWeakGrounding: boolean;
  actions: AssistantAction[];
};

type Message = {
  id: string;
  question: string;
  result?: QueryResult;
  error?: string;
  actionResult?: {
    label: string;
    content: string;
  };
  actionError?: string;
};

type PendingActionConfirmation = {
  messageId: string;
  action: AssistantAction;
};

type GuardianLearner = {
  id: string;
  label: string;
  grade: number | null;
  subjects: string[];
};

type Props = {
  roleConfig: AssistantRoleConfig;
  initialGrade: number | null;
  suggestedSubjects: string[];
  guardianLearners?: GuardianLearner[];
  positionClassName?: string;
  initialOpen?: boolean;
  contextStorageKey?: string;
  initialMessages?: Message[];
  initialPendingConfirmation?: PendingActionConfirmation | null;
};

type CachedAssistantContext = {
  subject?: string;
  gradeLevel?: string;
};

function normalizeErrorMessage(status: number, error: string | undefined) {
  if (status === 403) {
    return "That question is outside the assistant scope for your account.";
  }

  if (status === 404 && error === "rag_disabled") {
    return "The assistant is not available right now.";
  }

  return error ?? "Assistant request failed";
}

function inferAssistantContextMode(
  pathname: string,
  role: AssistantRoleConfig["role"]
): RetrievalContextMode {
  const normalizedPath = pathname.toLowerCase();

  if (normalizedPath.startsWith("/teacher/homework")) {
    return "homework";
  }

  if (normalizedPath.startsWith("/teacher/curriculum")) {
    return "lesson";
  }

  if (normalizedPath.startsWith("/teacher")) {
    return "mixed";
  }

  if (normalizedPath.startsWith("/student")) {
    return "learning";
  }

  if (normalizedPath.startsWith("/guardian")) {
    return "support";
  }

  if (
    normalizedPath.startsWith("/admin") ||
    normalizedPath.startsWith("/moe") ||
    role === "ADMIN"
  ) {
    return "governance";
  }

  return "mixed";
}

function formatModeLabel(mode: RetrievalContextMode): string {
  switch (mode) {
    case "lesson":
      return "Lesson";
    case "homework":
      return "Homework";
    case "learning":
      return "Learning";
    case "support":
      return "Support";
    case "governance":
      return "Governance";
    default:
      return "Mixed";
  }
}

function ScopeBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-xs text-[var(--ll-text)]">
      <span className="font-semibold text-[var(--ll-text)]">{label}:</span> {value}
    </div>
  );
}

function getSourceBadge(sourceType: Source["sourceType"]) {
  switch (sourceType) {
    case "curriculum":
      return "\u{1F4D8} Curriculum";
    case "lesson":
      return "\u{1F4D7} Lesson";
    case "standard":
      return "\u{1F4CA} Standard";
    case "policy":
      return "\u{1F4C4} Policy";
  }
}

function formatActionDraft(payload: any): string {
  if (typeof payload?.draftText === "string") {
    return payload.draftText;
  }

  if (typeof payload?.draft?.summary === "string") {
    return payload.draft.summary;
  }

  if (typeof payload?.draft?.headline === "string") {
    return payload.draft.headline;
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  return "Draft prepared.";
}

export function buildExplainDifferentlyQuestion(action: AssistantAction): string {
  return `Explain this differently: ${action.payload.question}`;
}

export default function GlobalAssistantShell({
  roleConfig,
  initialGrade,
  suggestedSubjects,
  guardianLearners = [],
  positionClassName,
  initialOpen = false,
  contextStorageKey = "liberialearn:assistant-context",
  initialMessages = [],
  initialPendingConfirmation = null,
}: Props) {
  const pathname = usePathname() ?? "/";
  const storageKey = "liberialearn-global-assistant-open";
  // The nav-visible "AI Tutor" page IS this shell, auto-opened and expanded
  // rather than a separate chat implementation (Tutor Architecture Consolidation).
  const isDedicatedPage = pathname === "/student/ai-tutor";
  const role = roleConfig.role;
  const isTeacherOrAdmin = role === "TEACHER" || role === "ADMIN";
  const isStudent = role === "STUDENT";
  const isGuardian = role === "GUARDIAN";
  const [open, setOpen] = useState(initialOpen);
  const [question, setQuestion] = useState("");
  const [teacherSubject, setTeacherSubject] = useState(suggestedSubjects[0] ?? "");
  const [teacherGrade, setTeacherGrade] = useState(
    initialGrade ? String(initialGrade) : ""
  );
  const [mode, setMode] = useState<RetrievalMode>(roleConfig.defaultMode);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingActionConfirmation | null>(initialPendingConfirmation);
  const [selectedGuardianLearnerId, setSelectedGuardianLearnerId] = useState(
    guardianLearners[0]?.id ?? ""
  );
  const [selectedScopedSubject, setSelectedScopedSubject] = useState(
    suggestedSubjects[0] ?? ""
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isDedicatedPage) {
      setOpen(true);
      return;
    }

    const saved = window.localStorage.getItem(storageKey);
    if (saved === "true") {
      setOpen(true);
    }
  }, [isDedicatedPage]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, open ? "true" : "false");
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const cached = window.sessionStorage.getItem(contextStorageKey);
      if (!cached) {
        return;
      }

      const parsed = JSON.parse(cached) as CachedAssistantContext;
      if (isTeacherOrAdmin) {
        if (!teacherSubject && parsed.subject) {
          setTeacherSubject(parsed.subject);
        }
        if (!teacherGrade && parsed.gradeLevel) {
          setTeacherGrade(parsed.gradeLevel);
        }
        return;
      }

      if (!selectedScopedSubject && parsed.subject) {
        setSelectedScopedSubject(parsed.subject);
      }
    } catch {
      window.sessionStorage.removeItem(contextStorageKey);
    }
  }, [
    contextStorageKey,
    isTeacherOrAdmin,
    selectedScopedSubject,
    teacherGrade,
    teacherSubject,
  ]);

  useEffect(() => {
    if (!roleConfig.allowedModes.includes(mode)) {
      setMode(roleConfig.defaultMode);
    }
  }, [mode, roleConfig]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  const visibleModes = useMemo(
    () => roleConfig.allowedModes,
    [roleConfig.allowedModes]
  );
  const contextMode = useMemo(
    () => inferAssistantContextMode(pathname, roleConfig.role),
    [pathname, roleConfig.role]
  );
  const quickPrompts = useMemo(() => {
    if (contextMode === "governance") {
      return [
        "Summarize the policy implications here",
        "What governance risks should I check?",
        "Help me review this compliance question",
      ];
    }

    if (contextMode === "homework") {
      return [
        "Explain this homework topic",
        "Generate lesson plan steps for this homework",
        "Help student understand this assignment",
      ];
    }

    return [
      "Explain this topic",
      "Generate lesson plan",
      "Help student understand",
    ];
  }, [contextMode]);

  const selectedGuardianLearner = useMemo(
    () =>
      guardianLearners.find((learner) => learner.id === selectedGuardianLearnerId) ??
      guardianLearners[0] ??
      null,
    [guardianLearners, selectedGuardianLearnerId]
  );

  const scopedSubjectOptions = useMemo(() => {
    if (isGuardian) {
      return selectedGuardianLearner?.subjects ?? [];
    }

    if (isStudent) {
      return suggestedSubjects;
    }

    return [];
  }, [isGuardian, isStudent, selectedGuardianLearner, suggestedSubjects]);

  const scopedGrade = isGuardian
    ? selectedGuardianLearner?.grade ?? null
    : isStudent
      ? initialGrade
      : null;

  useEffect(() => {
    if (!isGuardian) {
      return;
    }

    if (
      selectedGuardianLearnerId &&
      guardianLearners.some((learner) => learner.id === selectedGuardianLearnerId)
    ) {
      return;
    }

    setSelectedGuardianLearnerId(guardianLearners[0]?.id ?? "");
  }, [guardianLearners, isGuardian, selectedGuardianLearnerId]);

  useEffect(() => {
    if (!isStudent && !isGuardian) {
      return;
    }

    if (
      selectedScopedSubject &&
      scopedSubjectOptions.includes(selectedScopedSubject)
    ) {
      return;
    }

    setSelectedScopedSubject(scopedSubjectOptions[0] ?? "");
  }, [isGuardian, isStudent, scopedSubjectOptions, selectedScopedSubject]);

  async function submitQuestion(questionOverride?: string) {
    const trimmedQuestion = (questionOverride ?? question).trim();
    if (!trimmedQuestion || loading) {
      return;
    }

    const selectedMode = visibleModes.includes(mode)
      ? mode
      : roleConfig.defaultMode;
    const messageId = `${Date.now()}`;
    const requestSubject = isTeacherOrAdmin
      ? teacherSubject || undefined
      : selectedScopedSubject || undefined;
    const requestGrade = isTeacherOrAdmin
      ? teacherGrade
        ? Number(teacherGrade)
        : undefined
      : typeof scopedGrade === "number"
        ? scopedGrade
        : undefined;
    const cachedContext = (() => {
      if (typeof window === "undefined") {
        return null;
      }

      try {
        const cached = window.sessionStorage.getItem(contextStorageKey);
        return cached ? (JSON.parse(cached) as CachedAssistantContext) : null;
      } catch {
        window.sessionStorage.removeItem(contextStorageKey);
        return null;
      }
    })();
    const resolvedSubject = requestSubject ?? cachedContext?.subject ?? undefined;
    const resolvedGradeLevel =
      (typeof requestGrade === "number" ? String(requestGrade) : undefined) ??
      cachedContext?.gradeLevel ??
      undefined;

    if (typeof window !== "undefined" && (resolvedSubject || resolvedGradeLevel)) {
      window.sessionStorage.setItem(
        contextStorageKey,
        JSON.stringify({
          subject: resolvedSubject,
          gradeLevel: resolvedGradeLevel,
        } satisfies CachedAssistantContext)
      );
    }

    setMessages((current) => [
      ...current,
      { id: messageId, question: trimmedQuestion },
    ]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          pathname,
          role,
          subject: resolvedSubject,
          grade: requestGrade,
          gradeLevel: resolvedGradeLevel,
          mode: contextMode,
          retrievalMode: selectedMode,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(normalizeErrorMessage(response.status, payload.error));
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                result: payload as QueryResult,
              }
            : message
        )
      );
    } catch (error: any) {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                error: error?.message ?? "Assistant request failed",
              }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(messageId: string, action: AssistantAction) {
    if (loading) {
      return;
    }

    if (action.requiresConfirmation) {
      setPendingConfirmation({ messageId, action });
      return;
    }

    await executeAction(messageId, action);
  }

  async function executeAction(messageId: string, action: AssistantAction) {
    if (loading) {
      return;
    }

    if (action.type === "EXPLAIN_DIFFERENTLY") {
      setPendingConfirmation(null);
      await submitQuestion(buildExplainDifferentlyQuestion(action));
      return;
    }

    const endpoint = getAssistantActionEndpoint(action.type);
    if (!endpoint) {
      return;
    }

    setLoading(true);
    setPendingConfirmation(null);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, actionResult: undefined, actionError: undefined }
          : message
      )
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(normalizeErrorMessage(response.status, payload.error));
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                actionResult: {
                  label: action.label,
                  content: formatActionDraft(payload),
                },
              }
            : message
        )
      );
    } catch (error: any) {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                actionError: error?.message ?? "Action request failed",
              }
            : message
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 ${
        isDedicatedPage
          ? "inset-4 items-stretch justify-center md:inset-10"
          : `items-end ${positionClassName ?? "bottom-24 right-5"}`
      }`}
    >
      {open ? (
        <section
          className={`flex flex-col overflow-hidden rounded-xl border border-emerald-400/20 bg-[var(--ll-bg)]/95 shadow-[0_20px_60px_rgba(2,6,23,0.72)] backdrop-blur ${
            isDedicatedPage
              ? "h-full max-h-full w-full"
              : "max-h-[70vh] w-[min(92vw,24rem)] max-w-md"
          }`}
        >
          <div className="border-b border-[var(--ll-border)] bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/60 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ll-yellow)]">
                  LiberiaLearn AI
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-base font-semibold text-[var(--ll-text)]">
                    AI Assistant
                  </h2>
                  <span className="rounded-full border border-emerald-400/20 bg-[var(--ll-yellow-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ll-yellow)]">
                    {formatModeLabel(contextMode)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--ll-text-muted)]">
                  {roleConfig.label}. {roleConfig.emptyStateBody}
                </p>
              </div>
              {isDedicatedPage ? null : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] font-semibold text-[var(--ll-text)] transition-colors hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
              >
                Minimize
              </button>
              )}
            </div>
          </div>

          <div className="space-y-3 border-b border-[var(--ll-border)] px-4 py-3.5">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={roleConfig.placeholder}
              className="min-h-24 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)] outline-none transition-colors focus:border-emerald-400/50"
            />

            {isTeacherOrAdmin ? (
              <div className="grid gap-2 md:grid-cols-[1fr_6rem_auto]">
                <input
                  value={teacherSubject}
                  onChange={(event) => setTeacherSubject(event.target.value)}
                  placeholder="Subject"
                  className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)] outline-none transition-colors focus:border-emerald-400/50"
                />
                <input
                  value={teacherGrade}
                  onChange={(event) => setTeacherGrade(event.target.value)}
                  placeholder="Grade"
                  inputMode="numeric"
                  className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)] outline-none transition-colors focus:border-emerald-400/50"
                />
                {visibleModes.length > 1 ? (
                  <select
                    value={mode}
                    onChange={(event) =>
                      setMode(event.target.value as RetrievalMode)
                    }
                    className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)] outline-none transition-colors focus:border-emerald-400/50"
                  >
                    {visibleModes.map((allowedMode) => (
                      <option key={allowedMode} value={allowedMode}>
                        {allowedMode}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {isGuardian && guardianLearners.length > 1 ? (
                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                    Student
                    <select
                      value={selectedGuardianLearner?.id ?? ""}
                      onChange={(event) =>
                        setSelectedGuardianLearnerId(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm font-medium text-[var(--ll-text)] outline-none transition-colors focus:border-emerald-400/50"
                    >
                      {guardianLearners.map((learner) => (
                        <option key={learner.id} value={learner.id}>
                          {learner.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {isGuardian && selectedGuardianLearner ? (
                    <ScopeBadge
                      label="Student"
                      value={selectedGuardianLearner.label}
                    />
                  ) : null}
                  {typeof scopedGrade === "number" ? (
                    <ScopeBadge label="Grade" value={String(scopedGrade)} />
                  ) : null}
                  <ScopeBadge label="Mode" value={formatModeLabel(contextMode)} />
                </div>

                {scopedSubjectOptions.length > 1 ? (
                  <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                    Subject
                    <select
                      value={selectedScopedSubject}
                      onChange={(event) =>
                        setSelectedScopedSubject(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm font-medium text-[var(--ll-text)] outline-none transition-colors focus:border-emerald-400/50"
                    >
                      {scopedSubjectOptions.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {scopedSubjectOptions.length === 1 ? (
                  <ScopeBadge label="Subject" value={scopedSubjectOptions[0]} />
                ) : null}
              </div>
            )}

            {isTeacherOrAdmin && suggestedSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestedSubjects.slice(0, 4).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTeacherSubject(item)}
                    className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs font-medium text-[var(--ll-text)] transition-colors hover:border-emerald-400/40 hover:text-[var(--ll-yellow)]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-1 text-[11px] font-medium text-[var(--ll-text)] transition-colors hover:border-emerald-400/40 hover:text-[var(--ll-yellow)]"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => submitQuestion()}
              disabled={loading || question.trim().length < 8}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-yellow-soft)] disabled:cursor-not-allowed disabled:bg-[var(--ll-surface-muted)] disabled:text-[var(--ll-text-muted)]"
            >
              {loading ? "Thinking..." : "Ask Assistant"}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-4">
                <p className="text-sm font-semibold text-[var(--ll-text)]">
                  {roleConfig.emptyStateTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ll-text-muted)]">
                  Answers stay grounded in retrieved LiberiaLearn content with
                  visible sources.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <article key={message.id} className="space-y-3">
                    <div className="ml-auto max-w-[88%] rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-medium text-[var(--ll-text-faint)]">
                      {message.question}
                    </div>

                    {message.result ? (
                      <div className="max-w-[94%] rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-4 text-sm text-[var(--ll-text)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ll-yellow)]">
                            {message.result.isWeakGrounding
                              ? "Weak Grounding"
                              : message.result.retrievalWeak
                                ? "Weak Retrieval"
                                : "Grounded Answer"}
                          </span>
                          <span className="text-[11px] text-[var(--ll-text-faint)]">
                            {message.result.sources.length} source
                            {message.result.sources.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {message.result.isWeakGrounding ? (
                          <p className="mt-2 text-xs font-medium text-[var(--ll-yellow)]">
                            Limited curriculum grounding
                          </p>
                        ) : null}
                        <p className="mt-3 whitespace-pre-wrap leading-7 text-[var(--ll-text)]">
                          {message.result.answer}
                        </p>
                        {message.result.sources.length > 0 ? (
                          <div className="mt-4 space-y-2">
                            {message.result.sources.map((source) => (
                              <div
                                key={source.id}
                                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <span className="inline-flex rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ll-text)]">
                                      {getSourceBadge(source.sourceType)}
                                    </span>
                                    <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                                      {source.title}
                                    </p>
                                  </div>
                                  {source.groundingStrength ? (
                                    <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                                      {source.groundingStrength}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                                  {source.sourceType}
                                  {source.sourceLabel
                                    ? ` | ${source.sourceLabel}`
                                    : ""}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-[var(--ll-text-muted)]">
                                  {source.excerpt}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {message.result.actions.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {message.result.actions.map((action) => (
                              <button
                                key={`${message.id}-${action.type}`}
                                type="button"
                                onClick={() => handleAction(message.id, action)}
                                className="rounded-full border border-emerald-400/30 bg-[var(--ll-yellow-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-yellow)] transition-colors hover:border-emerald-300/50 hover:bg-[var(--ll-yellow-soft)]"
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {pendingConfirmation?.messageId === message.id ? (
                          <div className="mt-3 rounded-xl border border-amber-400/25 bg-[var(--ll-yellow-soft)] px-3 py-3">
                            <p className="text-sm font-semibold text-[var(--ll-yellow)]">
                              Confirm {pendingConfirmation.action.label}?
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--ll-yellow)]/80">
                              This will prepare a draft follow-up based on the current grounded answer.
                            </p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  executeAction(
                                    pendingConfirmation.messageId,
                                    pendingConfirmation.action
                                  )
                                }
                                className="rounded-full bg-[var(--ll-yellow-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-yellow-soft)]"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingConfirmation(null)}
                                className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text)] transition-colors hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {message.actionResult ? (
                          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-[var(--ll-yellow-soft)] px-3 py-3 text-sm text-[var(--ll-yellow)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ll-yellow)]">
                              {message.actionResult.label}
                            </p>
                            <p className="mt-2 leading-6">{message.actionResult.content}</p>
                          </div>
                        ) : null}
                        {message.actionError ? (
                          <div className="mt-3 rounded-xl border border-amber-400/20 bg-[var(--ll-yellow-soft)] px-3 py-3 text-sm text-[var(--ll-yellow)]">
                            {message.actionError}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {message.error ? (
                      <div className="max-w-[94%] rounded-xl border border-rose-500/30 bg-[var(--ll-danger)]/10 px-4 py-4 text-sm text-[var(--ll-danger)]">
                        {message.error}
                      </div>
                    ) : null}
                  </article>
                ))}
                <div ref={scrollRef} />
              </div>
            )}
          </div>
        </section>
      ) : null}

      {isDedicatedPage ? null : (
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group flex items-center gap-3 rounded-full border border-emerald-400/30 bg-[var(--ll-bg)]/95 px-4 py-2.5 text-left shadow-[0_18px_50px_rgba(2,6,23,0.55)] transition-colors hover:border-emerald-300/50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ll-yellow-soft)] text-xs font-bold text-[var(--ll-text-faint)]">
          AI
        </div>
        <div className="pr-1">
          <p className="text-sm font-semibold text-[var(--ll-text)]">Assistant</p>
          <p className="text-[11px] text-[var(--ll-text-muted)]">
            {roleConfig.label} | {formatModeLabel(contextMode)}
          </p>
        </div>
      </button>
      )}
    </div>
  );
}
