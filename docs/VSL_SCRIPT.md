# LiberiaLearn — VSL Script
## Duration: 90 seconds
## Format: Playwright screen recording + ElevenLabs voiceover + CapCut edit
## Last updated: 2026-04-30

---

### SCENE 1 — Homepage (0:00 – 0:08)
VISUAL: liberia-learn.vercel.app homepage
Slow scroll to show feature cards then back up.

VOICEOVER:
"In Liberia, 1.5 million students go to school
every day. Most of their teachers have no way
to know who is struggling until it's too late.
LiberiaLearn changes that."

---

### SCENE 2 — Student Dashboard (0:08 – 0:35)
VISUAL: Login as student1@cha.edu.lr
Show dashboard greeting, KPIs, Today page,
open a lesson, switch to Slides tab,
open AI tutor, type a question, show response
with trust badge.

VOICEOVER:
"A student opens their dashboard.
Their lesson is ready — they can read it,
view it as slides, or listen to it read aloud.
When they're stuck, they tap the AI tutor.
It explains the concept grounded in their
actual curriculum. Every answer, every quiz,
every lab — tracked automatically."

---

### SCENE 3 — Teacher Dashboard (0:35 – 1:05)
VISUAL: Login as teacher1@cha.edu.lr
Show dashboard, alert bell with count,
My Students list, click a student,
see progress bars, click Review on completed
lesson, show student context banner with
name and quiz score.

VOICEOVER:
"Their teacher logs in.
Before the first class starts, they see which
students are falling behind — and why.
They can review exactly what a student submitted,
see their score, and assign extra support
with one click. No spreadsheets. No guessing."

---

### SCENE 4 — MOE Dashboard (1:05 – 1:22)
VISUAL: Login as official1@moe.gov.lr
Show national KPIs, Montserrado county data,
school comparison, curriculum intelligence.
Slow scroll through dashboard.

VOICEOVER:
"At the Ministry of Education, officials see
the whole picture — across every county,
every grade, every subject.
No individual student data. Just the signals
that matter for national decisions."

---

### SCENE 5 — Homepage CTA (1:22 – 1:30)
VISUAL: Back to homepage, CTA buttons visible.

VOICEOVER:
"LiberiaLearn. Built for Liberia.
Ready for real schools.
Access the platform today."

---

## Recording Instructions
- Run: npx playwright test e2e/vsl-recording.spec.ts
  --headed --video=on --timeout=180000
- Video saved to: playwright-report/videos/
- Convert webm to mp4:
  ffmpeg -i video.webm -c:v libx264 output.mp4
- Upload to YouTube as unlisted
- Replace VIDEO_ID in app/page.tsx with video ID

## Voiceover Instructions
- Go to elevenlabs.io
- Paste script above
- Recommended voice: Rachel or Adam
- Download as MP3
- Sync with screen recording in CapCut
