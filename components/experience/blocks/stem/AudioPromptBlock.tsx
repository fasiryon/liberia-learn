"use client";

/**
 * AUDIO_PROMPT (teaching-blocks/1.2.0), K-2. The instruction is always on screen; "Listen" reads the same words with
 * the device's own speech (offline where the device supports it). Never autoplays (the contract fixes autoplay=false).
 * Fallback TEXT_AND_TEACHER_READ_ALOUD: with no device speech, the learner is told to ask the teacher to read it.
 * It never gates Continue: a learner who cannot hear, or a device with no voice, is not blocked. Nothing is recorded.
 */
import "./stem.css";
import { useEffect, useMemo, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import type { z } from "zod";
import { BLOCK_SCHEMAS_1_2 } from "@/lib/learner-experience/teaching/registry-1.2";

export type AudioPromptData = z.infer<typeof BLOCK_SCHEMAS_1_2.AUDIO_PROMPT>;

export function validateAudioPrompt(block: unknown): AudioPromptData {
  const parsed = BLOCK_SCHEMAS_1_2.AUDIO_PROMPT.safeParse(block);
  if (!parsed.success) throw Error(`audio_prompt_invalid:${parsed.error.issues[0]?.message ?? "schema"}`);
  return parsed.data;
}

export function AudioPromptBlock({ block, onDone }: { block: AudioPromptData; onDone?: (blockId: string, done: boolean) => void }) {
  const data = useMemo(() => validateAudioPrompt(block), [block]);
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => { setSupported(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"); }, []);
  useEffect(() => { onDone?.(data.id, true); }, [data.id, onDone]);
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  const listen = () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(data.text);
    // Liberian English is shown as en-LR; few devices ship an en-LR voice, so speech asks for English.
    u.lang = "en"; u.rate = 0.9;
    u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    setSpeaking(true); window.speechSynthesis.speak(u);
  };
  return (
    <section className="ll8-block ll8-audio" aria-label="Listen" data-block-type="AUDIO_PROMPT">
      <p className="ll8-audio-text" lang={data.lang}>{data.text}</p>
      {supported ? <div className="ll8-controls">
        <button type="button" className="ll3-btn ll8-listen" data-primary="" onClick={listen} aria-pressed={speaking}><Volume2 aria-hidden="true" size={26} /> {speaking ? "Listen again" : "Listen"}</button>
        {speaking && <button type="button" className="ll3-btn" onClick={() => { window.speechSynthesis.cancel(); setSpeaking(false); }}><Square aria-hidden="true" size={20} /> Stop</button>}
      </div> : <p className="ll8-muted" data-audio-fallback="">Ask your teacher to read this with you.</p>}
    </section>
  );
}
