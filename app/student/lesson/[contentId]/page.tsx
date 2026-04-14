"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { trackEvent, EVENTS } from "@/lib/trackEvent";
import { cacheLessonContent, loadCachedLesson } from "@/lib/lesson-offline-cache";

export default function LessonViewerPage() {
  const router = useRouter();
  const params = useParams();
  const contentId = params.contentId as string;

  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any>(null);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [servedFromCache, setServedFromCache] = useState(false);

  useEffect(() => {
    if (!contentId) return;

    trackEvent(EVENTS.LESSON_VIEW, { contentId });

    fetch(`/api/curriculum/${contentId}`)
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Lesson not found");
        return res.json();
      })
      .then((data) => {
        if (data) {
          setMetadata(data.metadata);
          setPayload(data.payload);
          // Cache lesson content for offline use after first successful load
          cacheLessonContent(contentId, { metadata: data.metadata, payload: data.payload });
        }
      })
      .catch(async () => {
        // Network failure — attempt to serve from local cache
        const cached = await loadCachedLesson(contentId);
        if (cached) {
          setMetadata(cached.metadata);
          setPayload(cached.payload);
          setServedFromCache(true);
        } else {
          setError("This lesson isn't available offline yet. Please connect to the internet to load it for the first time.");
        }
      })
      .finally(() => setLoading(false));
  }, [contentId, router]);

  const handleComplete = () => {
    trackEvent(EVENTS.LESSON_COMPLETE, { contentId });
    setCompleted(true);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
        <div className="w-full max-w-3xl space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-slate-800" />
          <div className="h-4 w-full animate-pulse rounded-lg bg-slate-800" />
          <div className="h-4 w-5/6 animate-pulse rounded-lg bg-slate-800" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
        <div className="w-full max-w-3xl space-y-4 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Link href="/student/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const objectives: string[] = Array.isArray(payload?.objectives) ? payload.objectives : [];
  const activities: string[] = Array.isArray(payload?.activities) ? payload.activities : [];
  const isBlockOnly = Boolean(payload?.lessonFormat === "block" && payload?.body_block && !payload?.body_standard);
  const standardBodyText: string = isBlockOnly ? "" : payload?.body_standard ?? payload?.body ?? payload?.content ?? "";
  const blockBodyText: string = payload?.body_block ?? "";
  const hasBothFormats = Boolean(payload?.body_standard && payload?.body_block);
  const moeAlignments: string[] = Array.isArray(metadata?.moeAlignments) ? metadata.moeAlignments : [];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back */}
        <Link href="/student/dashboard" className="inline-block text-sm text-emerald-300 hover:text-emerald-200">
          &larr; Back to Dashboard
        </Link>

        {/* Offline cache indicator */}
        {servedFromCache && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
            Viewing cached version — you are offline
          </div>
        )}

        {/* Title + badges */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-slate-50">
            {payload?.title ?? contentId}
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-medium text-emerald-300">
              Grade {metadata?.grade}
            </span>
            <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-medium text-emerald-300">
              {metadata?.subject}
            </span>
          </div>

          {/* MOE alignment chips */}
          {moeAlignments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {moeAlignments.map((a: string, i: number) => (
                <span key={i} className="rounded-full bg-sky-500/20 border border-sky-400/30 px-3 py-0.5 text-xs text-sky-300">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Learning Objectives */}
        {objectives.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Learning Objectives</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
              {objectives.map((obj: string, i: number) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Body Content */}
        {(standardBodyText || blockBodyText) && (
          <div className="space-y-4">
            {standardBodyText && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Standard Period Lesson
                  </h2>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                    45 min
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-line text-slate-300 leading-relaxed">
                  {standardBodyText}
                </div>
              </div>
            )}

            {(hasBothFormats || isBlockOnly) && blockBodyText && (
              <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Block Period Lesson
                  </h2>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-200">
                    90 min / A-B day
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-line text-slate-300 leading-relaxed">
                  {blockBodyText}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Activities */}
        {activities.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Activities</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
              {activities.map((act: string, i: number) => (
                <li key={i}>{act}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Mark Complete */}
        <div className="flex items-center gap-3">
          {completed ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Lesson complete!
            </div>
          ) : (
            <button
              onClick={handleComplete}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
            >
              Mark as Complete
            </button>
          )}
        </div>

        {/* Low bandwidth note */}
        <p className="text-[11px] text-slate-500 text-center pb-4">
          This lesson is cached for offline use after first load.
        </p>
      </div>
    </main>
  );
}
