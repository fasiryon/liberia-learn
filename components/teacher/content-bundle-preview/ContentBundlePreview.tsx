"use client";

/**
 * Read-only Teacher Preview for one resolved ContentBundle V1. Renders display models only; it
 * publishes nothing, decides nothing and calls no API.
 */
import { useCallback, useRef, useState } from "react";
import type { ContentBundlePreviewModels } from "@/lib/content-bundle/preview/viewModel";
import { Chip, Code, OVERVIEW_ID, SequenceNav } from "./parts";
import { releaseChip, TeacherAside, TeacherCenter } from "./TeacherPanels";
import { StudentCenter } from "./StudentPanels";

export type PreviewMode = "teacher" | "student";

export function ContentBundlePreview({ models, initialMode = "teacher", initialItemId = null }: { models: ContentBundlePreviewModels; initialMode?: PreviewMode; initialItemId?: string | null }) {
  const { teacher, student } = models;
  const known = (id: string | null) => id !== null && teacher.members.some((m) => m.itemId === id);
  const [mode, setMode] = useState<PreviewMode>(initialMode);
  const [selectedId, setSelectedId] = useState<string>(known(initialItemId) ? initialItemId! : OVERVIEW_ID);
  const [announcement, setAnnouncement] = useState("");
  const panelRef = useRef<HTMLElement>(null);

  const titleOf = useCallback((id: string) => (id === OVERVIEW_ID ? "Bundle overview" : teacher.members.find((m) => m.itemId === id)?.title ?? id), [teacher.members]);

  const select = useCallback(
    (itemId: string) => {
      setSelectedId(itemId);
      setAnnouncement(`Showing ${titleOf(itemId)}`);
      // On stacked (phone/tablet) layouts the panel sits below the list; bring it into view.
      const panel = panelRef.current;
      if (panel && typeof panel.scrollIntoView === "function") {
        const top = panel.getBoundingClientRect().top;
        if (top > window.innerHeight * 0.6) panel.scrollIntoView({ block: "start" });
      }
    },
    [titleOf],
  );

  const switchMode = (next: PreviewMode) => {
    if (next === mode) return;
    setMode(next);
    setAnnouncement(next === "student" ? "Student View: showing only what the student receives" : "Teacher overview");
  };

  const h = teacher.header;
  return (
    <main id="cbp-main" className="cbp-root" data-mode={mode} aria-labelledby="cbp-title">
      <a href="#cbp-item-panel" className="cbp-skip">Skip to preview</a>
      <header className="cbp-header">
        <div className="cbp-header-text">
          <p className="cbp-eyebrow">Content bundle preview · read only</p>
          <h1 id="cbp-title" className="cbp-h1">{h.title}</h1>
          <dl className="cbp-header-meta">
            <div><dt>Grade</dt><dd>{h.gradeLevel}</dd></div>
            <div><dt>Subject</dt><dd>{h.subject}</dd></div>
            <div><dt>Version</dt><dd><Code>{h.version}</Code></dd></div>
            <div><dt>Status</dt><dd>{releaseChip(teacher.release)}{teacher.source.authoritative ? null : <> <Chip tone="warn">{teacher.source.kind === "FIXTURE" ? "Test fixture" : "Not authoritative"}</Chip></>}</dd></div>
          </dl>
        </div>
        <div className="cbp-mode" role="group" aria-label="Preview mode">
          <button type="button" className="cbp-mode-btn" aria-pressed={mode === "teacher"} onClick={() => switchMode("teacher")}>Teacher overview</button>
          <button type="button" className="cbp-mode-btn" aria-pressed={mode === "student"} onClick={() => switchMode("student")}>Student view</button>
        </div>
      </header>

      {mode === "student" ? (
        <p className="cbp-banner" role="note">
          <strong>Student View.</strong> This is what the student receives from this bundle. Teacher notes, answer keys, tool prohibitions and review records are not included.
        </p>
      ) : null}

      <div className="cbp-grid">
        <div className="cbp-col-nav">
          {mode === "teacher" ? (
            <SequenceNav groups={teacher.nav} selectedId={selectedId} onSelect={select} label="Bundle sequence" />
          ) : (
            <SequenceNav groups={student.nav} selectedId={selectedId} onSelect={select} label="Student sequence" />
          )}
        </div>

        <section ref={panelRef} id="cbp-item-panel" className="cbp-col-main" aria-labelledby="cbp-item-heading" tabIndex={-1}>
          {mode === "teacher" ? (
            <TeacherCenter model={teacher} selectedId={selectedId} onSelect={select} />
          ) : (
            <div className="cbp-student-frame" data-testid="student-preview">
              <StudentCenter model={student} selectedId={selectedId} onSelect={select} />
            </div>
          )}
        </section>

        <aside className="cbp-col-aside" aria-label={mode === "teacher" ? "Item details and governance" : "Hidden from students"}>
          {mode === "teacher" ? (
            <TeacherAside model={teacher} selectedId={selectedId} />
          ) : (
            <section className="cbp-section" aria-labelledby="cbp-withheld" data-testid="withheld-summary">
              <h3 id="cbp-withheld" className="cbp-h3">Not sent to students</h3>
              <p className="cbp-note">Counts only. Switch to Teacher overview to inspect them.</p>
              {teacher.withheldFromStudents.length > 0 ? (
                <ul className="cbp-list">
                  {teacher.withheldFromStudents.map((row) => (
                    <li key={row.label}>{row.label}: <span className="cbp-strong">{row.count}</span></li>
                  ))}
                </ul>
              ) : (
                <p>Nothing is withheld.</p>
              )}
            </section>
          )}
        </aside>
      </div>
      <p className="cbp-sr-only" role="status" aria-live="polite">{announcement}</p>
    </main>
  );
}

/** Truthful non-success states from the resolver. */
export function ContentBundlePreviewUnavailable({ title, message }: { title: string; message: string }) {
  return (
    <main id="cbp-main" className="cbp-root" aria-labelledby="cbp-title">
      <header className="cbp-header">
        <div className="cbp-header-text">
          <p className="cbp-eyebrow">Content bundle preview · read only</p>
          <h1 id="cbp-title" className="cbp-h1">{title}</h1>
        </div>
      </header>
      <div className="cbp-callout cbp-callout-warn" role="alert">
        <p>{message}</p>
      </div>
    </main>
  );
}
