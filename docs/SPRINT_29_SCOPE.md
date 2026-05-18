# Sprint 29 — ElevenLabs Lesson Audio Narration (PLANNED)

## Goal
Every approved lesson gets an AI-narrated audio track using ElevenLabs TTS. Students on
low-bandwidth connections can listen instead of read.

## Scope

- **Batch narration script**: `scripts/generate-audio-narration.ts`
  Reads lesson `bodyHtml`, strips tags, sends to ElevenLabs API, uploads MP3 to Vercel Blob,
  stores URL in `Lesson.audioUrl`
- **Lesson viewer**: audio player bar rendered when `audioUrl` is present
- **Offline cache**: audio files cached in service worker alongside lessons
- **Teacher control**: per-lesson "Regenerate audio" button in the content editor
- **Language support**: English first; Kpelle/Bassa as stretch goal

## Prerequisites

- `ELEVENLABS_API_KEY` set in Vercel env (and `.env.local` for local development)
- `Lesson.audioUrl String?` column — new Prisma migration required
- Voice ID selected from ElevenLabs account dashboard

## Schema change (new migration)

```prisma
model Lesson {
  // ... existing fields ...
  audioUrl  String?
}
```

## Estimated effort: 1 sprint (~4 hours)
