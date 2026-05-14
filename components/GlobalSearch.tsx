"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

type SearchResults = {
  lessons: Array<{ contentId: string; title: string | null; subject: string; grade: number }>;
  events: Array<{ id: string; title: string; eventDate: string; description: string | null }>;
  assignments: Array<{ id: string; title: string; subject: string; dueAt: string | null }>;
};

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems = results
    ? [
        ...results.lessons.map((l) => ({
          key: `lesson-${l.contentId}`,
          label: l.title ?? l.contentId,
          sub: `${l.subject.replace(/_/g, " ")} · Grade ${l.grade}`,
          href: `/student/lesson/${l.contentId}`,
          section: "Lessons",
        })),
        ...results.events.map((e) => ({
          key: `event-${e.id}`,
          label: e.title,
          sub: new Date(e.eventDate).toLocaleDateString("en-LR"),
          href: "/events",
          section: "Events",
        })),
        ...results.assignments.map((a) => ({
          key: `asgn-${a.id}`,
          label: a.title,
          sub: `${a.subject} ${a.dueAt ? "· due " + new Date(a.dueAt).toLocaleDateString("en-LR") : ""}`,
          href: "/assignments",
          section: "Assignments",
        })),
      ]
    : [];

  const doSearch = useCallback(
    debounce(async (q: string) => {
      if (!q || q.length < 2) {
        setResults(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&types=lessons,events,assignments`, {
          cache: "no-store",
        });
        const data = await res.json();
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
      setActiveIdx(-1);
    }
  }, [open]);

  useEffect(() => {
    doSearch(query);
    setActiveIdx(-1);
  }, [query, doSearch]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0 && allItems[activeIdx]) {
      window.location.href = allItems[activeIdx].href;
      setOpen(false);
    }
  }

  const totalResults = allItems.length;

  return (
    <>
      <button
        type="button"
        aria-label="Open search"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] transition-colors"
      >
        <Search className="h-4 w-4" strokeWidth={1.5} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] shadow-2xl">
            <div className="flex items-center gap-3 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[var(--ll-text-muted)]" strokeWidth={1.5} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search lessons, events, assignments..."
                className="flex-1 bg-transparent text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)] outline-none"
              />
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ll-border)] border-t-[var(--ll-yellow)]" />
              ) : null}
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setOpen(false)}
                className="ml-1 rounded-lg p-1 text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {query.length >= 2 && !loading && totalResults === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--ll-text-muted)]">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : null}

            {totalResults > 0 ? (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--ll-border)] pb-2">
                {(["Lessons", "Events", "Assignments"] as const).map((section) => {
                  const sectionItems = allItems.filter((item) => item.section === section);
                  if (sectionItems.length === 0) return null;
                  return (
                    <div key={section}>
                      <p className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--ll-text-faint)]">
                        {section}
                      </p>
                      {sectionItems.map((item) => {
                        const globalIdx = allItems.indexOf(item);
                        return (
                          <Link
                            key={item.key}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`block px-4 py-2.5 text-sm transition-colors hover:bg-[var(--ll-surface-muted)] ${
                              globalIdx === activeIdx ? "bg-[var(--ll-accent-soft)]" : ""
                            }`}
                          >
                            <p className="font-semibold text-[var(--ll-text)]">{item.label}</p>
                            <p className="text-xs text-[var(--ll-text-muted)]">{item.sub}</p>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="border-t border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text-faint)]">
              Press <kbd className="rounded border border-[var(--ll-border)] px-1">Esc</kbd> to close &middot;{" "}
              <kbd className="rounded border border-[var(--ll-border)] px-1">↑↓</kbd> navigate
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
