"use client";

import { useEffect, useState } from "react";
import { Pause, Volume2 } from "lucide-react";

/**
 * Read a scene's text aloud with this device's own voice, only when the browser offers one. Never
 * autoplays, never requests generated audio, and stops when the scene changes or the page closes.
 */
export function ReadAloud({ text, sceneId }: { text: string; sceneId: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => { setSupported(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function"); }, []);
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); setSpeaking(false); }, [sceneId]);
  if (supported === null) return null;
  if (!supported) return <p className="text-sm text-[var(--ll-text-muted)]">Read aloud is not available on this device. All narration is shown as text.</p>;
  const toggle = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*|__|`/g, ""));
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };
  return <div className="grid gap-2">
    <button type="button" className="ll3-btn w-full" aria-pressed={speaking} onClick={toggle}>{speaking ? <><Pause size={18} aria-hidden="true" /> Stop reading</> : <><Volume2 size={18} aria-hidden="true" /> Read this scene aloud</>}</button>
    <p className="text-sm text-[var(--ll-text-muted)]">Uses this device&apos;s voice. Some voices need a connection. The same words are on the screen.</p>
  </div>;
}
