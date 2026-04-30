"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type LessonAudioPart = {
  partNumber?: number;
  storageUrl?: string | null;
  status?: string;
  charLength?: number;
};

export type LessonAudioPlaybackInput = {
  id?: string;
  storageUrl?: string | null;
  status?: string;
  durationSeconds?: number | null;
  audioParts?: unknown;
};

export type PlayableAudioPart = {
  partNumber: number;
  storageUrl: string;
};

export function getPlayableAudioParts(audio?: LessonAudioPlaybackInput | null): PlayableAudioPart[] {
  if (!audio || audio.status !== "GENERATED") return [];
  const parts = Array.isArray(audio.audioParts)
    ? audio.audioParts
        .map((part, index) => {
          const value = part as LessonAudioPart;
          const storageUrl = typeof value.storageUrl === "string" ? value.storageUrl : "";
          return {
            partNumber: Number.isFinite(Number(value.partNumber)) ? Number(value.partNumber) : index + 1,
            storageUrl,
            status: value.status,
          };
        })
        .filter((part) => part.status === "GENERATED" && part.storageUrl)
        .sort((a, b) => a.partNumber - b.partNumber)
    : [];

  if (parts.length > 0) {
    return parts.map(({ partNumber, storageUrl }) => ({ partNumber, storageUrl }));
  }

  return audio.storageUrl ? [{ partNumber: 1, storageUrl: audio.storageUrl }] : [];
}

export function getAdjacentAudioPartIndex(currentIndex: number, direction: "next" | "previous", partCount: number) {
  if (partCount <= 0) return 0;
  if (direction === "next") return Math.min(partCount - 1, currentIndex + 1);
  return Math.max(0, currentIndex - 1);
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = String(whole % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function LessonAudioPlayer({
  audio,
  contentId,
  lessonId,
  onPlaybackStart,
}: {
  audio?: LessonAudioPlaybackInput | null;
  contentId: string;
  lessonId?: string;
  onPlaybackStart?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const parts = useMemo(() => getPlayableAudioParts(audio), [audio]);
  const currentPart = parts[currentIndex] ?? null;
  const hasAudio = parts.length > 0;

  useEffect(() => {
    setCurrentIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setIsPlaying(false);
  }, [audio?.id, audio?.storageUrl, parts.length]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !currentPart) return;
    node.load();
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    if (isPlaying) {
      node.play().catch(() => {
        setIsPlaying(false);
        setError("Audio could not start. Try pressing play again.");
      });
    }
  }, [currentPart, isPlaying]);

  const play = async () => {
    if (!audioRef.current || !currentPart) return;
    setError(null);
    try {
      await audioRef.current.play();
      setIsPlaying(true);
      onPlaybackStart?.();
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "AUDIO_PLAYBACK_STARTED",
          contentId,
          metadata: { lessonId, audioId: audio?.id, partNumber: currentPart.partNumber },
        }),
      }).catch(() => {});
    } catch {
      setIsPlaying(false);
      setError("Audio could not start. Check your connection and try again.");
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const goToPart = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(parts.length - 1, index)));
  };

  if (!hasAudio) {
    const pending = audio?.status === "PENDING" || audio?.status === "PROCESSING";
    return (
      <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3 text-sm text-[var(--ll-text-muted)]" role="status">
        {pending
          ? "Audio is being prepared. You can keep reading now."
          : "No generated audio exists for this lesson yet. Listen mode keeps the lesson readable while audio is unavailable."}
      </div>
    );
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="space-y-4" data-lesson-audio-player>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-[var(--ll-text)]">Part {currentIndex + 1} of {parts.length}</p>
        <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">Listening mode</p>
      </div>
      <audio
        ref={audioRef}
        src={currentPart?.storageUrl}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || audio?.durationSeconds || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => {
          setIsPlaying(false);
          setError("This audio section could not be loaded.");
        }}
        onEnded={() => {
          if (currentIndex < parts.length - 1) {
            setCurrentIndex((value) => value + 1);
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
          }
        }}
      >
        <track kind="captions" />
      </audio>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--ll-surface-muted)]" aria-label="Audio progress">
        <div className="h-full rounded-full bg-[var(--ll-yellow)]" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--ll-text-muted)]">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration || audio?.durationSeconds || 0)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label="Previous audio section"
          disabled={currentIndex === 0}
          onClick={() => goToPart(getAdjacentAudioPartIndex(currentIndex, "previous", parts.length))}
          className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          onClick={isPlaying ? pause : play}
          className="rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          aria-label="Next audio section"
          disabled={currentIndex >= parts.length - 1}
          onClick={() => goToPart(getAdjacentAudioPartIndex(currentIndex, "next", parts.length))}
          className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
