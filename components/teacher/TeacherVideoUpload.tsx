"use client";

import { useState } from "react";

type UploadedVideo = {
  id: string;
  title: string;
  description: string | null;
  storageUrl: string;
  durationSeconds: number;
  fileSize: number;
  isActive: boolean;
};

export function TeacherVideoUpload({
  contentId,
  initialVideos = [],
}: {
  contentId: string;
  initialVideos?: UploadedVideo[];
}) {
  const [videos, setVideos] = useState<UploadedVideo[]>(initialVideos);
  const [title, setTitle] = useState("Teacher introduction");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose an MP4, WebM, or MOV file.");
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title);
      form.set("description", description);
      form.set("durationSeconds", duration);
      const res = await fetch(`/api/teacher/lessons/${contentId}/video`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Video upload failed.");
      setMessage("Video uploaded. Activate it when ready for students.");
      setFile(null);
      const reload = await fetch(`/api/curriculum/${contentId}`, { cache: "no-store" });
      if (reload.ok) {
        const updated = await reload.json();
        setVideos(updated.videos ?? []);
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Video upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleVideo(videoId: string, isActive: boolean) {
    const res = await fetch(`/api/teacher/lessons/${contentId}/video/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      setVideos((current) =>
        current.map((v) => (v.id === videoId ? { ...v, isActive } : v))
      );
    }
  }

  return (
    <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-pink)]">Optional video supplement</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Teacher video upload</h2>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Short clips support the lesson, but the full text remains primary.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mov"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
            placeholder="Video title"
          />
          <input
            type="number"
            min={1}
            max={900}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
            placeholder="Duration seconds"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-20 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
          placeholder="Optional description"
        />
        <button
          type="submit"
          disabled={uploading}
          className="min-h-12 rounded-xl bg-[var(--ll-pink-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-pink)] disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload video"}
        </button>
        {file ? <p className="text-xs text-[var(--ll-text-muted)]">Selected: {file.name}</p> : null}
        {message ? <p className="text-sm text-[var(--ll-text-muted)]">{message}</p> : null}
      </form>
      {videos.length > 0 ? (
        <div className="mt-5 space-y-3">
          {videos.map((video) => (
            <div key={video.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--ll-text)]">{video.title}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">
                    {Math.ceil(video.fileSize / 1024 / 1024)}MB, {Math.round(video.durationSeconds / 60)} min
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleVideo(video.id, !video.isActive)}
                  className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)]"
                >
                  {video.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
              <video
                className="mt-3 w-full rounded-xl border border-[var(--ll-border)]"
                controls
                src={video.storageUrl}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
