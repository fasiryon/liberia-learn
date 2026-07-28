"use client";

import { useState } from "react";
import {
  getAudioOnlyFallback,
  getPrintableWorksheet,
} from "@/lib/teaching/recovery.client";
import type {
  AudioOnlyFallback,
  PrintableWorksheet,
} from "@/lib/teaching/recovery";

type RecoveryReason = "projector" | "internet" | "power";
type RecoveryState =
  | { mode: "AUDIO_ONLY"; fallback: AudioOnlyFallback }
  | { mode: "WORKSHEET"; fallback: PrintableWorksheet }
  | null;

export function TeachingRecoveryControls({
  sessionId,
  contentId,
}: {
  sessionId: string;
  contentId: string;
}) {
  const [recovery, setRecovery] = useState<RecoveryState>(null);
  const [message, setMessage] = useState("");

  async function activateRecovery(reason: RecoveryReason) {
    const mode = reason === "projector" ? "AUDIO_ONLY" : "WORKSHEET";
    const fallback =
      mode === "AUDIO_ONLY"
        ? await getAudioOnlyFallback(contentId)
        : await getPrintableWorksheet(contentId);

    if (!fallback) {
      setMessage("This lesson is not cached on this device yet.");
      return;
    }

    setRecovery(
      mode === "AUDIO_ONLY"
        ? { mode, fallback: fallback as AudioOnlyFallback }
        : { mode, fallback: fallback as PrintableWorksheet }
    );
    setMessage("Recovery material loaded from this device.");

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void fetch(`/api/teaching/sessions/${sessionId}/degrade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      }).catch(() => {
        // Recovery is already available locally. Server recording is best-effort.
      });
    }
  }

  return (
    <section aria-labelledby="teaching-recovery-heading">
      <h2 id="teaching-recovery-heading">Teaching Recovery</h2>
      <p>Use lesson material already saved on this device.</p>
      <div>
        <button type="button" onClick={() => void activateRecovery("projector")}>
          Projector unavailable
        </button>
        <button type="button" onClick={() => void activateRecovery("internet")}>
          Internet unavailable
        </button>
        <button type="button" onClick={() => void activateRecovery("power")}>
          Power unavailable
        </button>
      </div>

      {message ? <p role="status">{message}</p> : null}

      {recovery?.mode === "AUDIO_ONLY" ? (
        <div>
          <h3>Audio-only lesson</h3>
          {recovery.fallback.audioUrl ? (
            <audio controls preload="metadata" src={recovery.fallback.audioUrl}>
              Your browser does not support lesson audio.
            </audio>
          ) : null}
          <p>{recovery.fallback.narration}</p>
        </div>
      ) : null}

      {recovery?.mode === "WORKSHEET" ? (
        <article>
          <h3>{recovery.fallback.title}</h3>
          {recovery.fallback.objectives.length > 0 ? (
            <>
              <h4>Objectives</h4>
              <ul>
                {recovery.fallback.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </>
          ) : null}
          {recovery.fallback.sections.map((section, index) => (
            <section key={`${section.heading}-${index}`}>
              <h4>{section.heading}</h4>
              <ul>
                {section.bullets.map((bullet, bulletIndex) => (
                  <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>
                ))}
              </ul>
            </section>
          ))}
          <button type="button" onClick={() => window.print()}>
            Print worksheet
          </button>
        </article>
      ) : null}
    </section>
  );
}
