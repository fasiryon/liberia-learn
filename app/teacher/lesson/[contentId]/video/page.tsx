"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type VideoItem = {
  id: string;
  title: string;
  description: string | null;
  storageUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  fileSize: number;
  isActive: boolean;
  status: string;
  rejectedReason: string | null;
  viewCount: number;
  uploadedAt: string;
};

type StorageInfo = { usedBytes: number; limitBytes: number } | null;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusBadge(status: string) {
  if (status === "APPROVED") return <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-400">Approved</span>;
  if (status === "REJECTED") return <span className="rounded-full bg-red-500/20 px-3 py-0.5 text-xs font-semibold text-red-400">Rejected</span>;
  return <span className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-semibold text-amber-400">Pending review</span>;
}

function fmtDuration(secs: number) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export default function TeacherVideoPage() {
  const params = useParams();
  const contentId = params.contentId as string;

  const [tab, setTab] = useState<"upload" | "record">("upload");

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoFileRef = useRef<HTMLInputElement>(null);
  const thumbFileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("Teacher introduction");
  const [description, setDescription] = useState("");

  // Record tab state
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  async function loadVideos() {
    const r = await fetch(`/api/teacher/lessons/${contentId}/video`);
    const data = await r.json().catch(() => ({}));
    setVideos(data.videos ?? []);
    setStorageInfo(data.storageInfo ?? null);
    setLoading(false);
  }

  useEffect(() => { loadVideos(); }, [contentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const videoFile = videoFileRef.current?.files?.[0];
    if (!videoFile) { setMessage("Please select a video file."); return; }

    setUploading(true);
    setMessage(null);
    setUploadProgress(0);

    try {
      const form = new FormData();
      form.append("file", videoFile);
      form.append("title", title);
      form.append("description", description);
      form.append("durationSeconds", "0");

      const thumbFile = thumbFileRef.current?.files?.[0];
      if (thumbFile) form.append("thumbnail", thumbFile);

      // Simple XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 400) reject(new Error(JSON.parse(xhr.responseText)?.error ?? "Upload failed"));
          else resolve();
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", `/api/teacher/lessons/${contentId}/video`);
        xhr.send(form);
      });

      setMessage("Video uploaded. It is now pending admin review.");
      setTitle("Teacher introduction");
      setDescription("");
      if (videoFileRef.current) videoFileRef.current.value = "";
      if (thumbFileRef.current) thumbFileRef.current.value = "";
      await loadVideos();
    } catch (err: any) {
      setMessage(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    setRecording(false);
  }

  async function startRecording() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      setMessage("Camera/microphone access denied. Please allow access and try again.");
      return;
    }
    setMediaStream(stream);
    const chunks: Blob[] = [];
    chunksRef.current = chunks;
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    const mr = new MediaRecorder(stream, { mimeType });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      if (!mountedRef.current) return;
      setRecorded(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach((t) => t.stop());
    };
    mr.start(100);
    mediaRecorderRef.current = mr;
    setRecording(true);
    setDurationSec(0);
    recordIntervalRef.current = setInterval(() => {
      setDurationSec((d) => {
        if (d >= 299) { stopRecording(); return d; }
        return d + 1;
      });
    }, 1000);
  }

  async function submitRecording() {
    if (!recorded) return;
    setUploading(true);
    setMessage(null);
    try {
      const blobType = recorded.type || "video/webm";
      const fileName = blobType === "video/mp4" ? "recording.mp4" : "recording.webm";
      const file = new File([recorded], fileName, { type: blobType });
      const form = new FormData();
      form.append("file", file);
      form.append("title", title);
      form.append("durationSeconds", String(durationSec));

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 400
            ? reject(new Error(JSON.parse(xhr.responseText)?.error ?? "Upload failed"))
            : resolve();
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", `/api/teacher/lessons/${contentId}/video`);
        xhr.send(form);
      });

      setMessage("Video submitted for review.");
      setRecorded(null);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setDurationSec(0);
      await loadVideos();
    } catch (err: any) {
      setMessage(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function discardRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecorded(null);
    setRecordedUrl(null);
    setDurationSec(0);
  }

  return (
    <main className="ll-page-enter min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="ll-dashboard-shell mx-auto max-w-3xl space-y-6">
        <Link href={`/teacher/lesson/${contentId}`} className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
          &larr; Back to lesson
        </Link>

        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Video Upload</h1>

        {/* Storage info */}
        {storageInfo && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">School Storage</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
              <div
                className="h-full rounded-full bg-[var(--ll-yellow)] transition-all"
                style={{ width: `${Math.min(100, Math.round((storageInfo.usedBytes / storageInfo.limitBytes) * 100))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
              {formatBytes(storageInfo.usedBytes)} of {formatBytes(storageInfo.limitBytes)} used
            </p>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setTab("upload"); setMessage(null); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "upload"
                ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)]"
                : "border border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:opacity-80"
            }`}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => { setTab("record"); setMessage(null); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "record"
                ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)]"
                : "border border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:opacity-80"
            }`}
          >
            Record now
          </button>
        </div>

        {/* Tab A — Upload file */}
        {tab === "upload" && (
          <form onSubmit={handleUpload} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--ll-text)]">Upload new video</h2>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--ll-text)]">
                Video file <span className="text-[var(--ll-text-faint)]">(MP4 or WebM, max 200MB)</span>
              </label>
              <input
                ref={videoFileRef}
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                required
                className="block w-full text-sm text-[var(--ll-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--ll-yellow)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--ll-bg)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--ll-text)]">
                Thumbnail <span className="text-[var(--ll-text-faint)]">(image, max 2MB — optional)</span>
              </label>
              <input
                ref={thumbFileRef}
                type="file"
                accept="image/*"
                className="block w-full text-sm text-[var(--ll-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--ll-surface-muted)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--ll-text-muted)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--ll-text)]">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--ll-text)]">Description <span className="text-[var(--ll-text-faint)]">(optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none"
              />
            </div>

            {uploading && (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
                  <div className="h-full rounded-full bg-[var(--ll-yellow)] transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-[var(--ll-text-muted)]">{uploadProgress}% uploaded…</p>
              </div>
            )}

            {message && (
              <p className={`text-sm font-medium ${message.includes("failed") || message.includes("quota") ? "text-red-400" : "text-emerald-400"}`}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload video"}
            </button>
          </form>
        )}

        {/* Tab B — Record now */}
        {tab === "record" && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[var(--ll-text)]">Record video</h2>

            <ul className="text-sm text-[var(--ll-text-muted)] list-disc pl-4 space-y-1">
              <li>Maximum 5 minutes</li>
              <li>Will be reviewed by your principal before students see it</li>
              <li>Speak clearly, face the camera</li>
            </ul>

            {/* Shared title input */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--ll-text)]">Video title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title"
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)] outline-none"
              />
            </div>

            {/* Recording controls */}
            {!recorded ? (
              <>
                {recording ? (
                  <div className="space-y-3">
                    <p className="text-sm text-red-400 font-semibold">
                      Recording… {fmtDuration(durationSec)}
                    </p>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-muted)] hover:opacity-80"
                    >
                      Stop recording
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90"
                  >
                    Start recording
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <video
                  controls
                  autoPlay={false}
                  src={recordedUrl!}
                  className="w-full rounded-xl border border-[var(--ll-border)]"
                />
                <p className="text-sm text-[var(--ll-text-muted)]">Duration: {fmtDuration(durationSec)}</p>

                {uploading && (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
                      <div className="h-full rounded-full bg-[var(--ll-yellow)] transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-[var(--ll-text-muted)]">{uploadProgress}% uploaded…</p>
                  </div>
                )}

                {message && (
                  <p className={`text-sm font-medium ${message.includes("failed") || message.includes("quota") ? "text-red-400" : "text-emerald-400"}`}>
                    {message}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={submitRecording}
                    disabled={uploading}
                    className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90 disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "Submit for review"}
                  </button>
                  <button
                    type="button"
                    onClick={discardRecording}
                    disabled={uploading}
                    className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-muted)] hover:opacity-80 disabled:opacity-50"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing videos */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[var(--ll-text)]">Your videos for this lesson</h2>

          {loading && <div className="h-24 animate-pulse rounded-xl bg-[var(--ll-surface)]" />}

          {!loading && videos.length === 0 && (
            <p className="text-sm text-[var(--ll-text-muted)]">No videos uploaded yet.</p>
          )}

          {videos.map((v) => (
            <div key={v.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--ll-text)]">{v.title}</p>
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    {formatBytes(v.fileSize)} &middot; {new Date(v.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                {statusBadge(v.status)}
              </div>

              {v.status === "REJECTED" && v.rejectedReason && (
                <p className="text-sm text-red-400 font-medium">
                  Reason: {v.rejectedReason}
                </p>
              )}

              {v.thumbnailUrl && (
                <img src={v.thumbnailUrl} alt="Thumbnail" className="h-20 w-32 rounded-lg object-cover border border-[var(--ll-border)]" />
              )}

              <video
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-graphite)]"
                controls
                preload="none"
                poster={v.thumbnailUrl ?? undefined}
                src={v.storageUrl}
              />

              {v.status === "REJECTED" && (
                <p className="text-xs text-[var(--ll-text-muted)]">
                  To replace this video, upload a new one above. The new upload will be submitted for review.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
