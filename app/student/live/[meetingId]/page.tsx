"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LiveSession = {
  id: string;
  liveStatus: string;
  joinUrl: string | null;
  subject: string | null;
  Class?: { name: string; subject: string } | null;
};

export default function StudentLivePage({ params }: { params: { meetingId: string } }) {
  const { meetingId } = params;
  const [session, setSession] = useState<LiveSession | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "not_started" | "ended" | "error">("loading");

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/student/meetings/${meetingId}/join`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setJoinUrl(data.joinUrl);
          setStatus("live");
        } else if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          if (data?.error?.includes("not live")) {
            const meetRes = await fetch(`/api/student/meetings/${meetingId}/status`).catch(() => null);
            if (meetRes?.ok) {
              const meetData = await meetRes.json();
              setSession(meetData.meeting);
              setStatus(meetData.meeting?.liveStatus === "ENDED" ? "ended" : "not_started");
            } else {
              setStatus("not_started");
            }
          } else {
            setStatus("ended");
          }
        } else if (res.status === 401 || res.status === 403) {
          setStatus("error");
        } else {
          setStatus("not_started");
        }
      } catch {
        setStatus("error");
      }
    }
    init();
  }, [meetingId]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p className="text-sm">Joining session...</p>
      </div>
    );
  }

  if (status === "live" && joinUrl) {
    return (
      <div className="relative h-screen w-screen bg-black">
        <Link
          href="/student/today"
          className="absolute left-3 top-3 z-50 rounded-lg bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/80"
        >
          ← Back to Today
        </Link>
        <iframe
          src={joinUrl}
          allow="camera; microphone; fullscreen; display-capture"
          style={{ width: "100%", height: "100vh", border: "none" }}
          title="Live Class Session"
        />
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--ll-bg)] text-[var(--ll-text)]">
        <p className="text-lg font-semibold">This session has ended.</p>
        <Link href="/student/today" className="rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-white">
          Back to Today
        </Link>
      </div>
    );
  }

  if (status === "not_started") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--ll-bg)] text-[var(--ll-text)]">
        <p className="text-lg font-semibold">This session has not started yet.</p>
        <p className="text-sm text-[var(--ll-text-muted)]">Check back when your teacher starts the class.</p>
        <Link href="/student/today" className="rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-white">
          Back to Today
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <p className="text-sm text-[var(--ll-text-muted)]">Unable to join session. Please try again.</p>
      <Link href="/student/today" className="rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-white">
        Back to Today
      </Link>
    </div>
  );
}
